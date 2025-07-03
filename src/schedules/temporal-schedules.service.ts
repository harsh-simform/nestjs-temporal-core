import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { TemporalDiscoveryService } from '../discovery/temporal-discovery.service';
import {
    SchedulesModuleOptions,
    ScheduledMethodInfo,
    ScheduleInfo,
    ScheduledOptions,
} from '../interfaces';
import { SCHEDULES_MODULE_OPTIONS } from '../constants';
import { TemporalLogger } from '../utils/logger';

/**
 * Temporal Schedules Service
 * Manages schedule discovery, registration, and execution
 */
@Injectable()
export class TemporalSchedulesService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private readonly managedSchedules = new Map<string, ScheduleInfo>();

    constructor(
        @Inject(SCHEDULES_MODULE_OPTIONS)
        private readonly options: SchedulesModuleOptions,
        private readonly discoveryService: TemporalDiscoveryService,
    ) {
        this.logger = new TemporalLogger(TemporalSchedulesService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    async onModuleInit() {
        await this.initializeSchedules();
        this.logScheduleSummary();
    }

    // ==========================================
    // Schedule Initialization
    // ==========================================

    /**
     * Initialize all discovered schedules
     */
    private async initializeSchedules(): Promise<void> {
        const scheduledWorkflows = this.discoveryService.getScheduledWorkflows();

        for (const scheduledWorkflow of scheduledWorkflows) {
            try {
                const scheduleInfo = this.createScheduleInfo(scheduledWorkflow);
                this.managedSchedules.set(
                    scheduledWorkflow.scheduleOptions.scheduleId,
                    scheduleInfo,
                );

                this.logger.debug(
                    `Registered schedule: ${scheduledWorkflow.scheduleOptions.scheduleId} -> ${scheduledWorkflow.workflowName}`,
                );
            } catch (error) {
                this.logger.error(
                    `Failed to register schedule ${scheduledWorkflow.scheduleOptions.scheduleId}:`,
                    error.stack,
                );
            }
        }

        this.logger.log(`Initialized ${this.managedSchedules.size} schedules`);
    }

    /**
     * Create schedule info from scheduled method info
     */
    private createScheduleInfo(scheduledWorkflow: ScheduledMethodInfo): ScheduleInfo {
        const { scheduleOptions, workflowName, handler, controllerInfo } = scheduledWorkflow;

        return {
            scheduleId: scheduleOptions.scheduleId,
            workflowName,
            cronExpression: scheduleOptions.cron,
            intervalExpression: scheduleOptions.interval,
            description: scheduleOptions.description,
            timezone: scheduleOptions.timezone || this.options.defaultTimezone || 'UTC',
            overlapPolicy: scheduleOptions.overlapPolicy || 'SKIP',
            isActive: !scheduleOptions.startPaused,
            autoStart: scheduleOptions.autoStart !== false,
            taskQueue: scheduleOptions.taskQueue,
            handler,
            controllerInfo,
            createdAt: new Date(),
            lastTriggered: undefined,
            nextRun: this.calculateNextRun(scheduleOptions),
        };
    }

    /**
     * Calculate next run time for a schedule
     */
    private calculateNextRun(scheduleOptions: ScheduledOptions): Date | undefined {
        // In a real implementation, this would calculate the next run time
        // based on cron expression or interval
        if (scheduleOptions.cron) {
            // Parse cron expression and calculate next run
            return new Date(Date.now() + 60000); // Placeholder: 1 minute from now
        }

        if (scheduleOptions.interval) {
            // Parse interval and calculate next run
            const intervalMs = this.parseInterval(scheduleOptions.interval);
            return new Date(Date.now() + intervalMs);
        }

        return undefined;
    }

    /**
     * Parse interval string to milliseconds
     */
    private parseInterval(interval: string): number {
        // Simple parser for intervals like "5m", "1h", "30s", "500ms"
        const match = interval.match(/^(\d+)(ms|[smhd])$/);
        if (!match) return 60000; // Default 1 minute

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'ms':
                return value;
            case 's':
                return value * 1000;
            case 'm':
                return value * 60 * 1000;
            case 'h':
                return value * 60 * 60 * 1000;
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            default:
                return 60000;
        }
    }

    // ==========================================
    // Public API
    // ==========================================

    /**
     * Get all managed schedules
     */
    getManagedSchedules(): ScheduleInfo[] {
        return Array.from(this.managedSchedules.values());
    }

    /**
     * Get schedule by ID
     */
    getSchedule(scheduleId: string): ScheduleInfo | undefined {
        return this.managedSchedules.get(scheduleId);
    }

    /**
     * Get schedule IDs
     */
    getScheduleIds(): string[] {
        return Array.from(this.managedSchedules.keys());
    }

    /**
     * Check if schedule is managed
     */
    isScheduleManaged(scheduleId: string): boolean {
        return this.managedSchedules.has(scheduleId);
    }

    /**
     * Get active schedules
     */
    getActiveSchedules(): ScheduleInfo[] {
        return this.getManagedSchedules().filter((schedule) => schedule.isActive);
    }

    /**
     * Get schedules by workflow name
     */
    getSchedulesByWorkflow(workflowName: string): ScheduleInfo[] {
        return this.getManagedSchedules().filter(
            (schedule) => schedule.workflowName === workflowName,
        );
    }

    /**
     * Get schedules by task queue
     */
    getSchedulesByTaskQueue(taskQueue: string): ScheduleInfo[] {
        return this.getManagedSchedules().filter((schedule) => schedule.taskQueue === taskQueue);
    }

    /**
     * Update schedule status
     */
    async updateScheduleStatus(scheduleId: string, isActive: boolean): Promise<void> {
        const schedule = this.managedSchedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        schedule.isActive = isActive;
        schedule.lastModified = new Date();

        this.logger.log(`Schedule ${scheduleId} ${isActive ? 'activated' : 'deactivated'}`);
    }

    /**
     * Record schedule trigger
     */
    async recordScheduleTrigger(scheduleId: string): Promise<void> {
        const schedule = this.managedSchedules.get(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule ${scheduleId} not found`);
        }

        schedule.lastTriggered = new Date();
        schedule.triggerCount = (schedule.triggerCount || 0) + 1;
        schedule.nextRun = this.calculateNextRun(schedule);

        this.logger.debug(`Recorded trigger for schedule ${scheduleId}`);
    }

    /**
     * Get schedule statistics
     */
    getScheduleStats(): {
        total: number;
        active: number;
        inactive: number;
        cron: number;
        interval: number;
        errors: number;
    } {
        const schedules = this.getManagedSchedules();

        return {
            total: schedules.length,
            active: schedules.filter((s) => s.isActive).length,
            inactive: schedules.filter((s) => !s.isActive).length,
            cron: schedules.filter((s) => s.cronExpression).length,
            interval: schedules.filter((s) => s.intervalExpression).length,
            errors: schedules.filter((s) => s.lastError).length,
        };
    }

    /**
     * Validate schedule configuration
     */
    validateSchedules(): {
        isValid: boolean;
        issues: string[];
        warnings: string[];
    } {
        const issues: string[] = [];
        const warnings: string[] = [];
        const schedules = this.getManagedSchedules();

        // Check for duplicate schedule IDs
        const scheduleIds = schedules.map((s) => s.scheduleId);
        const duplicates = scheduleIds.filter((id, index) => scheduleIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            issues.push(`Duplicate schedule IDs found: ${duplicates.join(', ')}`);
        }

        // Check for invalid cron expressions
        schedules.forEach((schedule) => {
            if (schedule.cronExpression && !this.isValidCronExpression(schedule.cronExpression)) {
                issues.push(
                    `Invalid cron expression for schedule ${schedule.scheduleId}: ${schedule.cronExpression}`,
                );
            }
        });

        // Check for schedules without next run time
        const unscheduled = schedules.filter((s) => s.isActive && !s.nextRun);
        if (unscheduled.length > 0) {
            warnings.push(
                `Some active schedules have no next run time: ${unscheduled.map((s) => s.scheduleId).join(', ')}`,
            );
        }

        return {
            isValid: issues.length === 0,
            issues,
            warnings,
        };
    }

    /**
     * Get health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        schedules: {
            total: number;
            active: number;
            errors: number;
        };
        validation: {
            isValid: boolean;
            issues: string[];
            warnings: string[];
        };
    } {
        const stats = this.getScheduleStats();
        const validation = this.validateSchedules();

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (!validation.isValid) {
            status = 'unhealthy';
        } else if (validation.warnings.length > 0 || stats.errors > 0) {
            status = 'degraded';
        } else {
            status = 'healthy';
        }

        return {
            status,
            schedules: {
                total: stats.total,
                active: stats.active,
                errors: stats.errors,
            },
            validation,
        };
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Validate cron expression (basic validation)
     */
    private isValidCronExpression(cron: string): boolean {
        // Basic cron expression validation
        const parts = cron.trim().split(/\s+/);
        return parts.length >= 5 && parts.length <= 6;
    }

    /**
     * Log schedule summary
     */
    private logScheduleSummary(): void {
        const stats = this.getScheduleStats();
        const validation = this.validateSchedules();

        this.logger.log(
            `Schedule discovery completed: ${stats.total} total, ${stats.active} active, ${stats.cron} cron, ${stats.interval} interval`,
        );

        if (stats.total > 0) {
            const scheduleIds = this.getScheduleIds();
            this.logger.debug(`Managed schedules: ${scheduleIds.join(', ')}`);
        }

        // Log validation results
        if (validation.warnings.length > 0) {
            validation.warnings.forEach((warning) => this.logger.warn(warning));
        }

        if (validation.issues.length > 0) {
            validation.issues.forEach((issue) => this.logger.error(issue));
        }
    }
}
