import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Check workflow steps
const steps = await prisma.workflowStep.findMany({
  where: { workflowRunId: { in: (await prisma.workflowRun.findMany({ where: { projectId: "e94162a7-90a1-4c3e-b4c7-1731df4985f0" }, select: { id: true } })).map(r => r.id) } },
  orderBy: { startedAt: 'asc' },
  select: { nodeId: true, agentRole: true, status: true, error: true, startedAt: true },
});

console.log("Workflow steps:");
for (const step of steps) {
  console.log(`  ${step.nodeId} (${step.agentRole}): ${step.status} ${step.error ? '- ERROR: ' + step.error.substring(0, 80) : ''}`);
}

await prisma.$disconnect();
