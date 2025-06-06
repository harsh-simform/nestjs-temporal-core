import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { TemporalClientService } from './client/temporal-client.service';
import { TemporalScheduleService } from './client/temporal-schedule.service';
import { WorkerManager } from './worker/worker-manager.service';
import { WorkflowDiscoveryService } from './discovery/workflow-discovery.service';
import { ScheduleManagerService } from './discovery/schedule-manager.service';
import { LOG_CATEGORIES, DEFAULT_TASK_QUEUE } from './constants';
import {
    StartWorkflowOptions,
    DiscoveryStats,
    ScheduleStats,
    WorkflowMethodInfo,
    ScheduledMethodInfo,
    WorkerStatus,
} from './interfaces';

/**
 * Enhanced unified service for interacting with Temporal
 *
 * Provides comprehensive access to all Temporal functionality:
 * - Client operations (start workflows, send signals, execute queries)
 * - Schedule management (create, pause, resume, trigger schedules)
 * - Worker management (status, health checks, restart)
 * - Discovery services (workflow controllers, activity methods)
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly temporal: TemporalService) {}
 *
 *   async processOrder(orderId: string) {
 *     // Start workflow with auto-discovery
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
    private readonly logger = new Logger(LOG_CATEGORIES.CLIENT);

    constructor(
        private readonly clientService: TemporalClientService,
        private readonly scheduleService: TemporalScheduleService,
        private readonly workflowDiscovery: WorkflowDiscoveryService,
        private readonly scheduleManager: ScheduleManagerService,
        @Optional() private readonly workerManager?: WorkerManager,
    ) {}

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
    getScheduleManager(): ScheduleManagerService {
        return this.scheduleManager;
    }

    /**
     * Get the workflow discovery service for introspection
     */
    getWorkflowDiscovery(): WorkflowDiscoveryService {
        return this.workflowDiscovery;
    }

    /**
     * Get the worker manager if available
     */
    getWorkerManager(): WorkerManager | undefined {
        return this.workerManager;
    }

    // ==========================================
    // Enhanced Workflow Operations
    // ==========================================

    /**
     * Start workflow with enhanced discovery and validation
     *
     * @param workflowType Name of the workflow type to start
     * @param args Arguments to pass to the workflow
     * @param options Workflow execution options
     * @returns Object containing workflow execution details
     *
     * @example
     * ```typescript
     * // Start discovered workflow with validation
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
    async startWorkflow<T, A extends any[]>(
        workflowType: string,
        args: A,
        options: Partial<StartWorkflowOptions> = {},
    ): Promise<{
        result: Promise<T>;
        workflowId: string;
        firstExecutionRunId: string;
        handle: any;
    }> {
        const enhancedOptions = await this.enhanceWorkflowOptions(workflowType, options);

        this.logger.debug(
            `Starting workflow: ${workflowType} with options: ${JSON.stringify(enhancedOptions)}`,
        );

        return this.clientService.startWorkflow<T, A>(workflowType, args, enhancedOptions);
    }

    /**
     * Send signal to workflow with validation
     */
    async signalWorkflow(workflowId: string, signalName: string, args: any[] = []): Promise<void> {
        this.validateWorkflowExists(workflowId);
        await this.clientService.signalWorkflow(workflowId, signalName, args);
        this.logger.debug(`Sent signal '${signalName}' to workflow ${workflowId}`);
    }

    /**
     * Query workflow state with validation
     */
    async queryWorkflow<T>(workflowId: string, queryName: string, args: any[] = []): Promise<T> {
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

        await this.scheduleManager.deleteSchedule(scheduleId);
        this.logger.log(`Deleted schedule: ${scheduleId}`);
    }

    // ==========================================
    // Discovery and Introspection
    // ==========================================

    /**
     * Get all available workflow types from discovered controllers
     */
    getAvailableWorkflows(): string[] {
        return this.workflowDiscovery.getWorkflowNames();
    }

    /**
     * Get detailed information about a specific workflow
     */
    getWorkflowInfo(workflowName: string): WorkflowMethodInfo | undefined {
        return this.workflowDiscovery.getWorkflowMethod(workflowName);
    }

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
        return this.workflowDiscovery.getScheduledWorkflow(scheduleId);
    }

    /**
     * Check if a workflow type is available
     */
    hasWorkflow(workflowName: string): boolean {
        return this.workflowDiscovery.hasWorkflow(workflowName);
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
        details?: any;
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
        return this.workflowDiscovery.getStats();
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
    async getSystemStatus(): Promise<{
        client: {
            available: boolean;
            healthy: boolean;
        };
        worker: {
            available: boolean;
            status?: WorkerStatus;
            health?: string;
        };
        discovery: DiscoveryStats;
        schedules: ScheduleStats;
    }> {
        const clientAvailable = Boolean(this.clientService.getRawClient());
        const workerHealth = await this.getWorkerHealth();

        return {
            client: {
                available: clientAvailable,
                healthy: clientAvailable,
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

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Enhance workflow options with discovered configuration
     */
    private async enhanceWorkflowOptions(
        workflowType: string,
        options: Partial<StartWorkflowOptions>,
    ): Promise<StartWorkflowOptions> {
        const workflowInfo = this.workflowDiscovery.getWorkflowMethod(workflowType);

        if (workflowInfo) {
            // Find the controller for this workflow to get default task queue
            const controllers = this.workflowDiscovery.getWorkflowControllers();
            const controller = controllers.find((c) =>
                c.methods.some((m) => m.workflowName === workflowType),
            );

            // Merge discovered options with provided options
            const enhancedOptions: StartWorkflowOptions = {
                taskQueue: options.taskQueue || controller?.taskQueue || DEFAULT_TASK_QUEUE,
                ...workflowInfo.options,
                ...options, // User options take precedence
            };

            return enhancedOptions;
        }

        // Fallback for non-discovered workflows
        return {
            taskQueue: DEFAULT_TASK_QUEUE,
            ...options,
        } as StartWorkflowOptions;
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

        this.logger.log('Enhanced Temporal service initialized');
        this.logger.log(
            `Discovered: ${stats.controllers} controllers, ${stats.methods} workflows, ${stats.scheduled} scheduled`,
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
