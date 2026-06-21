import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WorkflowEngine } from './modules/workflow/workflow.engine';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

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
