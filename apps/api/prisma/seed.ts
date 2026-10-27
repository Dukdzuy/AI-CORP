import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLE_PROFILES } from '../src/modules/agents/profiles';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Seed Admin user
  // Production seeds need their own admin password; the well-known demo one is refused there
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@aicorp.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_PASSWORD || adminPassword.length < 12)) {
    throw new Error('Set SEED_ADMIN_PASSWORD (at least 12 characters) to seed a production database');
  }
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        role: 'admin',
        passwordHash,
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user ${adminEmail} already exists`);
  }

  // Seed one Agent row per role from the same RoleProfiles the agents run with
  const agents = ROLE_PROFILES.map((profile) => ({
    role: profile.role as string,
    name: profile.displayName,
    systemPrompt: profile.systemPrompt,
    modelRouteConfig: profile.modelConfig() as unknown as Prisma.InputJsonValue,
    isActive: true,
  }));

  // DevOps was removed from the agent roster (see Implementation_plan.md, Phase 3 role review)
  await prisma.agent.updateMany({ where: { role: 'DEVOPS' }, data: { isActive: false } });

  for (const agent of agents) {
    const existing = await prisma.agent.findUnique({
      where: { role: agent.role },
    });

    if (!existing) {
      await prisma.agent.create({ data: agent });
      console.log(`Created agent: ${agent.role}`);
    } else {
      console.log(`Agent ${agent.role} already exists, updating profile...`);
      await prisma.agent.update({
        where: { role: agent.role },
        data: agent,
      });
    }
  }

  // Seed LLM Gateway Status
  const gatewayStatus = await prisma.lLMGatewayStatus.findUnique({
    where: { gatewayName: 'opencode' },
  });

  if (!gatewayStatus) {
    await prisma.lLMGatewayStatus.create({
      data: {
        gatewayName: 'opencode',
        status: 'online',
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
        metadata: {
          description: 'OpenRouter + CX model gateway via 9Router',
          models: [
            'openrouter/openrouter/free',
            'openrouter/openrouter/owl-alpha',
            'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
            'cx/gpt-5.3-codex',
            'cx/gpt-5.5',
            'cx/gpt-5.4-mini',
          ],
        },
      },
    });
    console.log('Created LLMGatewayStatus for opencode');
  } else {
    console.log('LLMGatewayStatus for opencode already exists');
  }

  console.log('Database seed completed successfully!');
  console.log('');
  console.log(`Admin: ${adminEmail}${process.env.SEED_ADMIN_PASSWORD ? '' : ' / admin123 (development default)'}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
