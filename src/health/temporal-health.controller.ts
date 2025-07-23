import { Controller, Get } from '@nestjs/common';
import { TemporalService } from '../services/temporal.service';
import { TemporalClientService } from '../services/temporal-client.service';
import { TemporalScheduleService } from '../services/temporal-schedule.service';
import { TemporalDiscoveryService } from '../services/temporal-discovery.service';
import { TemporalWorkerManagerService } from '../services/temporal-worker.service';
import { Optional } from '@nestjs/common';
import { SystemStatus, WorkerStatus, DiscoveryStats, ScheduleStats } from '../interfaces';

/**
 * Health check controller for Temporal components
 *
 * Provides comprehensive health monitoring endpoints for:
 * - Overall system health with all components
 * - Individual component health checks
 * - Detailed component status and statistics
 * - Discovery and schedule information
 */
@Controller('temporal/health')
export class TemporalHealthController {
    constructor(
        private readonly temporalService: TemporalService,
        private readonly clientService: TemporalClientService,
        private readonly scheduleService: TemporalScheduleService,
        private readonly discoveryService: TemporalDiscoveryService,
        @Optional() private readonly workerManager?: TemporalWorkerManagerService,
    ) {}

    /**
     * Get overall system health with all components
     * Returns aggregated health status and detailed component information
     */
    @Get()
    async getOverallHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        timestamp: string;
        uptime: number;
        version: string;
        components: {
            client: { status: string; healthy: boolean; details: object };
            worker: { status: string; available: boolean; details: object | null };
            discovery: { status: string; scheduled: number; details: DiscoveryStats };
            schedules: { status: string; active: number; errors: number; details: ScheduleStats };
        };
    }> {
        const overallHealth = await this.temporalService.getOverallHealth();
        const systemStatus = await this.temporalService.getSystemStatus();
        const discoveryStats = this.temporalService.getDiscoveryStats();
        const scheduleStats = this.scheduleService.getScheduleStats();
        const workerStatus = this.temporalService.getWorkerStatus();

        // Calculate uptime (simplified - in real app you'd track actual start time)
        const uptime = process.uptime();

        return {
            status: overallHealth.status,
            timestamp: new Date().toISOString(),
            uptime,
            version: process.env.npm_package_version || '3.0.10',
            components: {
                client: {
                    ...overallHealth.components.client,
                    details: {
                        connected: systemStatus.client.available,
                        healthy: systemStatus.client.healthy,
                        rawClientAvailable: this.clientService.getRawClient() !== null,
                    },
                },
                worker: {
                    ...overallHealth.components.worker,
                    details: workerStatus
                        ? {
                              ...workerStatus,
                              hasWorkerManager: this.workerManager !== undefined,
                          }
                        : null,
                },
                discovery: {
                    ...overallHealth.components.discovery,
                    scheduled: 0, // No scheduled workflows since scheduling was removed
                    details: discoveryStats,
                },
                schedules: {
                    status: 'inactive',
                    active: 0,
                    errors: 0,
                    details: scheduleStats,
                },
            },
        };
    }

    /**
     * Get detailed system status
     */
    @Get('system')
    async getSystemStatus(): Promise<SystemStatus> {
        return await this.temporalService.getSystemStatus();
    }

    /**
     * Get client health and connection status
     */
    @Get('client')
    async getClientHealth(): Promise<{
        healthy: boolean;
        connected: boolean;
        status: string;
        details: {
            rawClientAvailable: boolean;
            connectionTime?: number;
            lastError?: string;
        };
    }> {
        const isHealthy = this.clientService.isHealthy();
        const rawClient = this.clientService.getRawClient();
        const clientStatus = this.clientService.getStatus();

        return {
            healthy: isHealthy,
            connected: rawClient !== null,
            status: isHealthy ? 'connected' : 'disconnected',
            details: {
                rawClientAvailable: rawClient !== null,
                ...clientStatus,
            },
        };
    }

    /**
     * Get worker health and status (if worker manager is available)
     */
    @Get('worker')
    async getWorkerHealth(): Promise<{
        available: boolean;
        status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
        details: WorkerStatus | null;
        healthCheck?: {
            status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
            details?: unknown;
        };
    }> {
        const workerHealth = await this.temporalService.getWorkerHealth();
        const workerStatus = this.temporalService.getWorkerStatus();
        const hasWorker = this.temporalService.hasWorker();

        let healthCheckDetails;
        if (this.workerManager) {
            try {
                healthCheckDetails = await this.workerManager.healthCheck();
            } catch (error) {
                healthCheckDetails = {
                    status: 'unhealthy' as const,
                    details: { error: (error as Error).message },
                };
            }
        }

        return {
            available: hasWorker,
            status: workerHealth.status,
            details: workerStatus,
            healthCheck: healthCheckDetails,
        };
    }

    /**
     * Get discovery service health and statistics
     */
    @Get('discovery')
    async getDiscoveryHealth(): Promise<{
        status: string;
        healthy: boolean;
        stats: DiscoveryStats;
        scheduledWorkflows: never[]; // No scheduled workflows since scheduling was removed
        workflowNames: string[];
        scheduleIds: string[];
        healthDetails: {
            status: 'healthy' | 'degraded';
            discoveredItems: DiscoveryStats;
            lastDiscovery: Date | null;
        };
    }> {
        const stats = this.temporalService.getDiscoveryStats();
        const workflowNames = this.temporalService.getAvailableWorkflows();
        const healthStatus = this.discoveryService.getHealthStatus();

        return {
            status: stats.workflows > 0 ? 'active' : 'inactive',
            healthy: healthStatus.status === 'healthy',
            stats,
            scheduledWorkflows: [], // No scheduled workflows since scheduling was removed
            workflowNames,
            scheduleIds: [], // No schedule IDs since scheduling was removed
            healthDetails: healthStatus,
        };
    }

    /**
     * Get schedule service health and statistics
     */
    @Get('schedules')
    async getScheduleHealth(): Promise<{
        status: string;
        healthy: boolean;
        stats: ScheduleStats;
        serviceStatus: { available: boolean; healthy: boolean; schedulesSupported: boolean };
        scheduleIds: string[];
        scheduledWorkflows: never[]; // No scheduled workflows since scheduling was removed
    }> {
        const stats = this.scheduleService.getScheduleStats();
        const isHealthy = this.scheduleService.isHealthy();
        const scheduleStatus = this.scheduleService.getStatus();

        // Get all schedules information
        const scheduleIds: string[] = []; // No schedule IDs since scheduling was removed
        const scheduledWorkflows: never[] = []; // No scheduled workflows since scheduling was removed

        return {
            status: stats.active > 0 ? 'active' : 'inactive',
            healthy: isHealthy,
            stats,
            serviceStatus: scheduleStatus,
            scheduleIds,
            scheduledWorkflows,
        };
    }

    /**
     * Get liveness probe - simple endpoint for basic health check
     */
    @Get('live')
    async getLiveness(): Promise<{ status: 'ok'; timestamp: string }> {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get readiness probe - checks if all critical components are ready
     */
    @Get('ready')
    async getReadiness(): Promise<{
        ready: boolean;
        status: string;
        timestamp: string;
        checks: {
            client: boolean;
            discovery: boolean;
            schedules: boolean;
            worker?: boolean;
        };
    }> {
        const systemStatus = await this.temporalService.getSystemStatus();
        const _overallHealth = await this.temporalService.getOverallHealth();

        const checks = {
            client: systemStatus.client.healthy,
            schedules: this.scheduleService.isHealthy(), // Schedule service health
            discovery: systemStatus.discovery.workflows >= 0, // Always true if discovery service is working
            ...(this.temporalService.hasWorker() && {
                worker: systemStatus.worker.status?.isHealthy || false,
            }),
        };

        const ready = Object.values(checks).every(Boolean);

        return {
            ready,
            status: ready ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            checks,
        };
    }

    /**
     * Get startup probe - checks if application has started successfully
     */
    @Get('startup')
    async getStartup(): Promise<{
        started: boolean;
        status: string;
        timestamp: string;
        initializationTime?: number;
        components: {
            client: boolean;
            discovery: boolean;
            schedules: boolean;
            worker: boolean;
        };
    }> {
        const systemStatus = await this.temporalService.getSystemStatus();

        const components = {
            client: systemStatus.client.available,
            discovery: systemStatus.discovery.controllers >= 0,
            schedules: this.scheduleService.isHealthy(),
            worker: systemStatus.worker.available,
        };

        const started = components.client && components.discovery;

        return {
            started,
            status: started ? 'started' : 'starting',
            timestamp: new Date().toISOString(),
            initializationTime: process.uptime() * 1000, // Convert to milliseconds
            components,
        };
    }
}
