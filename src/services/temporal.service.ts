import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    TemporalOptions,
    WorkflowStartOptions,
    ServiceHealth,
    DiscoveryStats,
    WorkerStatus,
    ActivityMethodInfo,
    ScheduleCreateOptions,
    OverlapPolicy,
    MetadataInfo,
} from '../interfaces';
import { TemporalClientService } from './temporal-client.service';
import { TemporalWorkerManagerService } from './temporal-worker.service';
import { TemporalScheduleService } from './temporal-schedule.service';
import { TemporalActivityService } from './temporal-activity.service';
import { TemporalDiscoveryService } from './temporal-discovery.service';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import { TemporalLogger } from '../utils/logger';
import { DEFAULT_TASK_QUEUE } from '../constants';

/**
 * Main unified service for Temporal operations
 * Provides a single interface to access all Temporal functionality
 */
@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TemporalService.name);
    private readonly temporalLogger = new TemporalLogger(TemporalService.name);
    private isInitialized = false;
    private shutdownPromise: Promise<void> | null = null;

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        private readonly clientService: TemporalClientService,
        private readonly workerService: TemporalWorkerManagerService,
        private readonly scheduleService: TemporalScheduleService,
        private readonly activityService: TemporalActivityService,
        private readonly discoveryService: TemporalDiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {}

    /**
     * Initialize the unified service
     */
    async onModuleInit(): Promise<void> {
        try {
            this.logger.log('Initializing Temporal Service...');

            // Wait for all individual services to initialize
            await this.waitForServicesInitialization();

            // Mark this service as initialized
            this.isInitialized = true;

            this.logger.log('Temporal Service initialized successfully');
            await this.logInitializationSummary();
        } catch (error) {
            this.logger.error(
                `Failed to initialize Temporal Service: ${this.extractErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Cleanup on module destroy
     */
    async onModuleDestroy(): Promise<void> {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = this.performShutdown();
        return this.shutdownPromise;
    }

    /**
     * Wait for all services to initialize
     */
    private async waitForServicesInitialization(): Promise<void> {
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Check if all critical services are ready
                const clientReady = this.clientService.isHealthy();
                const discoveryReady = this.discoveryService.getHealthStatus().isComplete;

                if (clientReady && discoveryReady) {
                    this.logger.debug('All services are ready');
                    return;
                }

                // Wait a bit before checking again
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                this.logger.warn('Service readiness check failed', error);
            }
        }

        this.logger.warn('Service initialization timeout - continuing anyway');
    }

    /**
     * Perform graceful shutdown
     */
    private async performShutdown(): Promise<void> {
        try {
            this.logger.log('Shutting down Temporal Service...');

            // Stop worker if running
            if (this.workerService && this.workerService.isWorkerRunning()) {
                await this.workerService.stopWorker();
            }

            this.isInitialized = false;
            this.logger.log('Temporal Service shut down successfully');
        } catch (error) {
            this.logger.error(`Error during service shutdown: ${this.extractErrorMessage(error)}`);
        } finally {
            this.shutdownPromise = null;
        }
    }

    // =================== CLIENT OPERATIONS ===================

    /**
     * Start a workflow execution
     */
    async startWorkflow<T = unknown>(
        workflowType: string,
        args?: unknown[],
        options?: WorkflowStartOptions,
    ): Promise<T> {
        this.ensureInitialized();
        const enhancedOptions = this.enhanceWorkflowOptions(options || {});
        return this.clientService.startWorkflow(
            workflowType,
            args || [],
            enhancedOptions,
        ) as Promise<T>;
    }

    /**
     * Signal a workflow
     */
    async signalWorkflow(workflowId: string, signalName: string, args?: unknown[]): Promise<void> {
        if (!workflowId || workflowId.trim() === '') {
            throw new Error('Workflow ID is required');
        }
        this.ensureInitialized();
        return this.clientService.signalWorkflow(workflowId, signalName, args || []);
    }

    /**
     * Query a workflow
     */
    async queryWorkflow<T = unknown>(
        workflowId: string,
        queryName: string,
        args?: unknown[],
    ): Promise<T> {
        if (!workflowId || workflowId.trim() === '') {
            throw new Error('Workflow ID is required');
        }
        this.ensureInitialized();
        return this.clientService.queryWorkflow(workflowId, queryName, args || []);
    }

    /**
     * Get workflow handle
     */
    async getWorkflowHandle<T = unknown>(workflowId: string, runId?: string): Promise<T> {
        this.ensureInitialized();
        const handle = this.clientService.getWorkflowHandle(workflowId, runId);
        return handle as unknown as Promise<T>;
    }

    /**
     * Terminate a workflow
     */
    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        this.ensureInitialized();
        return this.clientService.terminateWorkflow(workflowId, reason);
    }

    /**
     * Cancel a workflow
     */
    async cancelWorkflow(workflowId: string): Promise<void> {
        this.ensureInitialized();
        return this.clientService.cancelWorkflow(workflowId);
    }

    // =================== WORKER OPERATIONS ===================

    /**
     * Start the worker
     */
    async startWorker(): Promise<void> {
        this.ensureInitialized();
        return this.workerService.startWorker();
    }

    /**
     * Stop the worker
     */
    async stopWorker(): Promise<void> {
        this.ensureInitialized();
        return this.workerService.stopWorker();
    }

    /**
     * Restart the worker
     */
    async restartWorker(): Promise<void> {
        this.ensureInitialized();
        if (!this.workerService) {
            throw new Error('Worker manager not available');
        }
        return this.workerService.restartWorker();
    }

    /**
     * Get worker status
     */
    getWorkerStatus(): WorkerStatus | null {
        this.ensureInitialized();
        if (!this.workerService) {
            return null;
        }
        return this.workerService.getStatus();
    }

    /**
     * Check if worker is running
     */
    isWorkerRunning(): boolean {
        this.ensureInitialized();
        const status = this.workerService.getWorkerStatus();
        return status.isRunning;
    }

    /**
     * Check if worker is available
     */
    hasWorker(): boolean {
        return this.workerService?.isWorkerAvailable() || false;
    }

    /**
     * Check if a workflow exists
     */
    hasWorkflow(workflowType: string): boolean {
        this.ensureInitialized();
        return this.discoveryService.hasWorkflow(workflowType);
    }

    // =================== SCHEDULE OPERATIONS ===================

    /**
     * Create a new schedule
     */
    async createSchedule(options: ScheduleCreateOptions): Promise<unknown> {
        this.ensureInitialized();
        return this.scheduleService.createSchedule(options);
    }

    /**
     * Get a schedule
     */
    async getSchedule(scheduleId: string): Promise<unknown> {
        this.ensureInitialized();
        return this.scheduleService.getSchedule(scheduleId);
    }

    /**
     * Update a schedule
     */
    async updateSchedule(
        scheduleId: string,
        updater: (schedule: Record<string, unknown>) => void,
    ): Promise<void> {
        this.ensureInitialized();
        return this.scheduleService.updateSchedule(scheduleId, updater);
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        this.ensureInitialized();
        return this.scheduleService.deleteSchedule(scheduleId);
    }

    /**
     * Pause a schedule
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureInitialized();
        return this.scheduleService.pauseSchedule(scheduleId, note);
    }

    /**
     * Unpause a schedule
     */
    async unpauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureInitialized();
        return this.scheduleService.unpauseSchedule(scheduleId, note);
    }

    /**
     * Trigger a schedule
     */
    async triggerSchedule(scheduleId: string, overlap?: OverlapPolicy): Promise<void> {
        this.ensureInitialized();
        return this.scheduleService.triggerSchedule(scheduleId, overlap);
    }

    // =================== ACTIVITY OPERATIONS ===================

    /**
     * Execute an activity
     */
    async executeActivity(name: string, ...args: unknown[]): Promise<unknown> {
        this.ensureInitialized();
        return this.activityService.executeActivity(name, ...args);
    }

    /**
     * Get activity by name
     */
    getActivity(name: string): Function | undefined {
        this.ensureInitialized();
        return this.activityService.getActivity(name);
    }

    /**
     * Get all activities
     */
    getAllActivities(): Record<string, Function> {
        this.ensureInitialized();
        return this.activityService.getAllActivities();
    }

    /**
     * Check if activity exists
     */
    hasActivity(name: string): boolean {
        this.ensureInitialized();
        return this.activityService.hasActivity(name);
    }

    /**
     * Get activity names
     */
    getActivityNames(): string[] {
        this.ensureInitialized();
        return this.activityService.getActivityNames();
    }

    // =================== DISCOVERY OPERATIONS ===================

    /**
     * Get discovery statistics
     */
    getDiscoveryStats(): DiscoveryStats {
        this.ensureInitialized();
        return this.discoveryService.getStats();
    }

    /**
     * Refresh component discovery
     */
    async refreshDiscovery(): Promise<void> {
        this.ensureInitialized();
        return this.discoveryService.rediscover();
    }

    // =================== METADATA OPERATIONS ===================

    /**
     * Check if a class is an activity
     */
    isActivity(target: Function): boolean {
        return this.metadataAccessor.isActivity(target);
    }

    /**
     * Check if a method is an activity method
     */
    isActivityMethod(target: object, methodName: string): boolean {
        try {
            const targetObj = target as { constructor?: { prototype?: object } };
            return (
                Reflect.hasMetadata('TEMPORAL_ACTIVITY_METHOD', target, methodName) ||
                (targetObj.constructor?.prototype !== undefined &&
                    Reflect.hasMetadata(
                        'TEMPORAL_ACTIVITY_METHOD',
                        targetObj.constructor.prototype,
                        methodName,
                    ))
            );
        } catch {
            return false;
        }
    }

    /**
     * Get activity metadata
     */
    getActivityMetadata(target: Function): MetadataInfo | null {
        const metadata = this.metadataAccessor.getActivityMetadata(target);
        return metadata as MetadataInfo | null;
    }

    /**
     * Extract activity methods from a class
     */
    extractActivityMethods(target: Function): ActivityMethodInfo[] {
        return this.metadataAccessor.extractActivityMethodsFromClass(target);
    }

    // =================== HEALTH AND STATUS ===================

    /**
     * Get overall health status (async version for compatibility)
     */
    async getOverallHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded';
        components: {
            client: { healthy: boolean; available: boolean };
            worker: { healthy: boolean; available: boolean; status: string };
            schedule: { healthy: boolean; available: boolean };
            activity: { healthy: boolean; available: boolean };
            discovery: { healthy: boolean; available: boolean };
        };
        isInitialized: boolean;
        namespace: string;
        summary: {
            totalActivities: number;
            totalSchedules: number;
            workerRunning: boolean;
            clientConnected: boolean;
        };
    }> {
        const health = this.getHealth();
        return {
            ...health,
            components: {
                client: {
                    healthy: health.services.client.status === 'healthy',
                    available: health.services.client.status === 'healthy',
                },
                worker: {
                    healthy: health.services.worker.status === 'healthy',
                    available: this.hasWorker(),
                    status: health.services.worker.status === 'healthy' ? 'healthy' : 'error',
                },
                schedule: {
                    healthy: health.services.schedule.status === 'healthy',
                    available: health.services.schedule.status !== 'unhealthy',
                },
                activity: {
                    healthy: health.services.activity.status === 'healthy',
                    available: health.services.activity.status !== 'unhealthy',
                },
                discovery: {
                    healthy: health.services.discovery.status === 'healthy',
                    available: health.services.discovery.status !== 'unhealthy',
                },
            },
        };
    }

    /**
     * Get system status
     */
    async getSystemStatus(): Promise<{
        client: { available: boolean; healthy: boolean };
        worker: { available: boolean; status?: WorkerStatus; health?: string };
        discovery: DiscoveryStats;
    }> {
        const health = this.getHealth();
        return {
            client: {
                available: health.services.client.status === 'healthy',
                healthy: health.services.client.status === 'healthy',
            },
            worker: {
                available: this.hasWorker(),
                status: this.getWorkerStatus() || undefined,
                health: health.services.worker.status,
            },
            discovery: this.getDiscoveryStats(),
        };
    }

    /**
     * Get worker health status
     */
    async getWorkerHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
        details?: unknown;
    }> {
        try {
            if (!this.hasWorker()) {
                return { status: 'not_available' as const };
            }

            if (!this.workerService) {
                return { status: 'not_available' as const };
            }

            const workerStatus = this.workerService.getWorkerStatus();
            let status: 'healthy' | 'unhealthy' | 'degraded';

            if (workerStatus.isHealthy) {
                status = 'healthy';
            } else if (workerStatus.isRunning) {
                status = 'degraded';
            } else {
                status = 'unhealthy';
            }

            return {
                status,
                details: workerStatus,
            };
        } catch (error) {
            return {
                status: 'unhealthy' as const,
                details: { error: this.extractErrorMessage(error) },
            };
        }
    }

    /**
     * Get available workflows
     */
    getAvailableWorkflows(): string[] {
        return this.discoveryService.getWorkflowNames();
    }

    /**
     * Get comprehensive health status
     */
    getHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        services: {
            client: ServiceHealth;
            worker: ServiceHealth;
            schedule: ServiceHealth;
            activity: ServiceHealth;
            discovery: ServiceHealth;
        };
        isInitialized: boolean;
        namespace: string;
        summary: {
            totalActivities: number;
            totalSchedules: number;
            workerRunning: boolean;
            clientConnected: boolean;
        };
    } {
        const clientHealth = this.getClientHealth();
        const workerHealth = this.getWorkerHealthStatus();
        const scheduleHealth = this.getScheduleHealth();
        const activityHealth = this.getActivityHealth();
        const discoveryHealth = this.getDiscoveryHealth();

        const services = {
            client: clientHealth,
            worker: workerHealth,
            schedule: scheduleHealth,
            activity: activityHealth,
            discovery: discoveryHealth,
        };

        // Determine overall status
        const allHealthy = Object.values(services).every((service) => service.status === 'healthy');
        const anyUnhealthy = Object.values(services).some(
            (service) => service.status === 'unhealthy',
        );

        // Check for specific degraded conditions
        const discoveryStats = this.discoveryService.getStats();
        const hasDiscoveryIssues = discoveryStats.controllers > 0 && discoveryStats.workflows === 0;
        const hasWorkerIssues =
            services.worker.status === 'degraded' && services.client.status === 'healthy';

        let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
        if (allHealthy && !hasDiscoveryIssues) {
            overallStatus = 'healthy';
        } else if (anyUnhealthy) {
            overallStatus = 'unhealthy';
        } else {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            services,
            isInitialized: this.isInitialized,
            namespace: this.options.connection?.namespace || 'default',
            summary: {
                totalActivities: activityHealth.activitiesCount?.total || 0,
                totalSchedules: scheduleHealth.schedulesCount || 0,
                workerRunning: workerHealth.status === 'healthy',
                clientConnected: clientHealth.status === 'healthy',
            },
        };
    }

    /**
     * Get service statistics
     */
    getStats(): {
        activities: { classes: number; methods: number; total: number };
        schedules: number;
        discoveries: DiscoveryStats;
        worker: WorkerStatus;
        client: ServiceHealth;
    } {
        this.ensureInitialized();

        return {
            activities: this.getActivityCount(),
            schedules: this.getScheduleCount(),
            discoveries: this.discoveryService.getStats(),
            worker: this.workerService.getWorkerStatus(),
            client: this.getClientHealth(),
        };
    }

    /**
     * Log current service status
     */
    private logServiceStatus(): void {
        const health = this.getHealth();
        const stats = this.getStats();

        this.temporalLogger.debug(`Service Status - Overall: ${health.status}`);
        this.temporalLogger.debug(
            `Client: ${health.services.client.status}, Worker: ${health.services.worker.status}`,
        );
        this.temporalLogger.debug(
            `Activities: ${stats.activities.total}, Schedules: ${stats.schedules}`,
        );
        this.temporalLogger.debug(`Namespace: ${health.namespace}`);
    }

    /**
     * Ensure service is initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Temporal Service is not initialized');
        }
    }

    /**
     * Enhance workflow options with default task queue if not provided
     */
    private enhanceWorkflowOptions(options: WorkflowStartOptions): WorkflowStartOptions {
        if (!options.taskQueue) {
            options.taskQueue = this.options.taskQueue || DEFAULT_TASK_QUEUE;
        }
        return options;
    }

    /**
     * Log initialization summary
     */
    private async logInitializationSummary(): Promise<void> {
        try {
            const stats = this.discoveryService.getStats();
            this.logger.log(
                `Discovery: ${stats.controllers} controllers, ${stats.methods} methods, ${stats.signals} signals, ${stats.queries} queries, ${stats.workflows} workflows, ${stats.childWorkflows} child workflows`,
            );

            if (this.hasWorker()) {
                this.logger.log('Worker: available');
            } else {
                this.logger.log('Worker: not available');
            }
        } catch (error) {
            this.logger.warn('Could not log initialization summary:', error);
        }
    }

    /**
     * Get client health status
     */
    private getClientHealth(): { status: 'healthy' | 'unhealthy' | 'degraded' } {
        const isHealthy = this.clientService.isHealthy();
        return { status: isHealthy ? 'healthy' : 'unhealthy' };
    }

    /**
     * Get worker health status
     */
    private getWorkerHealthStatus(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        details?: Record<string, unknown>;
    } {
        if (!this.workerService) {
            return {
                status: 'unhealthy' as const,
                details: { error: 'Worker service not available' },
            };
        }
        const workerStatus = this.workerService.getWorkerStatus();
        return {
            status: workerStatus.isHealthy ? 'healthy' : 'degraded',
            details: workerStatus as unknown as Record<string, unknown>,
        };
    }

    /**
     * Get schedule health status
     */
    private getScheduleHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        schedulesCount: number;
    } {
        const isHealthy = this.scheduleService.isHealthy();
        const stats = this.scheduleService.getScheduleStats();
        return { status: isHealthy ? 'healthy' : 'unhealthy', schedulesCount: stats.total };
    }

    /**
     * Get activity health status
     */
    private getActivityHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        activitiesCount: { total: number };
    } {
        const healthStatus = this.activityService.getHealth().status;
        const count = this.activityService.getActivityNames().length;
        return {
            status: healthStatus === 'healthy' ? 'healthy' : 'unhealthy',
            activitiesCount: { total: count },
        };
    }

    /**
     * Get discovery health status
     */
    private getDiscoveryHealth(): { status: 'healthy' | 'unhealthy' | 'degraded' } {
        const healthStatus = this.discoveryService.getHealthStatus();
        return { status: healthStatus.status as 'healthy' | 'unhealthy' | 'degraded' };
    }

    /**
     * Get activity count
     */
    private getActivityCount(): { classes: number; methods: number; total: number } {
        const names = this.activityService.getActivityNames();
        return { classes: names.length, methods: names.length, total: names.length };
    }

    /**
     * Get schedule count
     */
    private getScheduleCount(): number {
        const stats = this.scheduleService.getScheduleStats();
        return stats.total;
    }

    // =================== CONVENIENCE METHODS ===================

    /**
     * Get the client service instance
     * @deprecated Use client property instead
     */
    getClient(): TemporalClientService {
        this.ensureInitialized();
        return this.clientService;
    }

    /**
     * Get the client service instance
     */
    get client(): TemporalClientService {
        this.ensureInitialized();
        return this.clientService;
    }

    /**
     * Get the worker service instance
     * @deprecated Use worker property instead
     */
    getWorkerManager(): TemporalWorkerManagerService | undefined {
        this.ensureInitialized();
        return this.workerService || undefined;
    }

    /**
     * Get the worker service instance
     */
    get worker(): TemporalWorkerManagerService {
        this.ensureInitialized();
        return this.workerService;
    }

    /**
     * Get the schedule service instance
     */
    get schedule(): TemporalScheduleService {
        this.ensureInitialized();
        return this.scheduleService;
    }

    /**
     * Get the activity service instance
     */
    get activity(): TemporalActivityService {
        this.ensureInitialized();
        return this.activityService;
    }

    /**
     * Get the discovery service instance
     * @deprecated Use discovery property instead
     */
    getDiscoveryService(): TemporalDiscoveryService {
        this.ensureInitialized();
        return this.discoveryService;
    }

    /**
     * Get the discovery service instance
     */
    get discovery(): TemporalDiscoveryService {
        this.ensureInitialized();
        return this.discoveryService;
    }

    /**
     * Get the metadata accessor instance
     */
    get metadata(): TemporalMetadataAccessor {
        return this.metadataAccessor;
    }

    /**
     * Extract error message from various error types
     */
    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Unknown error';
    }
}
