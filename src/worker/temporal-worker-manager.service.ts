import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TemporalMetadataAccessor } from './temporal-metadata.accessor';
import { DEFAULT_NAMESPACE, ERRORS, TEMPORAL_MODULE_OPTIONS, WORKER_PRESETS } from '../constants';
import { ActivityMethodHandler, WorkerCreateOptions, WorkerStatus, LogLevel } from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';

// Worker-specific options interface to properly type the injected options
interface WorkerModuleOptions {
    connection?: {
        address?: string;
        namespace?: string;
        tls?: boolean | object;
        apiKey?: string;
        metadata?: Record<string, string>;
    };
    taskQueue?: string;
    workflowsPath?: string;
    workflowBundle?: unknown;
    activityClasses?: Array<unknown>;
    autoStart?: boolean;
    autoRestart?: boolean;
    allowWorkerFailure?: boolean;
    workerOptions?: WorkerCreateOptions;
    enableLogger?: boolean;
    logLevel?: LogLevel;
}

@Injectable()
export class TemporalWorkerManagerService
    implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
    private readonly logger: TemporalLogger;

    // Worker state
    private worker: Worker | null = null;
    private connection: NativeConnection | null = null;
    private isInitialized = false;
    private isRunning = false;
    private startedAt?: Date;
    private lastError?: string;
    private activities: Record<string, ActivityMethodHandler> = {};
    private workerPromise: Promise<void> | null = null;

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: WorkerModuleOptions,
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {
        this.logger = createLogger(TemporalWorkerManagerService.name);
    }

    async onModuleInit() {
        try {
            this.logger.log('Initializing Temporal worker...');
            await this.initializeWorker();
            this.isInitialized = true;
            this.logger.log('Temporal worker initialization completed');
        } catch (error) {
            this.lastError = error?.message || 'Unknown initialization error';
            this.logger.error('Error during worker initialization', error?.stack || error);

            if (this.options?.allowWorkerFailure !== false) {
                this.logger.warn('Continuing application startup without Temporal worker');
            } else {
                throw error;
            }
        }
    }

    async onApplicationBootstrap() {
        if (this.options?.autoStart === false || !this.worker) {
            this.logger.debug('Worker auto-start disabled or worker not initialized');
            return;
        }

        // Start worker in background - DO NOT BLOCK APPLICATION STARTUP
        this.startWorkerInBackground();
    }

    async onModuleDestroy() {
        await this.shutdown();
    }

    // ==========================================
    // Worker Lifecycle (NON-BLOCKING)
    // ==========================================

    /**
     * Start worker in background without blocking application startup
     */
    private startWorkerInBackground(): void {
        if (!this.worker || this.isRunning) {
            return;
        }

        this.logger.log(`Starting worker for task queue: ${this.options?.taskQueue} in background`);

        this.workerPromise = this.runWorkerLoop().catch((error) => {
            this.isRunning = false;
            this.lastError = error?.message || 'Unknown worker error';
            this.logger.error('Worker crashed', error?.stack || error);

            // Optionally restart worker after delay
            if (this.options?.autoRestart !== false) {
                setTimeout(() => {
                    this.logger.log('Attempting to restart worker...');
                    this.startWorkerInBackground();
                }, 5000);
            }
        });
    }

    /**
     * Worker run loop (blocking, but runs in background)
     */
    private async runWorkerLoop(): Promise<void> {
        if (!this.worker) {
            throw new Error(ERRORS.WORKER_NOT_INITIALIZED);
        }

        this.isRunning = true;
        this.startedAt = new Date();
        this.lastError = undefined;

        this.logger.log('Worker started successfully');

        // This blocks, but it's running in background
        await this.worker.run();
    }

    /**
     * Initialize worker but don't start it yet
     */
    private async initializeWorker(): Promise<void> {
        this.validateConfiguration();
        this.activities = await this.discoverActivities();
        await this.createConnection();
        await this.createWorker();
        this.logWorkerConfiguration();
    }

    private validateConfiguration(): void {
        const taskQueue = this.options?.taskQueue as string;
        if (!taskQueue) {
            throw new Error(ERRORS.MISSING_TASK_QUEUE);
        }

        const workflowsPath = this.options?.workflowsPath as string | undefined;
        const workflowBundle = this.options?.workflowBundle as unknown;

        const hasWorkflowsPath = Boolean(workflowsPath);
        const hasWorkflowBundle = Boolean(workflowBundle);

        if (hasWorkflowsPath && hasWorkflowBundle) {
            throw new Error('Cannot specify both workflowsPath and workflowBundle');
        }

        if (hasWorkflowBundle) {
            this.logger.debug('Using pre-bundled workflows (recommended for production)');
        } else if (hasWorkflowsPath) {
            this.logger.debug('Using workflows from filesystem path (recommended for development)');
        } else {
            this.logger.debug('Worker configured for activities only (no workflows)');
        }
    }

    private async createConnection(): Promise<void> {
        const connection = this.options?.connection;
        const connectionOptions: Record<string, unknown> = {
            address: connection?.address || 'localhost:7233',
            tls: connection?.tls,
        };

        if (connection?.apiKey) {
            connectionOptions.metadata = {
                ...(connection?.metadata || {}),
                authorization: `Bearer ${connection.apiKey}`,
            };
        }

        this.logger.debug(`Connecting to Temporal server at ${connectionOptions.address}`);
        this.connection = await NativeConnection.connect(connectionOptions);
        this.logger.debug('Temporal connection established');
    }

    private async createWorker(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const workerOptions = this.buildWorkerOptions();

        const connection = this.options?.connection;
        const namespace = connection?.namespace || DEFAULT_NAMESPACE;

        this.worker = await Worker.create({
            connection: this.connection,
            namespace,
            taskQueue: this.options?.taskQueue as string,
            ...workerOptions,
        });

        this.logger.log(
            `Worker created for queue: ${this.options?.taskQueue} in namespace: ${namespace}`,
        );
    }

    private buildWorkerOptions(): Record<string, unknown> {
        const baseOptions: Record<string, unknown> = {
            taskQueue: this.options?.taskQueue,
            activities: this.activities,
        };

        const workflowBundle = this.options?.workflowBundle;
        const workflowsPath = this.options?.workflowsPath as string | undefined;

        if (workflowBundle) {
            baseOptions.workflowBundle = workflowBundle;
        } else if (workflowsPath) {
            baseOptions.workflowsPath = workflowsPath;
        }

        const defaultOptions = this.getEnvironmentDefaults();
        const userOptions = (this.options?.workerOptions as Record<string, unknown>) || {};

        return {
            ...baseOptions,
            ...defaultOptions,
            ...userOptions,
        };
    }

    private getEnvironmentDefaults(): WorkerCreateOptions {
        const env = process.env.NODE_ENV || 'development';

        switch (env) {
            case 'production':
                return WORKER_PRESETS.PRODUCTION_BALANCED;
            case 'development':
                return WORKER_PRESETS.DEVELOPMENT;
            default:
                return {
                    maxConcurrentActivityTaskExecutions: 20,
                    maxConcurrentWorkflowTaskExecutions: 10,
                    maxConcurrentLocalActivityExecutions: 20,
                    reuseV8Context: true,
                };
        }
    }

    private async discoverActivities(): Promise<Record<string, ActivityMethodHandler>> {
        const activities: Record<string, ActivityMethodHandler> = {};
        const providers = this.discoveryService.getProviders();

        const activityProviders = providers.filter((wrapper) => {
            const { instance, metatype } = wrapper;
            const targetClass = instance?.constructor || metatype;

            if (!targetClass) return false;

            const activityClasses = this.options?.activityClasses;
            if (activityClasses?.length) {
                return (
                    activityClasses.includes(targetClass) &&
                    this.metadataAccessor.isActivity(targetClass)
                );
            }

            return this.metadataAccessor.isActivity(targetClass);
        });

        this.logger.log(`Found ${activityProviders.length} activity providers`);

        for (const wrapper of activityProviders) {
            const { instance } = wrapper;
            if (!instance) continue;

            try {
                const className = instance.constructor.name;
                this.logger.debug(`Processing activity class: ${className}`);

                const validation = this.metadataAccessor.validateActivityClass(
                    instance.constructor,
                );
                if (!validation.isValid) {
                    this.logger.warn(
                        `Activity class ${className} has issues: ${validation.issues.join(', ')}`,
                    );
                    continue;
                }

                const activityMethods = this.metadataAccessor.extractActivityMethods(instance);

                for (const [activityName, method] of activityMethods.entries()) {
                    activities[activityName] = method as ActivityMethodHandler;
                    this.logger.debug(`Registered activity: ${className}.${activityName}`);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to process activity class ${instance.constructor.name}:`,
                    error?.stack || error,
                );
            }
        }

        const activityCount = Object.keys(activities).length;
        this.logger.log(`Registered ${activityCount} activity methods in total`);

        return activities;
    }

    private logWorkerConfiguration(): void {
        const connection = this.options?.connection;
        const workflowBundle = this.options?.workflowBundle;
        const workflowsPath = this.options?.workflowsPath;

        const config = {
            taskQueue: this.options?.taskQueue,
            namespace: connection?.namespace || DEFAULT_NAMESPACE,
            workflowSource: workflowBundle ? 'bundle' : workflowsPath ? 'filesystem' : 'none',
            activitiesCount: Object.keys(this.activities).length,
            autoStart: this.options?.autoStart !== false,
            environment: process.env.NODE_ENV || 'development',
        };

        this.logger.log('Worker configuration summary:');
        this.logger.debug(JSON.stringify(config, null, 2));
    }

    // ==========================================
    // Public API
    // ==========================================

    async shutdown(): Promise<void> {
        this.logger.log('Shutting down Temporal worker...');

        if (this.worker && this.isRunning) {
            try {
                await this.worker.shutdown();
                this.isRunning = false;
                this.logger.log('Worker shut down successfully');
            } catch (error) {
                this.logger.error('Error during worker shutdown', error?.stack);
            } finally {
                this.worker = null;
            }
        }

        if (this.connection) {
            try {
                await this.connection.close();
                this.logger.log('Connection closed successfully');
            } catch (error) {
                this.logger.error('Error during connection close', error?.stack);
            } finally {
                this.connection = null;
            }
        }

        this.isInitialized = false;
        this.startedAt = undefined;
    }

    getWorker(): Worker | null {
        return this.worker;
    }

    getConnection(): NativeConnection | null {
        return this.connection;
    }

    isWorkerRunning(): boolean {
        return this.isRunning;
    }

    isWorkerInitialized(): boolean {
        return this.isInitialized;
    }

    getWorkerStatus(): WorkerStatus {
        const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : undefined;
        const connection = this.options?.connection;
        const workflowBundle = this.options?.workflowBundle;
        const workflowsPath = this.options?.workflowsPath;

        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            isHealthy: this.isInitialized && !this.lastError && this.connection !== null,
            taskQueue: (this.options?.taskQueue as string) || 'unknown',
            namespace: connection?.namespace || DEFAULT_NAMESPACE,
            workflowSource: workflowBundle ? 'bundle' : workflowsPath ? 'filesystem' : 'none',
            activitiesCount: Object.keys(this.activities).length,
            lastError: this.lastError,
            startedAt: this.startedAt,
            uptime,
        };
    }

    getRegisteredActivities(): string[] {
        return Object.keys(this.activities);
    }

    async restartWorker(): Promise<void> {
        this.logger.log('Restarting Temporal worker...');

        // First shutdown the existing worker
        await this.shutdown();

        // Re-initialize the worker
        try {
            await this.initializeWorker();
            this.isInitialized = true;
            this.logger.log('Worker restarted successfully');

            // Start the worker if auto-start is enabled
            if (this.options?.autoStart !== false) {
                this.startWorkerInBackground();
            }
        } catch (error) {
            this.lastError = (error as Error)?.message || 'Unknown restart error';
            this.logger.error('Error during worker restart', (error as Error)?.stack || error);
            throw error;
        }
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded';
        details: WorkerStatus;
        activities: {
            total: number;
            registered: string[];
        };
    }> {
        const status = this.getWorkerStatus();
        const activities = this.getRegisteredActivities();

        let healthStatus: 'healthy' | 'unhealthy' | 'degraded';

        if (!status.isInitialized) {
            healthStatus = 'unhealthy';
        } else if (status.lastError) {
            healthStatus = 'degraded';
        } else if (status.isHealthy) {
            healthStatus = 'healthy';
        } else {
            healthStatus = 'degraded';
        }

        return {
            status: healthStatus,
            details: status,
            activities: {
                total: activities.length,
                registered: activities,
            },
        };
    }
}
