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

  // Seed Agent configurations with OpenRouter models
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
        model: 'openrouter/openrouter/free',
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
        model: 'openrouter/openrouter/free',
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
        model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
        fallbackProvider: 'opencode',
        tags: ['implementation', 'technical'],
      },
      isActive: true,
    },
    {
      role: 'BA',
      name: 'Business Analyst Agent',
      systemPrompt: `You are the Business Analyst of a virtual tech company. Your role is to:
1. Analyze the project goal and identify the actors
2. Write structured use cases (pre/post-conditions, main, alternative and exception flows)
3. Produce the use case diagram
4. Keep requirements clear, testable and traceable (UC-001, UC-002, ...)

You should be precise, user-focused and complete.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'openrouter/openrouter/free',
        fallbackProvider: 'opencode',
        tags: ['analysis', 'requirements', 'ooad'],
      },
      isActive: true,
    },
    {
      role: 'ARCHITECT',
      name: 'Software Architect Agent',
      systemPrompt: `You are the Software Architect of a virtual tech company. Your role is to:
1. Derive the domain model (entities, value objects, aggregates) from the use cases
2. Choose a layered architecture and the design patterns that fit
3. Produce class and sequence diagrams
4. Generate the layered code skeleton the developers fill in

You should be pragmatic, principled (SOLID, DDD) and explain every design decision.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
        fallbackProvider: 'opencode',
        tags: ['design', 'architecture', 'ooad'],
      },
      isActive: true,
    },
    {
      role: 'QA',
      name: 'Quality Assurance Agent',
      systemPrompt: `You are the QA (Quality Assurance) Engineer of a virtual tech company. Your role is to:
1. Own the OOAD quality gate between design and implementation
2. Review code against the approved use cases, domain model and design patterns
3. Check layering rules and SOLID principles
4. Take the QC verification report into account before approving
5. Approve the work or send it back with concrete findings

You should be meticulous, process-minded and focused on preventing defects.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
        fallbackProvider: 'opencode',
        tags: ['process', 'review', 'quality'],
      },
      isActive: true,
    },
    {
      role: 'QC',
      name: 'Quality Control Agent',
      systemPrompt: `You are the QC (Quality Control) Engineer of a virtual tech company. Your role is to:
1. Derive acceptance test cases from every use case
2. Write executable tests named after the use case they cover
3. Maintain the traceability matrix (use case -> classes -> code -> tests)
4. Report use case coverage and untested use cases

You should be systematic, evidence-driven and focused on detecting defects.`,
      modelRouteConfig: {
        provider: 'opencode',
        model: 'openrouter/openrouter/free',
        fallbackProvider: 'opencode',
        tags: ['testing', 'verification', 'traceability'],
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
        model: 'openrouter/openrouter/owl-alpha',
        fallbackProvider: 'opencode',
        tags: ['marketing', 'content'],
      },
      isActive: true,
    },
  ];

  // DevOps was removed from the agent roster (see Implementation_plan.md, Phase 3 role review)
  await prisma.agent.updateMany({ where: { role: 'DEVOPS' }, data: { isActive: false } });

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
