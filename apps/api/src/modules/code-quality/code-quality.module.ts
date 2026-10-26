import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CODE_ANALYZER } from '../../domain/quality';
import { TypeScriptCodeAnalyzer } from '../../infrastructure/code-analysis/TypeScriptCodeAnalyzer';
import { CodeQualityService } from './code-quality.service';
import { CodeQualityController } from './code-quality.controller';

/**
 * Code quality analysis (Phase 6, Task 26). Used by the DEV agent (refinement) and the
 * project's Reports tab.
 */
@Module({
  imports: [WorkspaceModule],
  controllers: [CodeQualityController],
  providers: [CodeQualityService, { provide: CODE_ANALYZER, useClass: TypeScriptCodeAnalyzer }],
  exports: [CodeQualityService],
})
export class CodeQualityModule {}
