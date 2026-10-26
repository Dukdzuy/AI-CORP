import { Injectable } from '@nestjs/common';

export type SnapshotLoader = (id: string) => Promise<unknown | null>;

/**
 * Loads the current state of a resource by type and id, so audited updates and deletes
 * can store before/after (Phase 5, Task 21). Feature modules register their own loader
 * at start-up; the audit module knows no resource types.
 *
 * @pattern Registry, Open/Closed
 */
@Injectable()
export class AuditSnapshotRegistry {
  private readonly loaders = new Map<string, SnapshotLoader>();

  register(resourceType: string, loader: SnapshotLoader): void {
    this.loaders.set(resourceType, loader);
  }

  async load(resourceType: string, id: string | undefined): Promise<unknown | null> {
    const loader = this.loaders.get(resourceType);
    if (!loader || !id) return null;
    try {
      return await loader(id);
    } catch {
      return null;
    }
  }

  supports(resourceType: string): boolean {
    return this.loaders.has(resourceType);
  }
}
