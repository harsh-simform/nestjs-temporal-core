import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, ScheduleClient, ScheduleHandle, ScheduleOverlapPolicy } from '@temporalio/client';
import { Duration } from '@temporalio/common';
import { ERRORS, TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { createLogger, TemporalLogger } from '../utils/logger';
import { TemporalOptions } from '../interfaces';

/**
 * Streamlined Temporal Schedule Service
 * Handles all schedule operations: create, pause, resume, delete, trigger
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

    // ==========================================
    // Schedule Creation
    // ==========================================

    /**
     * Create a cron-based scheduled workflow
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
                `Created cron schedule: ${scheduleId} -> ${workflowType} (${cronExpression})${
                    options?.timezone ? ` in ${options.timezone}` : ''
                }`,
            );

            return handle;
        } catch (error) {
            const errorMsg = `Failed to create cron schedule '${scheduleId}': ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Create an interval-based scheduled workflow
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
            const errorMsg = `Failed to create interval schedule '${scheduleId}': ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    // ==========================================
    // Schedule Management
    // ==========================================

    /**
     * Pause a running schedule
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'pause', (handle) =>
            handle.pause(note || 'Paused via NestJS Temporal integration'),
        );
    }

    /**
     * Resume a paused schedule
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'resume', (handle) =>
            handle.unpause(note || 'Resumed via NestJS Temporal integration'),
        );
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'delete', (handle) => handle.delete());
    }

    /**
     * Trigger an immediate run of a scheduled workflow
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
     * Update a schedule's configuration
     */
    async updateSchedule(
        scheduleId: string,
        updateFn: (schedule: unknown) => unknown,
    ): Promise<void> {
        await this.executeScheduleOperation(scheduleId, 'update', (handle) =>
            handle.update(updateFn as never),
        );
    }

    // ==========================================
    // Schedule Information
    // ==========================================

    /**
     * List all schedules with pagination
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
            const errorMsg = `Failed to list schedules: ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Get detailed information about a specific schedule
     */
    async describeSchedule(scheduleId: string): Promise<unknown> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            return await handle.describe();
        } catch (error) {
            const errorMsg = `Failed to describe schedule '${scheduleId}': ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Check if a schedule exists
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

    // ==========================================
    // Client Access & Health
    // ==========================================

    /**
     * Get the Temporal Schedule client
     */
    getScheduleClient(): ScheduleClient | null {
        return this.scheduleClient;
    }

    /**
     * Check if schedule client is available and healthy
     */
    isHealthy(): boolean {
        return Boolean(this.scheduleClient);
    }

    /**
     * Get schedule service status for monitoring
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

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Execute a schedule operation with consistent error handling
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
            const errorMsg = `Failed to ${operation} schedule '${scheduleId}': ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Ensure schedule client is initialized
     */
    private ensureClientInitialized(): void {
        if (!this.scheduleClient) {
            throw new Error(ERRORS.SCHEDULE_CLIENT_NOT_INITIALIZED);
        }
    }

    /**
     * Generate a unique workflow ID for scheduled workflows
     */
    private generateScheduledWorkflowId(scheduleId: string): string {
        return `${scheduleId}-${Date.now()}`;
    }
}
