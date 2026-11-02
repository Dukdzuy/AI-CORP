-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiKeyLast4" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmProvider_name_key" ON "LlmProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LlmModel_providerId_modelId_key" ON "LlmModel"("providerId", "modelId");

-- AddForeignKey
ALTER TABLE "LlmModel" ADD CONSTRAINT "LlmModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

