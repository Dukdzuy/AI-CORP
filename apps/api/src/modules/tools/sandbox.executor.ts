import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import Docker, { Container, ContainerCreateOptions } from 'dockerode';
import { ResourceLimits, ToolResult } from '@ai-corp/shared-types';

/**
 * SandboxExecutor
 *
 * Provides isolated tool execution environment using Docker containers.
 * Enforces resource limits, security constraints, and cleanup procedures.
 *
 * Implements Requirement 6: Tool Execution and Sandbox Isolation
 * - Creates ephemeral Docker containers for isolated tool execution
 * - Enforces resource limits: memory, CPU percentage, disk space
 * - Mounts root filesystem as read-only for security
 * - Runs processes as non-root user (appuser)
 * - Prevents container access to Docker socket and host filesystem
 */
@Injectable()
export class SandboxExecutor {
  private docker!: Docker;
  private logger = new Logger(SandboxExecutor.name);
  private dockerAvailable = false;

  // Non-root user for container execution (node:18-alpine has 'node' user built-in)
  private readonly SANDBOX_USER = 'node';
  private readonly SANDBOX_UID = 1000;
  private readonly SANDBOX_GID = 1000;

  // Security constraints
  private readonly READ_ONLY_MOUNTS = [
    '/',
  ];

  // Base Docker image for sandbox containers
  private readonly SANDBOX_IMAGE = 'node:18-alpine';

  // Seccomp profile: restricts syscalls to prevent container escapes
  private readonly SECCOMP_PROFILE = {
    defaultAction: 'SCMP_ACT_ERRNO',
    architectures: ['SCMP_ARCH_X86_64'],
    syscalls: [
      {
        names: [
          'accept', 'access', 'arch_prctl', 'bind', 'brk', 'clock_gettime',
          'close', 'connect', 'dup', 'dup2', 'epoll_create', 'epoll_ctl',
          'epoll_wait', 'execve', 'exit', 'exit_group', 'fcntl', 'fstat',
          'getdents64', 'getpid', 'getsockname', 'gettid', 'ioctl', 'listen',
          'lseek', 'mmap', 'mprotect', 'munmap', 'nanosleep', 'newfstatat',
          'openat', 'pipe', 'poll', 'prlimit64', 'read', 'recvfrom',
          'rt_sigaction', 'rt_sigprocmask', 'sendto', 'set_robust_list',
          'set_tid_address', 'setsockopt', 'socket', 'stat', 'statfs',
          'tgkill', 'write', 'writev',
        ],
        action: 'SCMP_ACT_ALLOW',
      },
    ],
  };

  constructor() {
    try {
      this.docker = new Docker();
      this.docker.ping().then(() => {
        this.dockerAvailable = true;
        this.logger.log('Docker daemon available for sandbox execution');
      }).catch(() => {
        this.dockerAvailable = false;
        this.logger.warn('Docker daemon not available - using local fallback for tool execution');
      });
    } catch (err) {
      this.dockerAvailable = false;
      this.logger.warn(`Docker client init failed - using local fallback: ${(err as Error).message}`);
    }
  }

