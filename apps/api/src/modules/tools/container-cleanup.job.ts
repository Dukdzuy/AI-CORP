import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Docker from 'dockerode';

/**
 * ContainerCleanupJob
 *
 * Scheduled job to remove orphaned sandbox containers that are older than 1 hour.
 * Prevents resource leaks from failed or abandoned tool executions.
 *
 * Implements Requirement 27.1: Container Cleanup
 */
@Injectable()
export class ContainerCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContainerCleanupJob.name);
  private docker: Docker;
  private readonly MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.docker = new Docker();
  }

  onModuleInit() {
    // Run cleanup every 15 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanedContainers();
    }, 15 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Remove sandbox containers older than 1 hour
   */
  async cleanupOrphanedContainers(): Promise<CleanupResult> {
    let cleaned = 0;
    let failed = 0;

    try {
      const containers = await this.docker.listContainers({ all: true });
      const sandboxContainers = containers.filter(
        (c) => c.Names.some((n) => n.startsWith('/sandbox-'))
      );

      const now = Date.now();

      for (const containerInfo of sandboxContainers) {
        const createdAt = containerInfo.Created * 1000;
        const age = now - createdAt;

        if (age > this.MAX_AGE_MS) {
          try {
            const container = this.docker.getContainer(containerInfo.Id);

            if (containerInfo.State === 'running') {
              await container.stop({ t: 5 });
            }

            await container.remove();
            cleaned++;
            this.logger.log(`Cleaned up orphaned container: ${containerInfo.Names[0]}`);
          } catch (error) {
            failed++;
            this.logger.warn(
              `Failed to cleanup container ${containerInfo.Names[0]}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }

      if (cleaned > 0 || failed > 0) {
        this.logger.log(
          `Container cleanup: ${cleaned} removed, ${failed} failed out of ${sandboxContainers.length} sandbox containers`
        );
      }

      return { cleaned, failed, total: sandboxContainers.length };
    } catch (error) {
      this.logger.error(
        `Container cleanup job failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { cleaned, failed, total: 0 };
    }
  }
}

interface CleanupResult {
  cleaned: number;
  failed: number;
  total: number;
}
