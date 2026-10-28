import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { AuditSnapshotRegistry } from '../audit/audit-snapshot.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmProvidersService } from './providers/llm-providers.service';
import { AssignAgentModelDto } from './providers/llm-providers.dto';

@Controller('models')
export class ModelsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmProviders: LlmProvidersService,
    snapshots: AuditSnapshotRegistry
  ) {
    // Agent model changes are audited with before/after (Task 21)
    snapshots.register('Agent', role => this.prisma.agent.findUnique({
      where: { role: role.toUpperCase() },
      select: { role: true, name: true, modelRouteConfig: true, isActive: true },
    }));
  }

  @Get()
  async listModels() {
    const agents = await this.prisma.agent.findMany({
      select: { role: true, name: true, modelRouteConfig: true, isActive: true },
      orderBy: { role: 'asc' },
    });
    return agents;
  }

  /** Enabled models of the providers configured on the Providers page */
  @Get('available')
  listAvailableModels() {
    return this.llmProviders.modelOptions();
  }

  @Patch(':role')
  @RequirePermission(Permission.AGENT_CONFIGURE)
  @Audited({ action: 'agent.configure', resourceType: 'Agent', idParam: 'role' })
  updateAgentModel(@Param('role') role: string, @Body() body: AssignAgentModelDto) {
    return this.llmProviders.assignAgentModel(role, body);
  }
}
