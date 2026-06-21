import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import axios from 'axios';

@Injectable()
export class NineRouterHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NineRouterHealthService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isCircuitOpen = false;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly NINE_ROUTER_URL = (process.env.NINE_ROUTER_URL || 'http://localhost:20128').replace(/\/v1\/?$/, '');

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing NineRouterHealthService');
    try {
      // Ensure the gateway status record exists
      await this.ensureGatewayStatusRecord();
    } catch (err) {
      this.logger.warn(`Gateway status init skipped (DB may be unavailable): ${(err as Error).message}`);
    }
    
    // Initial health check
    try {
      await this.checkHealth();
    } catch (err) {
      this.logger.warn(`Initial health check skipped: ${(err as Error).message}`);
    }
    
    // Schedule periodic health checks every 30 seconds
    this.intervalId = setInterval(async () => {
      await this.checkHealth();
    }, 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Performs the health check against NineRouter.
   * If it fails, increments consecutive failures. 
   * If it succeeds, resets consecutive failures.
   */
  async checkHealth(): Promise<void> {
    let status = 'online';
    let errorMessage = '';

    try {
      // Assuming a generic /health or ping endpoint for 9Router
      await axios.get(`${this.NINE_ROUTER_URL}/api/health`, { timeout: 5000 });
      await this.handleSuccess();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`NineRouter health check failed: ${errorMessage}`);
      await this.handleFailure(errorMessage);
    }
  }

  private async handleSuccess(): Promise<void> {
    if (this.isCircuitOpen) {
      this.logger.log('NineRouter is back online. Closing circuit breaker.');

      // Emit WebSocket notification when circuit breaker closes
      this.websocketGateway.broadcastEvent({
        type: 'health:circuit_breaker_closed',
        payload: {
          service: 'ninerouter',
          status: 'online',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    this.isCircuitOpen = false;

    try {
      await this.prisma.lLMGatewayStatus.upsert({
        where: { gatewayName: 'ninerouter' },
        update: {
          status: 'online',
          lastHealthCheck: new Date(),
          consecutiveFailures: 0,
          metadata: { lastSuccess: new Date().toISOString() },
        },
        create: {
          gatewayName: 'ninerouter',
          status: 'online',
          lastHealthCheck: new Date(),
          consecutiveFailures: 0,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to update gateway status in DB: ${(err as Error).message}`);
    }
  }

  private async handleFailure(errorMsg: string): Promise<void> {
    let currentFailures = 1;
    try {
      const record = await this.prisma.lLMGatewayStatus.findUnique({
        where: { gatewayName: 'ninerouter' },
      });
      currentFailures = (record?.consecutiveFailures || 0) + 1;
    } catch (err) {
      this.logger.warn(`Failed to read gateway status from DB: ${(err as Error).message}`);
    }
    let newStatus = currentFailures >= this.FAILURE_THRESHOLD ? 'offline' : 'degraded';

    if (newStatus === 'offline' && !this.isCircuitOpen) {
      this.logger.error(`NineRouter failure threshold reached (${this.FAILURE_THRESHOLD}). Opening circuit breaker!`);
      this.isCircuitOpen = true;

      // Emit WebSocket notification when circuit breaker opens
      this.websocketGateway.broadcastEvent({
        type: 'health:circuit_breaker_opened',
        payload: {
          service: 'ninerouter',
          status: 'offline',
          consecutiveFailures: currentFailures,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        },
      });
    } else if (newStatus === 'degraded') {
      // Emit WebSocket notification when service degrades
      this.websocketGateway.broadcastEvent({
        type: 'health:service_degraded',
        payload: {
          service: 'ninerouter',
          status: 'degraded',
          consecutiveFailures: currentFailures,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      await this.prisma.lLMGatewayStatus.upsert({
        where: { gatewayName: 'ninerouter' },
        update: {
          status: newStatus,
          lastHealthCheck: new Date(),
          consecutiveFailures: currentFailures,
          metadata: { lastError: errorMsg, lastErrorTime: new Date().toISOString() },
        },
        create: {
          gatewayName: 'ninerouter',
          status: newStatus,
          lastHealthCheck: new Date(),
          consecutiveFailures: currentFailures,
          metadata: { lastError: errorMsg, lastErrorTime: new Date().toISOString() },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to update gateway status in DB: ${(err as Error).message}`);
    }
  }

  /**
   * Returns true if the circuit breaker is open, meaning traffic should be routed to fallback.
   */
  getIsCircuitOpen(): boolean {
    return this.isCircuitOpen;
  }

  private async ensureGatewayStatusRecord(): Promise<void> {
    const record = await this.prisma.lLMGatewayStatus.findUnique({
      where: { gatewayName: 'ninerouter' },
    });

    if (!record) {
      await this.prisma.lLMGatewayStatus.create({
        data: {
          gatewayName: 'ninerouter',
          status: 'online',
          lastHealthCheck: new Date(),
          consecutiveFailures: 0,
        },
      });
    } else {
      // Restore circuit breaker state from database on startup
      this.isCircuitOpen = record.status === 'offline';
    }
  }
}
