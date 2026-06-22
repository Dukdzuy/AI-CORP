import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const runs = await prisma.workflowRun.findMany({
  where: { projectId: "8c8558d1-9adf-4e8c-8759-cc775fba2e1f" },
  take: 10,
});

console.log("Workflow runs for project:");
console.log(JSON.stringify(runs, null, 2));

const allRuns = await prisma.workflowRun.findMany({ take: 5 });
console.log("\nAll workflow runs (last 5):");
console.log(JSON.stringify(allRuns, null, 2));

await prisma.$disconnect();