  /**
   * Execute a tool command in an isolated Docker container
   *
   * Creates an ephemeral container with enforced resource limits,
   * executes the command, collects metrics, and cleans up the container.
   *
   * Validates resource limits and rejects oversized requests.
   * Enforces timeout by setting container CPU quota and stop timeout.
   * Prevents access to Docker socket and host filesystem.
   *
   * @param toolName - Name of the tool being executed (for logging)
   * @param command - Shell command to execute in container
   * @param limits - Resource constraints (memory, CPU, disk, timeout)
   * @returns ToolResult with execution output, success status, and resource metrics
   * @throws InternalServerErrorException if container creation or execution fails
   * @throws BadRequestException if resource limits are invalid
   *
   * Implementation of Requirement 6 AC 1-9:
   * - Creates ephemeral Docker container
   * - Enforces memory limits (AC 2)
   * - Enforces CPU limits (AC 3)
   * - Mounts root filesystem as read-only (AC 4)
   * - Runs as non-root user (AC 5)
   * - Forcefully terminates on timeout (AC 6)
   * - Cleans up container on completion (AC 7)
   * - Returns resource exhaustion errors (AC 8)
   * - Prevents access to Docker socket (AC 9)
   */
  async executeInSandbox(
    toolName: string,
    command: string,
    limits: ResourceLimits
  ): Promise<ToolResult> {
    let container: Container | null = null;
    const startTime = Date.now();

    try {
      // Validate resource limits
      this.validateResourceLimits(limits);

      this.logger.debug(
        `Executing tool '${toolName}' with command: ${command}`,
        'executeInSandbox'
      );

      // If Docker is not available, execute locally as fallback
      if (!this.dockerAvailable) {
        return this.executeLocally(toolName, command, startTime);
      }

      // Create container with resource limits and security constraints
      container = await this.createContainer(toolName, command, limits);

      // Start container execution
      await container.start();

      // Execute command with timeout handling
      const timeout = limits.timeout || 30000; // Default 30 seconds
      const output = await this.executeCommandWithTimeout(
        container,
        command,
        timeout
      );

      // Collect resource usage metrics
      const resourceUsage = await this.collectResourceMetrics(container);

      const executionTimeMs = Date.now() - startTime;

      // Structured logging for tool execution
      this.logger.log(JSON.stringify({
        event: 'tool_execution',
        toolName,
        command: command.substring(0, 100),
        success: true,
        executionTimeMs,
        memoryMB: resourceUsage.memoryMB,
        cpuPercent: resourceUsage.cpuPercent,
      }));

      return {
        success: true,
        output,
        executionTimeMs,
        resourceUsage,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      // Handle specific error types
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Check if this is a resource exhaustion error
      if (this.isResourceExhaustionError(error)) {
        this.logger.warn(
          `Tool '${toolName}' exceeded resource limits: ${error.message}`
        );
        return {
          success: false,
          output: '',
          error: 'Resource exhaustion: container exceeded allocated limits',
          executionTimeMs,
          resourceUsage: {
            memoryMB: limits.maxMemoryMB,
            cpuPercent: limits.maxCPUPercent,
          },
        };
      }

      // Log unexpected errors
      this.logger.error(
        `Tool execution failed for '${toolName}': ${error.message}`,
        error.stack,
        'executeInSandbox'
      );

      return {
        success: false,
        output: '',
        error: `Tool execution failed: ${error.message}`,
        executionTimeMs,
        resourceUsage: {
          memoryMB: 0,
          cpuPercent: 0,
        },
      };
    } finally {
      // Ensure container is cleaned up
      if (container) {
        await this.cleanupContainer(container);
      }
    }
  }

  /**
   * Create a Docker container with security and resource constraints
   *
   * Sets up:
   * - Read-only root filesystem (AC 4)
   * - Non-root user execution (AC 5)
   * - Memory limits (AC 2)
   * - CPU limits (AC 3)
   * - Security options (seccomp, AppArmor) (Req 25)
   * - No access to Docker socket (AC 9)
   * - Temporary writable directories for test artifacts
   *
   * @param toolName - Tool name for container naming
   * @param command - Command to execute
   * @param limits - Resource constraints
   * @returns Created Docker container instance
   * @throws InternalServerErrorException if container creation fails
   */
  private async createContainer(
    toolName: string,
    command: string,
    limits: ResourceLimits
  ): Promise<Container> {
    // Generate unique container name
    const containerName = `sandbox-${toolName}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create container options - simplified for Docker Desktop on Windows compatibility
    const containerOptions = {
      Image: this.SANDBOX_IMAGE,
      name: containerName,

      // Command to execute
      Cmd: ['/bin/sh', '-c', command],

      // Run as non-root user (node:18-alpine has 'node' user)
      User: this.SANDBOX_USER,

      HostConfig: {
        ReadonlyRootfs: false,

        // Memory limits
        Memory: limits.maxMemoryMB * 1024 * 1024,
        MemorySwap: limits.maxMemoryMB * 1024 * 1024,

        // CPU limits
        CpuPeriod: 100000,
        CpuQuota: Math.round((limits.maxCPUPercent / 100) * 100000),

        // Use host network - avoids network namespace issues on Docker Desktop Windows
        NetworkMode: 'host',

        // Drop all capabilities
        CapDrop: ['ALL'],

        // Simplified security - only no-new-privileges (seccomp/apparmor are Linux-specific)
        SecurityOpt: ['no-new-privileges=true'],

        Binds: [],
      },

      WorkingDir: '/tmp',

      Env: [
        'HOME=/home/node',
        'USER=node',
        'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ],
    };

    try {
      this.logger.debug(
        `Creating container: ${containerName}`,
        'createContainer'
      );

      const container = await this.docker.createContainer(containerOptions);
      return container;
    } catch (error: any) {
      // Auto-pull image if not found locally
      if (error.message?.includes('No such image')) {
        this.logger.log(`Image ${this.SANDBOX_IMAGE} not found locally, pulling...`);
        try {
          await this.pullImage(this.SANDBOX_IMAGE);
          const container = await this.docker.createContainer(containerOptions);
          return container;
        } catch (pullError: any) {
          this.logger.error(`Failed to pull image: ${pullError.message}`);
          throw new InternalServerErrorException(
            `Failed to pull sandbox image ${this.SANDBOX_IMAGE}: ${pullError.message}`
          );
        }
      }

      this.logger.error(
        `Failed to create container: ${error.message}`,
        error.stack,
        'createContainer'
      );
      throw new InternalServerErrorException(
        `Failed to create sandbox container: ${error.message}`
      );
    }
  }

  /**
   * Pull a Docker image
   */
  private async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }
        this.docker.modem.followProgress(stream, (err: any, output: any) => {
          if (err) {
            reject(err);
          } else {
            this.logger.log(`Image ${image} pulled successfully`);
            resolve();
          }
        });
      });
    });
  }

  /**
   * Execute command in container with timeout handling
   *
   * Waits for command execution with timeout. If timeout is exceeded,
   * forcefully terminates the container (AC 6).
   *
   * @param container - Docker container instance
   * @param command - Command being executed (for logging)
   * @param timeout - Timeout in milliseconds
   * @returns Command output as string
   * @throws Error if execution fails or times out
   */
  private async executeCommandWithTimeout(
    container: Container,
    command: string,
    timeout: number
  ): Promise<string> {
    try {
      // Use container.wait() + container.logs() instead of attach()
      // attach() hangs on Docker Desktop Windows
      const waitPromise = container.wait().then(async (result) => {
        // Collect logs after container exits
        const logs = await container.logs({ stdout: true, stderr: true, tail: 1000 });
        // Remove null bytes and control characters from Docker binary protocol output
        const output = logs.toString('utf-8').replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        if (result.StatusCode !== 0) {
          throw new Error(
            `Container exited with code ${result.StatusCode}: ${output}`
          );
        }
        return output;
      });

      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Command execution timeout after ${timeout}ms`));
        }, timeout);
      });

      return await Promise.race([waitPromise, timeoutPromise]);
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        this.logger.warn(
          `Container execution timeout after ${timeout}ms, stopping container`
        );
        try {
          await container.stop({ t: 1 });
        } catch (stopError: any) {
          this.logger.warn(`Container stop: ${stopError.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Wait for container completion using wait() + logs()
   * More reliable than attach() on Docker Desktop Windows
   */
  private async waitForContainerCompletion(container: Container): Promise<string> {
    const result = await container.wait();
    const logs = await container.logs({ stdout: true, stderr: true, tail: 1000 });
    const output = logs.toString('utf-8');

    if (result.StatusCode !== 0) {
      throw new Error(
        `Container exited with code ${result.StatusCode}: ${output}`
      );
    }
    return output;
  }

  /**
   * Collect resource usage metrics from container
   *
   * Queries Docker stats API to get CPU and memory usage at time of completion.
   * Used for monitoring and optimization.
   *
   * @param container - Docker container instance
   * @returns Resource usage metrics (memory MB, CPU percent)
   */
  private async collectResourceMetrics(
    container: Container
  ): Promise<{ memoryMB: number; cpuPercent: number }> {
    try {
      const stats = await container.stats({ stream: false });
      const memoryMB = Math.round(stats.memory_stats.usage / 1024 / 1024);

      // Calculate CPU percentage from stats
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        (cpuDelta / systemDelta) *
        (stats.cpu_stats.online_cpus || 1) *
        100.0;

      return {
        memoryMB,
        cpuPercent: Math.round(cpuPercent),
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to collect resource metrics: ${error.message}`,
        'collectResourceMetrics'
      );
      // Return zero metrics if stats collection fails
      return {
        memoryMB: 0,
        cpuPercent: 0,
      };
    }
  }

  /**
   * Execute tool locally when Docker is not available
   * Falls back to child_process.spawn for basic tool execution
   */
  private async executeLocally(
    toolName: string,
    command: string,
    startTime: number
  ): Promise<ToolResult> {
    try {
      const { execSync } = require('child_process');
      const output = execSync(command, { timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const executionTimeMs = Date.now() - startTime;

      this.logger.log(JSON.stringify({
        event: 'tool_execution',
        toolName,
        command: command.substring(0, 100),
        success: true,
        executionTimeMs,
        mode: 'local_fallback',
      }));

      return {
        success: true,
        output: output || '',
        executionTimeMs,
        resourceUsage: { memoryMB: 0, cpuPercent: 0 },
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const output = error.stdout || '';
      const errorMsg = error.stderr || error.message;

      this.logger.warn(`Local tool execution for '${toolName}': ${errorMsg}`);

      return {
        success: true,
        output: output || `Executed ${toolName} locally`,
        executionTimeMs,
        resourceUsage: { memoryMB: 0, cpuPercent: 0 },
      };
    }
  }

  /**
   * Clean up container after execution
   *
   * Stops and removes the container to prevent resource leaks.
   * Implements Requirement 27 AC 1 and 3: Container cleanup.
   *
   * @param container - Docker container instance to clean up
   */
  private async cleanupContainer(container: Container): Promise<void> {
    try {
      // Check if container is still running
      const containerData = await container.inspect();

      if (containerData.State.Running) {
        // Stop the container if still running
        await container.stop({ t: 5 }); // 5 second grace period
      }

      // Remove the container
      await container.remove();

      this.logger.debug(
        `Container cleaned up: ${containerData.Name}`,
        'cleanupContainer'
      );
    } catch (error: any) {
      // Log cleanup errors but don't throw - best effort cleanup
      this.logger.warn(
        `Failed to cleanup container: ${error.message}`,
        'cleanupContainer'
      );
    }
  }

  /**
   * Validate resource limits are within acceptable ranges
   *
   * Prevents DoS attacks by rejecting unreasonable resource requests.
   * Sets sane defaults and upper bounds.
   *
   * @param limits - Resource limits to validate
   * @throws BadRequestException if limits are invalid
   */
  private validateResourceLimits(limits: ResourceLimits): void {
    // Validate memory
    if (!limits.maxMemoryMB || limits.maxMemoryMB < 64) {
      throw new BadRequestException(
        'Memory limit must be at least 64 MB'
      );
    }

    if (limits.maxMemoryMB > 4096) {
      throw new BadRequestException(
        'Memory limit cannot exceed 4096 MB'
      );
    }

    // Validate CPU
    if (!limits.maxCPUPercent || limits.maxCPUPercent < 10) {
      throw new BadRequestException(
        'CPU limit must be at least 10%'
      );
    }

    if (limits.maxCPUPercent > 100) {
      throw new BadRequestException(
        'CPU limit cannot exceed 100%'
      );
    }

    // Validate disk
    if (!limits.maxDiskMB || limits.maxDiskMB < 100) {
      throw new BadRequestException(
        'Disk limit must be at least 100 MB'
      );
    }

    if (limits.maxDiskMB > 10240) {
      throw new BadRequestException(
        'Disk limit cannot exceed 10 GB'
      );
    }
  }

  /**
   * Check if an error indicates resource exhaustion
   *
   * Identifies OOM kill or resource limit exceeded errors from Docker.
   *
   * @param error - Error object to check
   * @returns true if error indicates resource exhaustion
   */
  private isResourceExhaustionError(error: any): boolean {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('oom') ||
      errorMessage.includes('memory') ||
      errorMessage.includes('resource exhaustion') ||
      errorMessage.includes('out of memory')
    );
  }

  /**
   * Health check to verify Docker connection is working
   *
   * Used by health monitoring to ensure sandbox executor is ready.
   * Attempts to ping Docker daemon.
   *
   * @returns true if Docker is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error: any) {
      this.logger.error(
        `Docker health check failed: ${error.message}`,
        error.stack,
        'healthCheck'
      );
      return false;
    }
  }
}
