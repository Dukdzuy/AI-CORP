import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditSnapshotRegistry } from './audit-snapshot.registry';
import { AuditController } from './audit.controller';

/**
 * Audit trail (Phase 5, Task 21). Global so guards, event handlers and feature modules
 * can record entries and register snapshot loaders without importing it.
 */
@Global()
@Module({
  imports: [InfrastructureModule],
  controllers: [AuditController],
  providers: [AuditLogService, AuditSnapshotRegistry, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditLogService, AuditSnapshotRegistry],
})
export class AuditModule {}
