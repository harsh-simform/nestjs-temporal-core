import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ScheduleClient, ScheduleHandle } from '@temporalio/client';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CLIENT } from '../constants';
import {
    TemporalOptions,
    ScheduleCreationOptions,
    ScheduleCreationResult,
    ScheduleRetrievalResult,
    ScheduleServiceStatus,
    ScheduleServiceHealth,
    ScheduleServiceStats,
    ScheduleDiscoveryResult,
    ScheduleRegistrationResult,
    ScheduleClientInitResult,
    ScheduleWorkflowOptions,
    ScheduleSpecBuilderResult,
    ScheduleIntervalParseResult,
    TemporalConnection,
    ScheduleWorkflowAction,
    ScheduleOptions,
} from '../interfaces';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import { TemporalLogger } from '../utils/logger';

/**
 * Service for managing Temporal schedules including creating, updating, and monitoring scheduled workflows
 */
@Injectable()
export class TemporalScheduleService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TemporalScheduleService.name);
    private readonly temporalLogger = new TemporalLogger(TemporalScheduleService.name);
    private scheduleClient?: ScheduleClient;
    private scheduleHandles = new Map<string, ScheduleHandle>();
    private isInitialized = false;

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        @Inject(TEMPORAL_CLIENT)
        private readonly client: { schedule?: ScheduleClient; connection?: TemporalConnection },
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {}

    /**
     * Initialize the schedule service
     */
    async onModuleInit(): Promise<void> {
        try {
            this.logger.log('Initializing Temporal Schedule Service...');
            await this.initializeScheduleClient();
            await this.discoverAndRegisterSchedules();
            this.isInitialized = true;
            this.logger.log('Temporal Schedule Service initialized successfully');
        } catch (error) {
            this.logger.error(
                `Failed to initialize Temporal Schedule Service: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            throw error;
        }
    }

    /**
     * Cleanup on module destroy
     */
    async onModuleDestroy(): Promise<void> {
        try {
            this.logger.log('Shutting down Temporal Schedule Service...');
            this.scheduleHandles.clear();
            this.isInitialized = false;
            this.logger.log('Temporal Schedule Service shut down successfully');
        } catch (error) {
            this.logger.error(
                `Error during schedule service shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    /**
     * Initialize the schedule client
     */
    private async initializeScheduleClient(): Promise<ScheduleClientInitResult> {
        try {
            // Check if the client has schedule support
            if (this.client?.schedule) {
                this.scheduleClient = this.client.schedule;
                this.temporalLogger.debug('Schedule client initialized from existing client');
                return {
                    success: true,
                    client: this.scheduleClient,
                    source: 'existing',
                };
            } else {
                // Try to create a new schedule client if none exists
                try {
                    this.scheduleClient = new ScheduleClient({
                        connection: this.client.connection as never,
                        namespace: this.options.connection?.namespace || 'default',
                    });
                    this.temporalLogger.debug('Schedule client initialized successfully');
                    return {
                        success: true,
                        client: this.scheduleClient,
                        source: 'new',
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    this.logger.warn(`Schedule client not available: ${errorMessage}`);
                    this.scheduleClient = undefined;
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(errorMessage),
                        source: 'none',
                    };
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to initialize schedule client: ${errorMessage}`);
            this.scheduleClient = undefined;
            return {
                success: false,
                error: error instanceof Error ? error : new Error(errorMessage),
                source: 'none',
            };
        }
    }

    /**
     * Discover and register scheduled workflows
     */
    private async discoverAndRegisterSchedules(): Promise<ScheduleDiscoveryResult> {
        const startTime = Date.now();
        const discoveredCount = 0;

        try {
            // Skip automatic discovery for now since schedule decorators are not implemented
            // This prevents the gRPC errors from trying to create schedules for every provider
            this.temporalLogger.debug(
                'Schedule discovery skipped - schedule decorators not implemented',
            );

            const duration = Date.now() - startTime;
            this.temporalLogger.debug(
                `Discovered and registered ${discoveredCount} scheduled workflows`,
            );

            return {
                success: true,
                discoveredCount,
                errors: [],
                duration,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to discover schedules: ${errorMessage}`);
            return {
                success: false,
                discoveredCount: 0,
                errors: [{ schedule: 'discovery', error: errorMessage }],
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Register a scheduled workflow
     */
    private async registerScheduledWorkflow(
        instance: unknown,
        metatype: Function,
        scheduleMetadata: Record<string, unknown>,
    ): Promise<ScheduleRegistrationResult> {
        try {
            const scheduleId =
                (scheduleMetadata.scheduleId as string) || `${metatype.name}-schedule`;
            const workflowType = (scheduleMetadata.workflowType as string) || metatype.name;

            const scheduleSpecResult = this.buildScheduleSpec(scheduleMetadata);
            if (!scheduleSpecResult.success) {
                return {
                    success: false,
                    scheduleId,
                    error: scheduleSpecResult.error,
                };
            }

            const workflowOptions = this.buildWorkflowOptions(scheduleMetadata);

            // Create the schedule
            const action: ScheduleWorkflowAction = {
                type: 'startWorkflow',
                workflowType,
                taskQueue: (scheduleMetadata.taskQueue as string) || 'default',
                args: (scheduleMetadata.args as unknown[]) || [],
                ...workflowOptions,
            };

            const scheduleOptions: ScheduleOptions = {
                scheduleId,
                spec: scheduleSpecResult.spec!,
                action,
                memo: (scheduleMetadata.memo as Record<string, unknown>) || {},
                searchAttributes:
                    (scheduleMetadata.searchAttributes as Record<string, unknown>) || {},
            };

            const scheduleHandle = await this.scheduleClient!.create(scheduleOptions as never);

            this.scheduleHandles.set(scheduleId, scheduleHandle);

            this.temporalLogger.debug(
                `Registered scheduled workflow: ${scheduleId} with type: ${workflowType}`,
            );

            return {
                success: true,
                scheduleId,
                handle: scheduleHandle,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to register scheduled workflow: ${errorMessage}`);
            return {
                success: false,
                scheduleId: (scheduleMetadata.scheduleId as string) || `${metatype.name}-schedule`,
                error: error instanceof Error ? error : new Error(errorMessage),
            };
        }
    }

    /**
     * Build schedule specification from metadata
     */
    private buildScheduleSpec(
        scheduleMetadata: Record<string, unknown>,
    ): ScheduleSpecBuilderResult {
        try {
            const spec: Record<string, unknown> = {};

            // Handle cron schedules
            if (scheduleMetadata.cron) {
                spec.cronExpressions = Array.isArray(scheduleMetadata.cron)
                    ? scheduleMetadata.cron
                    : [scheduleMetadata.cron];
            }

            // Handle interval schedules
            if (scheduleMetadata.interval) {
                const intervals = Array.isArray(scheduleMetadata.interval)
                    ? scheduleMetadata.interval
                    : [scheduleMetadata.interval];
                const parsedIntervals = intervals
                    .map((interval) => {
                        const result = this.parseInterval(interval);
                        return result.success ? result.interval : null;
                    })
                    .filter(Boolean);

                if (parsedIntervals.length > 0) {
                    spec.intervals = parsedIntervals;
                }
            }

            // Handle calendar schedules
            if (scheduleMetadata.calendar) {
                spec.calendars = Array.isArray(scheduleMetadata.calendar)
                    ? scheduleMetadata.calendar
                    : [scheduleMetadata.calendar];
            }

            // Handle timezone
            if (scheduleMetadata.timezone) {
                spec.timeZone = scheduleMetadata.timezone;
            }

            // Handle jitter
            if (scheduleMetadata.jitter) {
                spec.jitter = scheduleMetadata.jitter;
            }

            return {
                success: true,
                spec,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }

    /**
     * Build workflow options from metadata
     */
    private buildWorkflowOptions(
        scheduleMetadata: Record<string, unknown>,
    ): ScheduleWorkflowOptions {
        const options: ScheduleWorkflowOptions = {};

        if (scheduleMetadata.taskQueue) {
            options.taskQueue = scheduleMetadata.taskQueue as string;
        }

        if (scheduleMetadata.workflowId) {
            options.workflowId = scheduleMetadata.workflowId as string;
        }

        if (scheduleMetadata.workflowExecutionTimeout) {
            options.workflowExecutionTimeout = scheduleMetadata.workflowExecutionTimeout as string;
        }

        if (scheduleMetadata.workflowRunTimeout) {
            options.workflowRunTimeout = scheduleMetadata.workflowRunTimeout as string;
        }

        if (scheduleMetadata.workflowTaskTimeout) {
            options.workflowTaskTimeout = scheduleMetadata.workflowTaskTimeout as string;
        }

        if (scheduleMetadata.retryPolicy) {
            options.retryPolicy = scheduleMetadata.retryPolicy as Record<string, unknown>;
        }

        if (scheduleMetadata.args) {
            options.args = scheduleMetadata.args as unknown[];
        }

        return options;
    }

    /**
     * Parse interval string to Temporal interval format
     */
    private parseInterval(interval: string | number): ScheduleIntervalParseResult {
        try {
            if (typeof interval === 'number') {
                return {
                    success: true,
                    interval: { every: `${interval}ms` },
                };
            }

            // Handle various interval formats
            const intervalStr = interval.toString().toLowerCase();

            if (intervalStr.includes('ms')) {
                return {
                    success: true,
                    interval: { every: intervalStr },
                };
            }

            if (intervalStr.includes('s')) {
                return {
                    success: true,
                    interval: { every: intervalStr },
                };
            }

            if (intervalStr.includes('m')) {
                return {
                    success: true,
                    interval: { every: intervalStr },
                };
            }

            if (intervalStr.includes('h')) {
                return {
                    success: true,
                    interval: { every: intervalStr },
                };
            }

            // Default to milliseconds if no unit specified
            return {
                success: true,
                interval: { every: `${interval}ms` },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    }

    /**
     * Create a new schedule
     */
    async createSchedule(options: ScheduleCreationOptions): Promise<ScheduleCreationResult> {
        this.ensureInitialized();

        try {
            const scheduleHandle = await this.scheduleClient!.create(options as never);
            this.scheduleHandles.set(options.scheduleId, scheduleHandle);

            this.temporalLogger.debug(`Created schedule: ${options.scheduleId}`);

            return {
                success: true,
                scheduleId: options.scheduleId,
                handle: scheduleHandle,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to create schedule ${options.scheduleId}: ${errorMessage}`);
            return {
                success: false,
                scheduleId: options.scheduleId,
                error: error instanceof Error ? error : new Error(errorMessage),
            };
        }
    }

    /**
     * Get a schedule handle
     */
    async getSchedule(scheduleId: string): Promise<ScheduleRetrievalResult> {
        this.ensureInitialized();

        try {
            // Check local cache first
            let scheduleHandle = this.scheduleHandles.get(scheduleId);

            if (!scheduleHandle) {
                // Try to get from Temporal
                scheduleHandle = this.scheduleClient!.getHandle(scheduleId);
                this.scheduleHandles.set(scheduleId, scheduleHandle);
            }

            return {
                success: true,
                handle: scheduleHandle,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get schedule ${scheduleId}: ${errorMessage}`);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(errorMessage),
            };
        }
    }

    /**
     * Check if service is healthy
     */
    isHealthy(): boolean {
        return this.isInitialized;
    }

    /**
     * Get schedule statistics
     */
    getScheduleStats(): ScheduleServiceStats {
        return {
            total: this.scheduleHandles.size,
            active: this.scheduleHandles.size,
            inactive: 0,
            errors: 0,
            lastUpdated: new Date(),
        };
    }

    /**
     * Get service status
     */
    getStatus(): ScheduleServiceStatus {
        return {
            available: this.isInitialized,
            healthy: this.isHealthy(),
            schedulesSupported: !!this.scheduleClient,
            initialized: this.isInitialized,
        };
    }

    /**
     * Get service health status
     */
    getHealth(): ScheduleServiceHealth {
        return {
            status: this.isInitialized ? 'healthy' : 'unhealthy',
            schedulesCount: this.scheduleHandles.size,
            isInitialized: this.isInitialized,
            details: {
                scheduleIds: Array.from(this.scheduleHandles.keys()),
                hasScheduleClient: !!this.scheduleClient,
            },
        };
    }

    /**
     * Ensure service is initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Temporal Schedule Service is not initialized');
        }
    }
}
