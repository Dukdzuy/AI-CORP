import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const runs = await prisma.workflowRun.findMany({ where: { projectId: "7880cf68-8f7e-4741-844f-8b79d15fe200" }, take: 1 });
console.log("Workflow:", JSON.stringify(runs[0]?.status, null, 2), "Node:", runs[0]?.currentNodeId);
const steps = await prisma.workflowStep.findMany({ where: { workflowRunId: runs[0]?.id }, orderBy: { startedAt: 'asc' }, select: { nodeId: true, agentRole: true, status: true, error: true } });
console.log("Steps:");
for (const s of steps) console.log(`  ${s.nodeId} (${s.agentRole}): ${s.status}${s.error ? ' ERR:' + s.error.substring(0,60) : ''}`);
await prisma.$disconnect();
