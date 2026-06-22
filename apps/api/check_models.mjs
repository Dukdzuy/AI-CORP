import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const runs = await prisma.workflowRun.findMany({
  where: { projectId: "e94162a7-90a1-4c3e-b4c7-1731df4985f0" },
  take: 3,
});

console.log("Workflow runs:");
for (const run of runs) {
  console.log(`  Status: ${run.status}, Node: ${run.currentNodeId}, Started: ${run.startedAt}`);
}

const agents = await prisma.agent.findMany({
  select: { role: true, modelRouteConfig: true },
});

console.log("\nAgent models:");
for (const agent of agents) {
  const config = agent.modelRouteConfig;
  console.log(`  ${agent.role}: ${config.model}`);
}

await prisma.$disconnect();
