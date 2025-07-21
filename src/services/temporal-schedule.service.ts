import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, ScheduleClient, ScheduleHandle, ScheduleOverlapPolicy } from '@temporalio/client';
import { Duration } from '@temporalio/common';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { createLogger, TemporalLogger } from '../utils/logger';
import { TemporalOptions } from '../interfaces';

/**
 * Manages Temporal Schedules for recurring workflow execution.
 *
 * This service provides a comprehensive interface for creating, managing, and monitoring
 * Temporal schedules. It supports both cron-based and interval-based scheduling with
 * advanced features like overlap policies, timezone support, and lifecycle management.
 *
 * Key features:
 * - Cron-based schedule creation with timezone support
 * - Interval-based schedule creation
 * - Schedule lifecycle management (pause, resume, delete, trigger)
 * - Schedule listing and description
 * - Overlap policy configuration
 * - Health monitoring and status reporting
 * - Comprehensive error handling and logging
 *
 * @example
 * ```typescript
 * // Create a cron schedule
 * const handle = await scheduleService.createCronSchedule(
 *   'daily-report',
 *   'generateDailyReport',
 *   '0 9 * * *', // 9 AM daily
 *   'reports',
 *   [reportType],
 *   { timezone: 'America/New_York' }
 * );
 *
 * // Pause a schedule
 * await scheduleService.pauseSchedule('daily-report', 'Maintenance mode');
 *
 * // List all schedules
 * const schedules = await scheduleService.listSchedules();
 * ```
 */
