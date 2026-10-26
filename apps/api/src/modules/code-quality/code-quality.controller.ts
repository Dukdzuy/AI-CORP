import { Controller, Get, Param } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { CodeQualityService } from './code-quality.service';

/**
 * Code quality of a project's generated code (Phase 6, Task 26).
 */
@Controller('projects/:id/code-quality')
export class CodeQualityController {
  constructor(private readonly quality: CodeQualityService) {}

  @Get()
  @RequirePermission(Permission.REPORT_VIEW)
  assess(@Param('id') id: string) {
    return this.quality.assessProject(id);
  }
}
