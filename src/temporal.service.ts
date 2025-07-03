import { Injectable, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { DEFAULT_TASK_QUEUE, TEMPORAL_MODULE_OPTIONS } from './constants';
import {
    DiscoveryStats,
    ScheduledMethodInfo,
    ScheduleStats,
    StartWorkflowOptions,
    SystemStatus,
    WorkerStatus,
    TemporalOptions,
} from './interfaces';
import { TemporalClientService, TemporalScheduleService } from './client';
import { TemporalDiscoveryService, TemporalScheduleManagerService } from './discovery';
import { TemporalWorkerManagerService } from './worker';
import { createLogger, TemporalLogger } from './utils/logger';

/**
 * Streamlined unified service for interacting with Temporal
 *
 * Provides comprehensive access to all Temporal functionality:
 * - Client operations (start workflows, send signals, execute queries)
 * - Schedule management (create, pause, resume, trigger schedules)
 * - Worker management (status, health checks, restart)
 * - Discovery services (scheduled workflows, activities)
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly temporal: TemporalService) {}
 *
 *   async processOrder(orderId: string) {
 *     // Start workflow directly with client
 *     const { workflowId, result } = await this.temporal.startWorkflow(
 *       'processOrder',
 *       [orderId],
 *       { taskQueue: 'orders' }
 *     );
 *
 *     return { workflowId, result };
 *   }
 *
 *   async getOrderStatus(workflowId: string) {
 *     return await this.temporal.queryWorkflow(workflowId, 'getStatus');
 *   }
 * }
 * ```
 */
@Injectable()
export class TemporalService implements OnModuleInit {
    private readonly logger: TemporalLogger;

    constructor(
        private readonly clientService: TemporalClientService,
        private readonly scheduleService: TemporalScheduleService,
        private readonly discoveryService: TemporalDiscoveryService,
        private readonly scheduleManager: TemporalScheduleManagerService,
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        @Optional() private readonly workerManager?: TemporalWorkerManagerService,
    ) {
        this.logger = createLogger(TemporalService.name);
    }

    async onModuleInit() {
        await this.logInitializationSummary();
    }

    // ==========================================
    // Core Service Access Methods
    // ==========================================

    /**
     * Get the Temporal client service for advanced operations
     */
    getClient(): TemporalClientService {
        return this.clientService;
    }

    /**
     * Get the Temporal schedule service for schedule management
     */
    getScheduleService(): TemporalScheduleService {
        return this.scheduleService;
    }

    /**
     * Get the schedule manager service for discovered schedules
     */
    getScheduleManager(): TemporalScheduleManagerService {
        return this.scheduleManager;
    }

    /**
     * Get the workflow discovery service for introspection
     */
    getDiscoveryService(): TemporalDiscoveryService {
        return this.discoveryService;
    }

    /**
     * Get the worker manager if available
     */
    getWorkerManager(): TemporalWorkerManagerService | undefined {
        return this.workerManager;
    }

    // ==========================================
    // Workflow Operations (Direct Client Access)
    // ==========================================

    /**
     * Start workflow with basic options
     *
     * @param workflowType Name of the workflow type to start
     * @param args Arguments to pass to the workflow
     * @param options Workflow execution options
     * @returns Object containing workflow execution details
     *
     * @example
     * ```typescript
     * // Start workflow directly
     * const { workflowId, result } = await temporalService.startWorkflow(
     *   'processOrder',
     *   [orderId, customerId],
     *   {
     *     taskQueue: 'orders',
     *     workflowId: `order-${orderId}`,
     *     searchAttributes: { 'customer-id': customerId }
     *   }
     * );
     * ```
     */
    async startWorkflow<T, A extends unknown[]>(
        workflowType: string,
        args: A,
        options: StartWorkflowOptions,
    ): Promise<{
        result: Promise<T>;
        workflowId: string;
        firstExecutionRunId: string;
        handle: unknown;
    }> {
        const enhancedOptions = this.enhanceWorkflowOptions(options);

        this.logger.debug(
            `Starting workflow: ${workflowType} with options: ${JSON.stringify(enhancedOptions)}`,
        );

        return this.clientService.startWorkflow<T, A>(workflowType, args, enhancedOptions);
    }

    /**
     * Send signal to workflow with validation
     */
    async signalWorkflow(
        workflowId: string,
        signalName: string,
        args: unknown[] = [],
    ): Promise<void> {
        this.validateWorkflowExists(workflowId);
        await this.clientService.signalWorkflow(workflowId, signalName, args);
        this.logger.debug(`Sent signal '${signalName}' to workflow ${workflowId}`);
    }

    /**
     * Query workflow state with validation
     */
    async queryWorkflow<T>(
        workflowId: string,
        queryName: string,
        args: unknown[] = [],
    ): Promise<T> {
        this.validateWorkflowExists(workflowId);
        const result = await this.clientService.queryWorkflow<T>(workflowId, queryName, args);
        this.logger.debug(`Queried '${queryName}' on workflow ${workflowId}`);
        return result;
    }

    /**
     * Terminate workflow with enhanced logging
     */
    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        await this.clientService.terminateWorkflow(workflowId, reason);
        this.logger.log(`Terminated workflow ${workflowId}${reason ? `: ${reason}` : ''}`);
    }

    /**
     * Cancel workflow with enhanced logging
     */
    async cancelWorkflow(workflowId: string): Promise<void> {
        await this.clientService.cancelWorkflow(workflowId);
        this.logger.log(`Cancelled workflow ${workflowId}`);
    }

    // ==========================================
    // Enhanced Schedule Operations
    // ==========================================

    /**
     * Trigger a managed schedule with validation
     */
    async triggerSchedule(scheduleId: string): Promise<void> {
        this.validateScheduleExists(scheduleId);
        await this.scheduleManager.triggerSchedule(scheduleId);
        this.logger.log(`Triggered schedule: ${scheduleId}`);
    }

    /**
     * Pause a managed schedule with validation
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.validateScheduleExists(scheduleId);
        await this.scheduleManager.pauseSchedule(scheduleId, note);
        this.logger.log(`Paused schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
    }

    /**
     * Resume a managed schedule with validation
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        this.validateScheduleExists(scheduleId);
        await this.scheduleManager.resumeSchedule(scheduleId, note);
        this.logger.log(`Resumed schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
    }

    /**
     * Delete a managed schedule with confirmation
     */
    async deleteSchedule(scheduleId: string, force = false): Promise<void> {
        this.validateScheduleExists(scheduleId);

        if (!force) {
            this.logger.warn(
                `Deleting schedule ${scheduleId}. This action cannot be undone. Use force=true to confirm.`,
            );
            return;
        }

        await this.scheduleManager.deleteSchedule(scheduleId, force);
        this.logger.log(`Deleted schedule: ${scheduleId}`);
    }

    // ==========================================
    // Discovery and Introspection
    // ==========================================

    /**
     * Get all managed schedule IDs
     */
    getManagedSchedules(): string[] {
        return this.scheduleManager.getManagedSchedules();
    }

    /**
     * Get detailed information about a specific schedule
     */
    getScheduleInfo(scheduleId: string): ScheduledMethodInfo | undefined {
        return this.discoveryService.getScheduledWorkflow(scheduleId);
    }

    /**
     * Check if a schedule is managed
     */
    hasSchedule(scheduleId: string): boolean {
        return this.scheduleManager.isScheduleManaged(scheduleId);
    }

    // ==========================================
    // Worker Operations (if available)
    // ==========================================

    /**
     * Check if worker functionality is available
     */
    hasWorker(): boolean {
        return Boolean(this.workerManager);
    }

    /**
     * Get worker status (if worker is available)
     */
    getWorkerStatus(): WorkerStatus | null {
        return this.workerManager?.getWorkerStatus() || null;
    }

    /**
     * Restart worker (if available)
     */
    async restartWorker(): Promise<void> {
        if (!this.workerManager) {
            throw new Error('Worker manager not available');
        }

        await this.workerManager.restartWorker();
        this.logger.log('Worker restarted successfully');
    }

    /**
     * Get worker health check (if available)
     */
    async getWorkerHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
        details?: unknown;
    }> {
        if (!this.workerManager) {
            return { status: 'not_available' };
        }

        const health = await this.workerManager.healthCheck();
        return health;
    }

    // ==========================================
    // Statistics and Monitoring
    // ==========================================

    /**
     * Get comprehensive discovery statistics
     */
    getDiscoveryStats(): DiscoveryStats {
        return this.discoveryService.getStats();
    }

    /**
     * Get schedule management statistics
     */
    getScheduleStats(): ScheduleStats {
        return this.scheduleManager.getScheduleStats();
    }

    /**
     * Get comprehensive system status
     */
    async getSystemStatus(): Promise<SystemStatus> {
        const clientAvailable = Boolean(this.clientService.getRawClient());
        const workerHealth = await this.getWorkerHealth();

        return {
            client: {
                available: clientAvailable,
                healthy: this.clientService.isHealthy(),
            },
            worker: {
                available: this.hasWorker(),
                status: this.getWorkerStatus() || undefined,
                health: workerHealth.status,
            },
            discovery: this.getDiscoveryStats(),
            schedules: this.getScheduleStats(),
        };
    }

    /**
     * Get overall health status for monitoring
     */
    async getOverallHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        components: {
            client: { status: string; healthy: boolean };
            worker: { status: string; available: boolean };
            discovery: { status: string; scheduled: number };
            schedules: { status: string; active: number; errors: number };
        };
    }> {
        const systemStatus = await this.getSystemStatus();
        const discoveryHealth = this.discoveryService.getHealthStatus();
        const scheduleHealth = this.scheduleManager.getHealthStatus();

        const components = {
            client: {
                status: systemStatus.client.healthy ? 'healthy' : 'unhealthy',
                healthy: systemStatus.client.healthy,
            },
            worker: {
                status: systemStatus.worker.health || 'not_available',
                available: systemStatus.worker.available,
            },
            discovery: {
                status: discoveryHealth.status,
                scheduled: discoveryHealth.discoveredItems.scheduled,
            },
            schedules: {
                status: scheduleHealth.status,
                active: scheduleHealth.activeSchedules,
                errors: scheduleHealth.errorCount,
            },
        };

        // Determine overall status
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        if (!systemStatus.client.healthy) {
            overallStatus = 'unhealthy';
        } else if (
            scheduleHealth.status === 'unhealthy' ||
            systemStatus.worker.health === 'unhealthy'
        ) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            components,
        };
    }

    // ==========================================
    // Deprecated Methods (for backward compatibility)
    // ==========================================

    /**
     * @deprecated Workflow discovery is no longer supported
     */
    getAvailableWorkflows(): string[] {
        this.logger.warn(
            'getAvailableWorkflows() is deprecated - workflow discovery is no longer supported',
        );
        return [];
    }

    /**
     * @deprecated Workflow info is no longer supported
     */
    getWorkflowInfo(_workflowName: string): unknown {
        this.logger.warn('getWorkflowInfo() is deprecated - workflow info is no longer supported');
        return undefined;
    }

    /**
     * @deprecated Workflow existence check is no longer supported
     */
    hasWorkflow(_workflowName: string): boolean {
        this.logger.warn(
            'hasWorkflow() is deprecated - workflow existence check is no longer supported',
        );
        return false;
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Enhance workflow options with basic defaults
     */
    private enhanceWorkflowOptions(options: StartWorkflowOptions): StartWorkflowOptions {
        // Extract taskQueue and apply default if not provided
        const { taskQueue, ...restOptions } = options;

        const enhancedOptions: StartWorkflowOptions = {
            taskQueue: taskQueue || DEFAULT_TASK_QUEUE,
            ...restOptions,
        };

        return enhancedOptions;
    }

    /**
     * Validate that a workflow exists (for operations requiring existing workflows)
     */
    private validateWorkflowExists(workflowId: string): void {
        if (!workflowId || typeof workflowId !== 'string') {
            throw new Error('Invalid workflow ID provided');
        }
        // Additional validation could be added here
    }

    /**
     * Validate that a schedule exists and is managed
     */
    private validateScheduleExists(scheduleId: string): void {
        if (!this.scheduleManager.isScheduleManaged(scheduleId)) {
            throw new Error(`Schedule '${scheduleId}' is not managed by this service`);
        }
    }

    /**
     * Log initialization summary
     */
    private async logInitializationSummary(): Promise<void> {
        const stats = this.getDiscoveryStats();
        const scheduleStats = this.getScheduleStats();

        this.logger.log('Temporal service initialized');
        this.logger.log(
            `Discovered: ${stats.scheduled} scheduled workflows, ${stats.signals} signals, ${stats.queries} queries`,
        );
        this.logger.log(`Schedules: ${scheduleStats.total} total, ${scheduleStats.active} active`);

        if (this.workerManager) {
            const workerStatus = this.workerManager.getWorkerStatus();
            this.logger.log(
                `Worker: ${workerStatus.isInitialized ? 'initialized' : 'not initialized'}, ` +
                    `${workerStatus.activitiesCount} activities registered`,
            );
        } else {
            this.logger.log('Running in client-only mode (no worker)');
        }
    }
}
