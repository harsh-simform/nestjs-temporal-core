import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, ScheduleClient, ScheduleHandle, ScheduleOverlapPolicy } from '@temporalio/client';
import { TEMPORAL_CLIENT, ERRORS } from '../constants';

@Injectable()
export class TemporalScheduleService implements OnModuleInit {
    private readonly logger = new Logger(TemporalScheduleService.name);
    private scheduleClient: ScheduleClient | null = null;

    constructor(
        @Inject(TEMPORAL_CLIENT)
        private readonly client: Client | null,
    ) {
        if (this.client && this.client.schedule) {
            this.scheduleClient = this.client.schedule;
        }
    }

    async onModuleInit(): Promise<void> {
        if (this.client) {
            try {
                // Check if schedule client is available
                if (typeof this.client.schedule === 'undefined') {
                    this.logger.warn('Schedule client not available in this Temporal SDK version');
                    return;
                }

                this.scheduleClient = this.client.schedule;
                this.logger.log('Temporal schedule client initialized');
            } catch (error) {
                this.logger.error('Failed to initialize schedule client', error);
            }
        } else {
            this.logger.warn(
                'Temporal client not initialized - schedule features will be unavailable',
            );
        }
    }

    private ensureClientInitialized(): void {
        if (!this.scheduleClient) {
            throw new Error(ERRORS.SCHEDULE_CLIENT_NOT_INITIALIZED);
        }
    }

    /**
     * Create a workflow that runs on a cron schedule
     *
     * @param scheduleId Unique ID for the schedule
     * @param workflowType Type of workflow to run
     * @param cronExpression Cron expression (e.g. "0 0 * * *" for daily at midnight)
     * @param taskQueue Task queue for the workflow
     * @param args Arguments to pass to the workflow
     * @param description Optional description of the schedule
     * @returns Handle to the created schedule
     */
    async createCronWorkflow(
        scheduleId: string,
        workflowType: string,
        cronExpression: string,
        taskQueue: string,
        args: any[] = [],
        description?: string,
    ): Promise<ScheduleHandle> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.create({
                scheduleId,
                spec: {
                    cronExpressions: [cronExpression],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                    workflowId: `${scheduleId}-${Date.now()}`,
                },
                memo: description ? { description } : undefined,
            });

            this.logger.log(
                `Created cron workflow schedule: ${scheduleId} with expression: ${cronExpression}`,
            );
            return handle;
        } catch (error) {
            this.logger.error(`Failed to create schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to create schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Pause a running schedule
     *
     * @param scheduleId ID of the schedule to pause
     * @param note Optional note explaining the pause reason
     */
    async pauseSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            await handle.pause(note || 'Paused via NestJS Temporal integration');
            this.logger.log(`Paused schedule: ${scheduleId}${note ? ` (${note})` : ''}`);
        } catch (error) {
            this.logger.error(`Failed to pause schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to pause schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Unpause (resume) a paused schedule
     *
     * @param scheduleId ID of the schedule to unpause
     * @param note Optional note explaining why the schedule was resumed
     */
    async resumeSchedule(scheduleId: string, note?: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            await handle.unpause(note || 'Resumed via NestJS Temporal integration');
            this.logger.log(`Resumed schedule: ${scheduleId}`);
        } catch (error) {
            this.logger.error(`Failed to resume schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to resume schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Delete a schedule
     *
     * @param scheduleId ID of the schedule to delete
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            await handle.delete();
            this.logger.log(`Deleted schedule: ${scheduleId}`);
        } catch (error) {
            this.logger.error(`Failed to delete schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to delete schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * Trigger an immediate run of a scheduled workflow
     *
     * @param scheduleId ID of the schedule to trigger
     * @param overlap How to handle overlapping executions (default: ALLOW_ALL)
     */
    async triggerNow(
        scheduleId: string,
        overlap: ScheduleOverlapPolicy = 'ALLOW_ALL',
    ): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.scheduleClient!.getHandle(scheduleId);
            await handle.trigger(overlap);
            this.logger.log(`Triggered immediate run of schedule: ${scheduleId}`);
        } catch (error) {
            this.logger.error(`Failed to trigger schedule '${scheduleId}': ${error.message}`);
            throw new Error(`Failed to trigger schedule '${scheduleId}': ${error.message}`);
        }
    }

    /**
     * List all schedules
     *
     * @param pageSize Maximum number of schedules to return (default: 100)
     * @returns Array of schedule summaries
     */
    async listSchedules(pageSize = 100): Promise<any[]> {
        this.ensureClientInitialized();

        try {
            // Collect all schedules in an array
            const schedules: any[] = [];
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
     * Get the Temporal Schedule client
     * @returns The schedule client
     */
    getScheduleClient(): ScheduleClient | null {
        return this.scheduleClient;
    }
}
