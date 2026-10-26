import { Injectable } from '@nestjs/common';
import { ExportedFile, IProjectExporter, ProjectExportSnapshot, exportBaseName } from '../../domain/reporting';

/** Full snapshot as pretty JSON: the machine-readable export (Phase 5, Task 23) */
@Injectable()
export class JsonProjectExporter implements IProjectExporter {
  readonly format = 'json' as const;

  async export(snapshot: ProjectExportSnapshot): Promise<ExportedFile> {
    return {
      content: Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8'),
      contentType: 'application/json; charset=utf-8',
      fileName: `${exportBaseName(snapshot)}.json`,
    };
  }
}
