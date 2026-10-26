import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WorkflowEngine } from './modules/workflow/workflow.engine';
import { setupIntegrationDocs } from './modules/integrations/openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;

  app.setGlobalPrefix('api');
  // Content-Disposition is exposed so the web app can name the project zip download
  app.enableCors({ exposedHeaders: ['Content-Disposition'] });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Integration API documentation (Phase 5, Task 22)
  setupIntegrationDocs(app);

  // Recover any running workflows after restart
  try {
    const workflowEngine = app.get(WorkflowEngine);
    await workflowEngine.recoverWorkflows();
  } catch (err) {
    console.warn(`Workflow recovery skipped: ${(err as Error).message}`);
  }

  await app.listen(port);
  console.log(`API Server running on port ${port}`);
}

bootstrap();