@Injectable()
export class TemporalScheduleService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private scheduleClient: ScheduleClient | null = null;

    constructor(
        @Inject(TEMPORAL_CLIENT)
        private readonly client: Client | null,
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
    ) {
        this.logger = createLogger(TemporalScheduleService.name);
    }

    /**
     * Initializes the schedule service during module initialization.
     * Sets up the schedule client and handles initialization errors gracefully.
     */
    async onModuleInit(): Promise<void> {
        if (!this.client) {
            this.logger.warn(
                'Temporal client not initialized - schedule features will be unavailable',
            );
            return;
        }
        try {
            if (typeof this.client.schedule === 'undefined') {
                this.logger.warn('Schedule client not available in this Temporal SDK version');
                return;
            }
            this.scheduleClient = this.client.schedule;
            this.logger.log('Temporal schedule client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize schedule client', error);
        }
    }

    /**
     * Creates a cron-based scheduled workflow with timezone support.
     *
     * @param scheduleId - Unique identifier for the schedule
     * @param workflowType - The workflow type to execute
     * @param cronExpression - Cron expression for scheduling (e.g., '0 9 * * *')
     * @param taskQueue - Task queue for workflow execution
     * @param args - Arguments to pass to the workflow
     * @param options - Additional schedule options
     * @returns Promise resolving to the schedule handle
     * @throws Error if client is not initialized or schedule creation fails
     *
     * @example
     * ```typescript
     * const handle = await createCronSchedule(
     *   'daily-backup',
     *   'backupDatabase',
     *   '0 2 * * *', // 2 AM daily
     *   'maintenance',
     *   ['full'],
     *   { timezone: 'UTC', description: 'Daily database backup' }
     * );
     * ```
     */
    async createCronSchedule(
        scheduleId: string,
        workflowType: string,
        cronExpression: string,
        taskQueue: string,
        args: unknown[] = [],
        options?: {
            description?: string;
            timezone?: string;
            overlapPolicy?: ScheduleOverlapPolicy;
            startPaused?: boolean;
        },
    ): Promise<ScheduleHandle> {
        this.ensureClientInitialized();
        try {
            const scheduleSpec: Record<string, unknown> = {
                cronExpressions: [cronExpression],
                ...(options?.timezone && { timeZone: options.timezone }),
            };
            const handle = await this.scheduleClient!.create({
                scheduleId,
                spec: scheduleSpec,
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                    workflowId: this.generateScheduledWorkflowId(scheduleId),
                },
                ...(options?.description && { memo: { description: options.description } }),
                policies: {
                    ...(options?.overlapPolicy && { overlap: options.overlapPolicy }),
                },
                state: {
                    paused: options?.startPaused || false,
                },
            });
            this.logger.log(
                `Created cron schedule: ${scheduleId} -> ${workflowType} (${cronExpression})${options?.timezone ? ` in ${options.timezone}` : ''}`,
            );
            return handle;
        } catch (error) {
            this.logger.error(`Failed to create cron schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to create cron schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Creates an interval-based scheduled workflow.
     *
     * @param scheduleId - Unique identifier for the schedule
     * @param workflowType - The workflow type to execute
     * @param interval - Interval duration between executions
     * @param taskQueue - Task queue for workflow execution
     * @param args - Arguments to pass to the workflow
     * @param options - Additional schedule options
     * @returns Promise resolving to the schedule handle
     * @throws Error if client is not initialized or schedule creation fails
     *
     * @example
     * ```typescript
     * const handle = await createIntervalSchedule(
     *   'health-check',
     *   'performHealthCheck',
     *   '5m', // Every 5 minutes
     *   'monitoring',
     *   ['api', 'database'],
     *   { description: 'System health monitoring' }
     * );
     * ```
     */
    async createIntervalSchedule(
        scheduleId: string,
        workflowType: string,
        interval: Duration,
        taskQueue: string,
        args: unknown[] = [],
        options?: {
            description?: string;
            overlapPolicy?: ScheduleOverlapPolicy;
            startPaused?: boolean;
        },
    ): Promise<ScheduleHandle> {
        this.ensureClientInitialized();
        try {
            const handle = await this.scheduleClient!.create({
                scheduleId,
                spec: {
                    intervals: [{ every: interval }],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                    workflowId: this.generateScheduledWorkflowId(scheduleId),
                },
                ...(options?.description && { memo: { description: options.description } }),
                policies: {
                    ...(options?.overlapPolicy && { overlap: options.overlapPolicy }),
                },
                state: {
                    paused: options?.startPaused || false,
                },
            });
            this.logger.log(
                `Created interval schedule: ${scheduleId} -> ${workflowType} (${interval})`,
            );
            return handle;
        } catch (error) {
            this.logger.error(
                `Failed to create interval schedule '${scheduleId}': ${error.message}`,
            );
            throw new Error(`Failed to create interval schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Pauses a running schedule, stopping future executions.
     *
     * @param scheduleId - The ID of the schedule to pause
     * @param note - Optional note explaining the pause reason
     * @throws Error if client is not initialized or pause fails
     *
     * @example
     * ```typescript
     * await pauseSchedule('daily-report', 'Maintenance window');
     * ```
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'pause', (handle) =>
            handle.pause(note || 'Paused via NestJS Temporal integration'),
        );
    }

    /**
     * Resumes a paused schedule, allowing future executions.
     *
     * @param scheduleId - The ID of the schedule to resume
     * @param note - Optional note explaining the resume reason
     * @throws Error if client is not initialized or resume fails
     *
     * @example
     * ```typescript
     * await resumeSchedule('daily-report', 'Maintenance completed');
     * ```
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'resume', (handle) =>
            handle.unpause(note || 'Resumed via NestJS Temporal integration'),
        );
    }

    /**
     * Deletes a schedule permanently.
     *
     * @param scheduleId - The ID of the schedule to delete
     * @throws Error if client is not initialized or deletion fails
     *
     * @example
     * ```typescript
     * await deleteSchedule('old-schedule');
     * ```
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'delete', (handle) => handle.delete());
    }

    /**
     * Triggers an immediate run of a scheduled workflow.
     *
     * @param scheduleId - The ID of the schedule to trigger
     * @param overlapPolicy - Policy for handling overlapping executions
     * @throws Error if client is not initialized or trigger fails
     *
     * @example
     * ```typescript
     * await triggerSchedule('daily-report', 'SKIP');
     * ```
     */
    async triggerSchedule(
        scheduleId: string,
        overlapPolicy: ScheduleOverlapPolicy = 'ALLOW_ALL',
    ): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'trigger', (handle) =>
            handle.trigger(overlapPolicy),
        );
    }

    /**
     * Updates a schedule's configuration using an update function.
     *
     * @param scheduleId - The ID of the schedule to update
     * @param updateFn - Function to modify the schedule configuration
     * @throws Error if client is not initialized or update fails
     *
     * @example
     * ```typescript
     * await updateSchedule('daily-report', (schedule) => ({
     *   ...schedule,
     *   spec: { cronExpressions: ['0 10 * * *'] } // Change to 10 AM
     * }));
     * ```
     */
    async updateSchedule(
        scheduleId: string,
        updateFn: (schedule: unknown) => unknown,
    ): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'update', (handle) =>
            handle.update(updateFn as never),
        );
    }

    /**
     * Lists all schedules with pagination support.
     *
     * @param pageSize - Number of schedules to return per page
     * @returns Promise resolving to array of schedule descriptions
     * @throws Error if client is not initialized or listing fails
     *
     * @example
     * ```typescript
     * const schedules = await listSchedules(50);
     * schedules.forEach(schedule => console.log(schedule.scheduleId));
     * ```
     */
    async listSchedules(pageSize = 100): Promise<unknown[]> {
        this.ensureClientInitialized();
        try {
            const schedules: unknown[] = [];
            for await (const schedule of this.scheduleClient!.list({ pageSize })) {
                schedules.push(schedule);
            }
            return schedules;
        } catch (error) {
            this.logger.error(`Failed to list schedules: ${error.message}`);
            throw new Error(`Failed to list schedules: ${error.message}`);
        }
    }

    /**
     * Returns detailed information about a specific schedule.
     *
     * @param scheduleId - The ID of the schedule to describe
     * @returns Promise resolving to schedule description
     * @throws Error if client is not initialized or description fails
     *
     * @example
     * ```typescript
     * const description = await describeSchedule('daily-report');
     * console.log('Schedule state:', description.state);
     * ```
     */
    async describeSchedule(scheduleId: string): Promise<unknown> {
        this.ensureClientInitialized();
        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            return await handle.describe();
        } catch (error) {
            this.logger.error(`Failed to describe schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to describe schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Checks if a schedule exists by ID.
     *
     * @param scheduleId - The ID of the schedule to check
     * @returns Promise resolving to true if schedule exists
     *
     * @example
     * ```typescript
     * const exists = await scheduleExists('daily-report');
     * if (exists) {
     *   console.log('Schedule exists');
     * }
     * ```
     */
    async scheduleExists(scheduleId: string): Promise<boolean> {
        try {
            const schedules = await this.listSchedules();
            return schedules.some((s) => (s as { scheduleId: string }).scheduleId === scheduleId);
        } catch (error) {
            this.logger.warn(`Failed to check if schedule exists: ${error.message}`);
            return false;
        }
    }

    /**
     * Returns the Temporal Schedule client instance for advanced operations.
     *
     * @returns The schedule client instance or null if not initialized
     */
    getScheduleClient(): ScheduleClient | null {
        return this.scheduleClient;
    }

    /**
     * Checks if the schedule client is available and healthy.
     *
     * @returns True if schedule client is initialized and working
     */
    isHealthy(): boolean {
        if (!this.scheduleClient) {
            return false;
        }

        // Test if the client is actually working by checking if it's a proper client
        try {
            // Check if the client has the expected structure
            return (
                typeof this.scheduleClient.list === 'function' &&
                typeof this.scheduleClient.getHandle === 'function'
            );
        } catch {
            return false;
        }
    }

    /**
     * Returns schedule statistics for monitoring.
     * Note: This is a placeholder implementation that returns zeros.
     *
     * @returns Object containing schedule statistics
     */
    getScheduleStats(): {
        total: number;
        active: number;
        inactive: number;
        errors: number;
    } {
        return {
            total: 0,
            active: 0,
            inactive: 0,
            errors: 0,
        };
    }

    /**
     * Returns schedule service status for monitoring and debugging.
     *
     * @returns Object containing service status information
     */
    getStatus(): {
        available: boolean;
        healthy: boolean;
        schedulesSupported: boolean;
    } {
        return {
            available: Boolean(this.client),
            healthy: this.isHealthy(),
            schedulesSupported: Boolean(this.scheduleClient),
        };
    }

    /**
     * Executes a schedule operation with error handling and logging.
     *
     * @param scheduleId - The ID of the schedule
     * @param operation - The operation name for logging
     * @param action - The action to perform on the schedule handle
     * @throws Error if operation fails
     */
    private async executeScheduleOperation(
        scheduleId: string,
        operation: string,
        action: (handle: ScheduleHandle) => Promise<unknown>,
    ): Promise<void> {
        this.ensureClientInitialized();
        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            await action(handle);
            this.logger.log(`Successfully ${operation}d schedule: ${scheduleId}`);
        } catch (error) {
            this.logger.error(`Failed to ${operation} schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to ${operation} schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Ensures the schedule client is initialized before operations.
     *
     * @throws Error if schedule client is not initialized
     */
    private ensureClientInitialized(): void {
        if (!this.scheduleClient) {
            throw new Error('Temporal schedule client not initialized');
        }
    }

    /**
     * Generates a unique workflow ID for scheduled executions.
     *
     * @param scheduleId - The schedule ID to base the workflow ID on
     * @returns A unique workflow ID with timestamp
     */
    private generateScheduledWorkflowId(scheduleId: string): string {
        return `${scheduleId}-${Date.now()}`;
    }
}
