import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../../access/access.decorators';
import { Audited } from '../../audit/audit.decorators';
import { AuditSnapshotRegistry } from '../../audit/audit-snapshot.registry';
import { LlmProvidersService } from './llm-providers.service';
import { AddLlmModelsDto, CreateLlmProviderDto, UpdateLlmModelDto, UpdateLlmProviderDto } from './llm-providers.dto';

/**
 * LLM providers and their models, managed from the web app (admins only). API keys go in
 * and are never sent back: responses carry `hasApiKey` and a `••••last4` hint.
 */
@Controller('llm-providers')
@RequirePermission(Permission.AGENT_CONFIGURE)
export class LlmProvidersController {
  constructor(private readonly service: LlmProvidersService, snapshots: AuditSnapshotRegistry) {
    snapshots.register('LlmProvider', async id => (await this.service.list()).find(p => p.id === id) ?? null);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get('kinds')
  kinds() {
    return this.service.kinds();
  }

  @Post()
  @Audited({ action: 'llm_provider.create', resourceType: 'LlmProvider' })
  create(@Body() dto: CreateLlmProviderDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Audited({ action: 'llm_provider.update', resourceType: 'LlmProvider', idParam: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateLlmProviderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Audited({ action: 'llm_provider.delete', resourceType: 'LlmProvider', idParam: 'id' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.service.test(id);
  }

  @Get(':id/remote-models')
  remoteModels(@Param('id') id: string) {
    return this.service.remoteModels(id);
  }

  @Post(':id/models')
  @Audited({ action: 'llm_provider.models.add', resourceType: 'LlmProvider', idParam: 'id' })
  addModels(@Param('id') id: string, @Body() dto: AddLlmModelsDto) {
    return this.service.addModels(id, dto.models, dto.fromProvider);
  }

  @Patch(':id/models/:modelId')
  @Audited({ action: 'llm_provider.models.update', resourceType: 'LlmProvider', idParam: 'id' })
  updateModel(@Param('id') id: string, @Param('modelId') modelId: string, @Body() dto: UpdateLlmModelDto) {
    return this.service.updateModel(id, modelId, dto);
  }

  @Delete(':id/models/:modelId')
  @Audited({ action: 'llm_provider.models.delete', resourceType: 'LlmProvider', idParam: 'id' })
  removeModel(@Param('id') id: string, @Param('modelId') modelId: string) {
    return this.service.removeModel(id, modelId);
  }
}
