import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { IntegrationsModule } from './integrations.module';

/**
 * OpenAPI document of the integration API (Phase 5, Task 22), served at /api/docs
 * (JSON at /api/docs-json). Only the integration module is documented: it is the
 * contract external tools rely on; the rest of the API serves the web app.
 */
export function createIntegrationOpenApiDocument(app: INestApplication, include: Function[] = [IntegrationsModule]): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AI Corp Integration API')
    .setDescription(
      'Create projects, follow their agent workflow and export results from external tools. ' +
        'Authenticate with an API key (`x-api-key`) created under Integrations; its scopes decide which routes it may call. ' +
        'Requests are rate limited per key. Webhook deliveries are signed: verify `X-AICorp-Signature` = ' +
        '`sha256=HMAC_SHA256(secret, "<X-AICorp-Timestamp>.<raw body>")`.'
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config, { include });
}

export function setupIntegrationDocs(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, createIntegrationOpenApiDocument(app));
}
