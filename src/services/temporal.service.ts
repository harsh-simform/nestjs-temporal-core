import { Injectable, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { DEFAULT_TASK_QUEUE, TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    DiscoveryStats,
    ScheduledMethodInfo,
    ScheduleStats,
    StartWorkflowOptions,
    SystemStatus,
    WorkerStatus,
    TemporalOptions,
} from '../interfaces';
import { TemporalClientService } from './temporal-client.service';
import { TemporalScheduleService } from './temporal-schedule.service';
import { TemporalDiscoveryService } from './temporal-discovery.service';
import { TemporalWorkerManagerService } from './temporal-worker.service';
import { createLogger, TemporalLogger } from '../utils/logger';

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
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        @Optional() private readonly workerManager?: TemporalWorkerManagerService,
    ) {
        this.logger = createLogger(TemporalService.name);
    }

    async onModuleInit() {
        await this.logInitializationSummary();
    }

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
        options: Partial<StartWorkflowOptions>,
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
        await this.scheduleService.triggerSchedule(scheduleId);
        this.logger.log(`Triggered schedule: ${scheduleId}`);
    }

    /**
     * Pause a managed schedule with validation
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.validateScheduleExists(scheduleId);
        await this.scheduleService.pauseSchedule(scheduleId, note);
        this.logger.log(`Paused schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
    }

    /**
     * Resume a managed schedule with validation
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        this.validateScheduleExists(scheduleId);
        await this.scheduleService.resumeSchedule(scheduleId, note);
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

        await this.scheduleService.deleteSchedule(scheduleId);
        this.logger.log(`Deleted schedule: ${scheduleId}`);
    }

    // ==========================================
    // Discovery and Introspection
    // ==========================================

    /**
     * Get all managed schedule IDs
     */
    getScheduleIds(): string[] {
        return this.discoveryService.getScheduleIds();
    }

    /**
     * Get schedule information by ID
     */
    getScheduleInfo(scheduleId: string): ScheduledMethodInfo | undefined {
        return this.discoveryService.getScheduledWorkflow(scheduleId);
    }

    /**
     * Check if a schedule exists
     */
    hasSchedule(scheduleId: string): boolean {
        return this.discoveryService.hasSchedule(scheduleId);
    }

    /**
     * Check if worker is available
     */
    hasWorker(): boolean {
        return this.workerManager !== undefined;
    }

    /**
     * Get worker status if available
     */
    getWorkerStatus(): WorkerStatus | null {
        return this.workerManager?.getWorkerStatus() || null;
    }

    /**
     * Restart worker if available
     */
    async restartWorker(): Promise<void> {
        if (!this.workerManager) {
            throw new Error('Worker manager not available');
        }
        await this.workerManager.restartWorker();
        this.logger.log('Worker restarted successfully');
    }

    /**
     * Get worker health status
     */
    async getWorkerHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
        details?: unknown;
    }> {
        if (!this.workerManager) {
            return { status: 'not_available' };
        }

        try {
            const status = this.workerManager.getWorkerStatus();
            if (status.isHealthy) {
                return { status: 'healthy', details: status };
            } else if (status.isRunning) {
                return { status: 'degraded', details: status };
            } else {
                return { status: 'unhealthy', details: status };
            }
        } catch (error) {
            this.logger.error(`Error checking worker health: ${(error as Error).message}`);
            return { status: 'unhealthy', details: { error: (error as Error).message } };
        }
    }

    /**
     * Get discovery statistics
     */
    getDiscoveryStats(): DiscoveryStats {
        return this.discoveryService.getStats();
    }

    /**
     * Get schedule statistics
     */
    getScheduleStats(): ScheduleStats {
        return this.scheduleService.getScheduleStats();
    }

    /**
     * Get comprehensive system status
     */
    async getSystemStatus(): Promise<SystemStatus> {
        const clientStatus = {
            available: this.clientService.getRawClient() !== null,
            healthy: this.clientService.isHealthy(),
        };

        const workerStatus = this.hasWorker() ? this.getWorkerStatus() : undefined;

        return {
            client: clientStatus,
            worker: {
                available: this.hasWorker(),
                status: workerStatus || undefined,
                health: workerStatus
                    ? workerStatus.isHealthy
                        ? 'healthy'
                        : 'unhealthy'
                    : undefined,
            },
            discovery: this.getDiscoveryStats(),
            schedules: this.getScheduleStats(),
        };
    }

    /**
     * Get overall system health
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
        const discoveryStats = this.getDiscoveryStats();
        const scheduleStats = this.getScheduleStats();

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        // Check client health
        if (!systemStatus.client.healthy) {
            overallStatus = 'unhealthy';
        }

        // Check worker health
        if (systemStatus.worker.available && !systemStatus.worker.status?.isHealthy) {
            overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
        }

        // Check discovery health
        if (discoveryStats.scheduled === 0 && discoveryStats.controllers > 0) {
            overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
        }

        // Check schedule health
        if (scheduleStats.errors > 0) {
            overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
        }

        return {
            status: overallStatus,
            components: {
                client: {
                    status: systemStatus.client.healthy ? 'connected' : 'disconnected',
                    healthy: systemStatus.client.healthy,
                },
                worker: {
                    status: systemStatus.worker.available
                        ? systemStatus.worker.status?.isHealthy
                            ? 'running'
                            : 'error'
                        : 'not_available',
                    available: systemStatus.worker.available,
                },
                discovery: {
                    status: discoveryStats.scheduled > 0 ? 'active' : 'inactive',
                    scheduled: discoveryStats.scheduled,
                },
                schedules: {
                    status: scheduleStats.active > 0 ? 'active' : 'inactive',
                    active: scheduleStats.active,
                    errors: scheduleStats.errors,
                },
            },
        };
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    /**
     * Get available workflow types
     */
    getAvailableWorkflows(): string[] {
        return this.discoveryService.getWorkflowNames();
    }

    /**
     * Get workflow information
     */
    getWorkflowInfo(workflowName: string): ScheduledMethodInfo | undefined {
        // Search all scheduled workflows for a matching workflowName
        const allWorkflows = this.discoveryService.getScheduledWorkflows();
        return allWorkflows.find((wf) => wf.workflowName === workflowName);
    }

    /**
     * Check if workflow exists
     */
    hasWorkflow(_workflowName: string): boolean {
        return this.discoveryService.hasWorkflow(_workflowName);
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Enhance workflow options with defaults
     */
    private enhanceWorkflowOptions(options: Partial<StartWorkflowOptions>): StartWorkflowOptions {
        const { taskQueue, ...restOptions } = options;
        return {
            taskQueue: taskQueue || this.options.taskQueue || DEFAULT_TASK_QUEUE,
            ...restOptions,
        };
    }

    /**
     * Validate workflow exists before operations
     */
    private validateWorkflowExists(workflowId: string): void {
        if (!workflowId || workflowId.trim().length === 0) {
            throw new Error('Workflow ID is required');
        }
    }

    /**
     * Validate schedule exists before operations
     */
    private validateScheduleExists(scheduleId: string): void {
        if (!this.hasSchedule(scheduleId)) {
            throw new Error(`Schedule '${scheduleId}' not found`);
        }
    }

    /**
     * Log initialization summary
     */
    private async logInitializationSummary(): Promise<void> {
        const discoveryStats = this.getDiscoveryStats();
        const scheduleStats = this.getScheduleStats();

        this.logger.log('Temporal Service initialized successfully');
        this.logger.log(
            `Discovery: ${discoveryStats.controllers} controllers, ${discoveryStats.scheduled} scheduled workflows`,
        );
        this.logger.log(
            `Schedules: ${scheduleStats.active} active, ${scheduleStats.errors} errors`,
        );
        this.logger.log(`Worker: ${this.hasWorker() ? 'available' : 'not available'}`);
    }
}
