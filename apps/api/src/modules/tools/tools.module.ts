import { Module } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { SandboxExecutor } from './sandbox.executor';
import { ContainerCleanupJob } from './container-cleanup.job';

/**
 * Tools Module
 *
 * Provides the tool execution and registration infrastructure for the AI Corp Platform.
 * Exports the ToolRegistry service which manages tool registration and role-based access control,
 * and the SandboxExecutor service which handles isolated tool execution in Docker containers.
 *
 * This module is responsible for:
 * - Maintaining the registry of available tools
 * - Enforcing role-based access control for tool execution
 * - Providing tool definitions to agents
 * - Executing tools in isolated Docker sandbox containers with resource limits
 * - Cleaning up orphaned sandbox containers periodically
 */
@Module({
  providers: [ToolRegistry, SandboxExecutor, ContainerCleanupJob],
  exports: [ToolRegistry, SandboxExecutor],
})
export class ToolsModule {}
