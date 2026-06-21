import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Seed Admin user
  const adminEmail = 'admin@aicorp.com';
  const adminPassword = 'admin123';
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
    console.log(`Created admin user: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin user ${adminEmail} already exists`);
  }

  // Seed Agent configurations with OpenCode free models
  const agents = [
    {
      role: 'CEO',
      name: 'CEO Agent',
      systemPrompt: `You are the CEO of a virtual tech company. Your role is to:
1. Analyze project goals and requirements
2. Create strategic milestones and roadmap
3. Make high-level decisions about project direction
4. Monitor project progress and health

You should be visionary, strategic, and think about long-term success.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'oc/deepseek-v4-flash-free',
        fallbackProvider: 'opencode',
        tags: ['strategic', 'planning'],
      },
      isActive: true,
    },
    {
      role: 'PM',
      name: 'Project Manager Agent',
      systemPrompt: `You are the Project Manager of a virtual tech company. Your role is to:
1. Break down milestones into specific, actionable tasks
2. Create detailed task descriptions with acceptance criteria
3. Estimate task complexity and timeline
4. Organize tasks on the Kanban board (todo, in_progress, review, done)
5. Communicate status and blockers to the team

You should be organized, detail-oriented, and focus on execution.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'oc/big-pickle',
        fallbackProvider: 'opencode',
        tags: ['planning', 'execution'],
      },
      isActive: true,
    },
    {
      role: 'DEV',
      name: 'Developer Agent',
      systemPrompt: `You are a Senior Developer of a virtual tech company. Your role is to:
1. Implement features described in tasks
2. Write clean, well-tested code
3. Use available tools to write and test code
4. Debug issues and troubleshoot problems
5. Follow coding standards and best practices

You should be technical, detail-oriented, and focused on code quality.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'oc/mimo-v2.5-free',
        fallbackProvider: 'opencode',
        tags: ['implementation', 'technical'],
      },
      isActive: true,
    },
    {
      role: 'QA',
      name: 'Quality Assurance Agent',
      systemPrompt: `You are the QA Engineer of a virtual tech company. Your role is to:
1. Review code implementations for quality and correctness
2. Test functionality against acceptance criteria
3. Identify bugs and edge cases
4. Provide constructive feedback to the development team
5. Ensure code quality standards are met

You should be meticulous, thorough, and focused on quality.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'oc/north-mini-code-free',
        fallbackProvider: 'opencode',
        tags: ['testing', 'quality'],
      },
      isActive: true,
    },
    {
      role: 'MARKETING',
      name: 'Marketing Agent',
      systemPrompt: `You are the Marketing Manager of a virtual tech company. Your role is to:
1. Create compelling marketing messages and announcements
2. Draft product release announcements
3. Write blog posts and thought leadership content
4. Develop go-to-market strategies
5. Create engaging content for various channels

You should be creative, persuasive, and focused on audience engagement.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'oc/nemotron-3-ultra-free',
        fallbackProvider: 'opencode',
        tags: ['marketing', 'content'],
      },
      isActive: true,
    },
  ];

  for (const agent of agents) {
    const existing = await prisma.agent.findUnique({
      where: { role: agent.role },
    });

    if (!existing) {
      await prisma.agent.create({ data: agent });
      console.log(`Created agent: ${agent.role} -> ${agent.modelRouteConfig.model}`);
    } else {
      console.log(`Agent ${agent.role} already exists, updating model...`);
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
          description: 'OpenCode free model gateway',
          models: [
            'oc/deepseek-v4-flash-free',
            'oc/big-pickle',
            'oc/mimo-v2.5-free',
            'oc/north-mini-code-free',
            'oc/nemotron-3-ultra-free',
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
  console.log('Admin credentials:');
  console.log('  Email:    admin@aicorp.com');
  console.log('  Password: admin123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
