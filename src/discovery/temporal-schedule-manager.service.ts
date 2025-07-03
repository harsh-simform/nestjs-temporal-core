import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Duration } from '@temporalio/common';
import { ScheduledMethodInfo, ScheduleStats, ScheduleStatus } from '../interfaces';
import { TemporalDiscoveryService } from './temporal-discovery.service';
import { TemporalScheduleService } from '../client';

/**
 * Streamlined Schedule Manager Service
 * Manages scheduled workflows discovered through decorators
 */
@Injectable()
export class TemporalScheduleManagerService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(TemporalScheduleManagerService.name);

    // Track managed schedules and their status
    private readonly managedSchedules = new Map<string, ScheduleStatus>();
    private readonly setupPromises = new Map<string, Promise<void>>();

    constructor(
        private readonly discoveryService: TemporalDiscoveryService,
        private readonly scheduleService: TemporalScheduleService,
    ) {}

    async onApplicationBootstrap() {
        await this.setupDiscoveredSchedules();
    }

    async onModuleDestroy() {
        this.logger.log('Schedule manager shutting down');
        // In production, schedules should persist across deployments
        // Only log the shutdown, don't delete schedules
    }

    // ==========================================
    // Schedule Setup Process
    // ==========================================

    /**
     * Set up all discovered scheduled workflows
     */
    private async setupDiscoveredSchedules(): Promise<void> {
        const scheduledWorkflows = this.discoveryService.getScheduledWorkflows();

        if (scheduledWorkflows.length === 0) {
            this.logger.log('No scheduled workflows found');
            return;
        }

        this.logger.log(`Setting up ${scheduledWorkflows.length} scheduled workflows`);

        // Process schedules concurrently with individual error handling
        const setupPromises = scheduledWorkflows.map((scheduled) =>
            this.setupSingleSchedule(scheduled),
        );

        const results = await Promise.allSettled(setupPromises);
        this.logSetupResults(results, scheduledWorkflows);
    }

    /**
     * Set up a single scheduled workflow with error handling
     */
    private async setupSingleSchedule(scheduled: ScheduledMethodInfo): Promise<void> {
        const { scheduleOptions, workflowName } = scheduled;
        const { scheduleId } = scheduleOptions;

        // Prevent duplicate setup attempts
        if (this.setupPromises.has(scheduleId)) {
            await this.setupPromises.get(scheduleId);
            return;
        }

        const setupPromise = this.performScheduleSetup(scheduled);
        this.setupPromises.set(scheduleId, setupPromise);

        try {
            await setupPromise;
            this.updateScheduleStatus(scheduleId, workflowName, true, true);
            this.logger.debug(`Successfully set up schedule: ${scheduleId}`);
        } catch (error) {
            this.updateScheduleStatus(scheduleId, workflowName, false, false, error.message);
            this.logger.error(`Failed to setup schedule ${scheduleId}: ${error.message}`);
        } finally {
            this.setupPromises.delete(scheduleId);
        }
    }

    /**
     * Perform the actual schedule setup
     */
    private async performScheduleSetup(scheduled: ScheduledMethodInfo): Promise<void> {
        const { scheduleOptions, workflowName, controllerInfo } = scheduled;
        const { scheduleId } = scheduleOptions;

        // Check if auto-start is disabled
        if (scheduleOptions.autoStart === false) {
            this.logger.debug(`Auto-start disabled for schedule ${scheduleId}`);
            this.updateScheduleStatus(scheduleId, workflowName, true, false, 'Auto-start disabled');
            return;
        }

        // Check if schedule already exists
        if (await this.scheduleService.scheduleExists(scheduleId)) {
            this.logger.debug(`Schedule ${scheduleId} already exists, skipping creation`);
            this.updateScheduleStatus(scheduleId, workflowName, true, true, 'Already exists');
            return;
        }

        // Determine task queue
        const taskQueue = this.resolveTaskQueue(
            scheduleOptions as unknown as Record<string, unknown>,
            controllerInfo as unknown as Record<string, unknown>,
        );

        // Create the appropriate schedule type
        if (scheduleOptions.cron) {
            await this.createCronSchedule(scheduled, taskQueue);
        } else if (scheduleOptions.interval) {
            await this.createIntervalSchedule(scheduled, taskQueue);
        } else {
            throw new Error('Schedule must have either cron or interval configuration');
        }

        // Handle initial pause state
        if (scheduleOptions.startPaused) {
            await this.scheduleService.pauseSchedule(scheduleId, 'Started in paused state');
            this.logger.debug(`Schedule ${scheduleId} created in paused state`);
        }
    }

    /**
     * Create a cron-based schedule
     */
    private async createCronSchedule(
        scheduled: ScheduledMethodInfo,
        taskQueue: string,
    ): Promise<void> {
        const { scheduleOptions, workflowName } = scheduled;

        await this.scheduleService.createCronSchedule(
            scheduleOptions.scheduleId,
            workflowName,
            scheduleOptions.cron!,
            taskQueue,
            [], // Arguments can be enhanced in future versions
            {
                description: scheduleOptions.description,
                timezone: scheduleOptions.timezone,
                overlapPolicy: scheduleOptions.overlapPolicy,
                startPaused: scheduleOptions.startPaused,
            },
        );

        this.logger.log(
            `Created cron schedule: ${scheduleOptions.scheduleId} -> ${workflowName} (${scheduleOptions.cron})`,
        );
    }

    /**
     * Create an interval-based schedule
     */
    private async createIntervalSchedule(
        scheduled: ScheduledMethodInfo,
        taskQueue: string,
    ): Promise<void> {
        const { scheduleOptions, workflowName } = scheduled;

        await this.scheduleService.createIntervalSchedule(
            scheduleOptions.scheduleId,
            workflowName,
            scheduleOptions.interval! as Duration,
            taskQueue,
            [], // Arguments can be enhanced in future versions
            {
                description: scheduleOptions.description,
                overlapPolicy: scheduleOptions.overlapPolicy,
                startPaused: scheduleOptions.startPaused,
            },
        );

        this.logger.log(
            `Created interval schedule: ${scheduleOptions.scheduleId} -> ${workflowName} (${scheduleOptions.interval})`,
        );
    }

    // ==========================================
    // Schedule Management Operations
    // ==========================================

    /**
     * Manually trigger a scheduled workflow
     */
    async triggerSchedule(scheduleId: string): Promise<void> {
        this.ensureScheduleManaged(scheduleId);
        await this.scheduleService.triggerSchedule(scheduleId);
        this.logger.log(`Triggered schedule: ${scheduleId}`);
    }

    /**
     * Pause a managed schedule
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureScheduleManaged(scheduleId);
        await this.scheduleService.pauseSchedule(scheduleId, note);
        this.updateScheduleStatus(
            scheduleId,
            this.getScheduleWorkflowName(scheduleId),
            true,
            false,
        );
        this.logger.log(`Paused schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
    }

    /**
     * Resume a managed schedule
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureScheduleManaged(scheduleId);
        await this.scheduleService.resumeSchedule(scheduleId, note);
        this.updateScheduleStatus(scheduleId, this.getScheduleWorkflowName(scheduleId), true, true);
        this.logger.log(`Resumed schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
    }

    /**
     * Delete a managed schedule (use with caution)
     */
    async deleteSchedule(scheduleId: string, force = false): Promise<void> {
        this.ensureScheduleManaged(scheduleId);

        if (!force) {
            this.logger.warn(
                `Deleting schedule ${scheduleId} requires force=true. This action cannot be undone.`,
            );
            throw new Error('Schedule deletion requires force=true confirmation');
        }

        await this.scheduleService.deleteSchedule(scheduleId);
        this.managedSchedules.delete(scheduleId);
        this.logger.log(`Deleted schedule: ${scheduleId}`);
    }

    /**
     * Retry failed schedule setups
     */
    async retryFailedSetups(): Promise<void> {
        const failedSchedules = this.discoveryService
            .getScheduledWorkflows()
            .filter((scheduled) => {
                const status = this.managedSchedules.get(scheduled.scheduleOptions.scheduleId);
                return !status || !status.isManaged;
            });

        if (failedSchedules.length === 0) {
            this.logger.log('No failed schedules to retry');
            return;
        }

        this.logger.log(`Retrying ${failedSchedules.length} failed schedule setups`);

        for (const scheduled of failedSchedules) {
            await this.setupSingleSchedule(scheduled);
        }
    }

    // ==========================================
    // Information & Status Methods
    // ==========================================

    /**
     * Get all managed schedule IDs
     */
    getManagedSchedules(): string[] {
        return Array.from(this.managedSchedules.keys());
    }

    /**
     * Get detailed status of all managed schedules
     */
    getManagedScheduleStatuses(): ScheduleStatus[] {
        return Array.from(this.managedSchedules.values());
    }

    /**
     * Get status of a specific schedule
     */
    getScheduleStatus(scheduleId: string): ScheduleStatus | undefined {
        return this.managedSchedules.get(scheduleId);
    }

    /**
     * Check if a schedule is managed by this service
     */
    isScheduleManaged(scheduleId: string): boolean {
        return this.managedSchedules.has(scheduleId);
    }

    /**
     * Check if a managed schedule is currently active
     */
    isScheduleActive(scheduleId: string): boolean {
        const status = this.managedSchedules.get(scheduleId);
        return status?.isActive || false;
    }

    /**
     * Get count of managed schedules by status
     */
    getScheduleStats(): ScheduleStats {
        const statuses = Array.from(this.managedSchedules.values());
        return {
            total: statuses.length,
            active: statuses.filter((s) => s.isActive).length,
            inactive: statuses.filter((s) => !s.isActive).length,
            errors: statuses.filter((s) => s.lastError).length,
        };
    }

    /**
     * Get health status for monitoring
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        managedSchedules: number;
        activeSchedules: number;
        errorCount: number;
    } {
        const stats = this.getScheduleStats();

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (stats.errors > 0) {
            status = stats.errors === stats.total ? 'unhealthy' : 'degraded';
        } else {
            status = 'healthy';
        }

        return {
            status,
            managedSchedules: stats.total,
            activeSchedules: stats.active,
            errorCount: stats.errors,
        };
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Resolve the task queue for a schedule
     */
    private resolveTaskQueue(
        scheduleOptions: Record<string, unknown>,
        controllerInfo: Record<string, unknown>,
    ): string {
        return (
            (scheduleOptions.taskQueue as string) ||
            (controllerInfo.taskQueue as string) ||
            'default'
        );
    }

    /**
     * Update schedule status tracking
     */
    private updateScheduleStatus(
        scheduleId: string,
        workflowName: string,
        isManaged: boolean,
        isActive: boolean,
        error?: string,
    ): void {
        const existing = this.managedSchedules.get(scheduleId);
        const now = new Date();

        this.managedSchedules.set(scheduleId, {
            scheduleId,
            workflowName,
            isManaged,
            isActive,
            lastError: error,
            createdAt: existing?.createdAt || now,
            lastUpdatedAt: now,
        });
    }

    /**
     * Log setup results with summary
     */
    private logSetupResults(
        results: PromiseSettledResult<void>[],
        scheduledWorkflows: ScheduledMethodInfo[],
    ): void {
        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        this.logger.log(
            `Schedule setup completed: ${successful} successful, ${failed} failed out of ${scheduledWorkflows.length} total`,
        );

        if (failed > 0) {
            this.logger.warn(
                `${failed} schedules failed to setup. Use retryFailedSetups() to retry.`,
            );
        }
    }

    /**
     * Ensure a schedule is managed by this service
     */
    private ensureScheduleManaged(scheduleId: string): void {
        if (!this.isScheduleManaged(scheduleId)) {
            throw new Error(`Schedule '${scheduleId}' is not managed by this service`);
        }
    }

    /**
     * Get workflow name for a schedule ID
     */
    private getScheduleWorkflowName(scheduleId: string): string {
        const status = this.managedSchedules.get(scheduleId);
        return status?.workflowName || 'unknown';
    }
}
