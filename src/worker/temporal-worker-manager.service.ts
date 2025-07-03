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
import { ActivityMethodHandler, WorkerCreateOptions, WorkerStatus } from '../interfaces';
import { TemporalLogger } from '../utils/logger';

/**
 * Streamlined Temporal Worker Manager Service
 * Creates and manages Temporal workers with comprehensive lifecycle management
 */
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

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: any,
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {
        this.logger = new TemporalLogger(TemporalWorkerManagerService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    // ==========================================
    // Lifecycle Methods
    // ==========================================

    async onModuleInit() {
        try {
            this.logger.log('Initializing Temporal worker...');
            await this.initializeWorker();
            this.isInitialized = true;
            this.logger.log('Temporal worker initialization completed');
        } catch (error) {
            this.lastError = error?.message || 'Unknown initialization error';
            this.logger.error('Error during worker initialization', error?.stack || error);

            if (this.options.allowWorkerFailure !== false) {
                this.logger.warn('Continuing application startup without Temporal worker');
            } else {
                throw error;
            }
        }
    }

    async onApplicationBootstrap() {
        if (this.options.autoStart === false || !this.worker) {
            this.logger.debug('Worker auto-start disabled or worker not initialized');
            return;
        }

        // Don't block application startup if worker fails to start
        try {
            await this.startWorker();
        } catch (error) {
            this.logger.error(
                'Failed to start worker during application bootstrap',
                error?.stack || error,
            );
            if (this.options.allowWorkerFailure === false) {
                throw error;
            }
        }
    }

    async onModuleDestroy() {
        await this.shutdown();
    }

    // ==========================================
    // Worker Initialization
    // ==========================================

    /**
     * Initialize the worker with comprehensive setup
     */
    private async initializeWorker(): Promise<void> {
        this.validateConfiguration();
        this.activities = await this.discoverActivities();
        await this.createConnection();
        await this.createWorker();
        this.logWorkerConfiguration();
    }

    /**
     * Validate worker configuration before initialization
     */
    private validateConfiguration(): void {
        if (!this.options.taskQueue) {
            throw new Error(ERRORS.MISSING_TASK_QUEUE);
        }

        const hasWorkflowsPath = Boolean(this.options.workflowsPath);
        const hasWorkflowBundle = Boolean(this.options.workflowBundle);

        // Allow worker to run with only activities (no workflows)
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

    /**
     * Create connection to Temporal server
     */
    private async createConnection(): Promise<void> {
        const connectionOptions: any = {
            address: this.options.connection?.address || 'localhost:7233',
            tls: this.options.connection?.tls,
        };

        if (this.options.connection?.apiKey) {
            connectionOptions.metadata = {
                ...(this.options.connection.metadata || {}),
                authorization: `Bearer ${this.options.connection.apiKey}`,
            };
        }

        this.logger.debug(`Connecting to Temporal server at ${connectionOptions.address}`);
        this.connection = await NativeConnection.connect(connectionOptions);
        this.logger.debug('Temporal connection established');
    }

    /**
     * Create the Temporal worker instance
     */
    private async createWorker(): Promise<void> {
        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const workerOptions = this.buildWorkerOptions();

        this.worker = await Worker.create({
            connection: this.connection,
            namespace: this.options.connection?.namespace || DEFAULT_NAMESPACE,
            ...workerOptions,
        });

        this.logger.log(
            `Worker created for queue: ${this.options.taskQueue} in namespace: ${
                this.options.connection?.namespace || DEFAULT_NAMESPACE
            }`,
        );
    }

    /**
     * Build comprehensive worker options from configuration
     */
    private buildWorkerOptions(): any {
        const baseOptions: any = {
            taskQueue: this.options.taskQueue,
            activities: this.activities,
        };

        // Add workflow configuration
        if (this.options.workflowBundle) {
            baseOptions.workflowBundle = this.options.workflowBundle;
        } else if (this.options.workflowsPath) {
            baseOptions.workflowsPath = this.options.workflowsPath;
        }

        // Apply environment-specific defaults
        const defaultOptions = this.getEnvironmentDefaults();

        // Merge with user-provided options
        const userOptions = this.options.workerOptions || {};

        return {
            ...baseOptions,
            ...defaultOptions,
            ...userOptions,
        };
    }

    /**
     * Get environment-specific default worker options
     */
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

    // ==========================================
    // Activity Discovery
    // ==========================================

    /**
     * Discover and register activity implementations
     */
    private async discoverActivities(): Promise<Record<string, ActivityMethodHandler>> {
        const activities: Record<string, ActivityMethodHandler> = {};
        const providers = this.discoveryService.getProviders();

        const activityProviders = providers.filter((wrapper) => {
            const { instance, metatype } = wrapper;
            const targetClass = instance?.constructor || metatype;

            if (!targetClass) return false;

            // Filter by specific activity classes if provided
            if (this.options.worker?.activityClasses?.length) {
                return (
                    this.options.worker.activityClasses.includes(targetClass) &&
                    this.metadataAccessor.isActivity(targetClass)
                );
            }

            // Otherwise, include all classes marked with @Activity()
            return this.metadataAccessor.isActivity(targetClass);
        });

        this.logger.log(`Found ${activityProviders.length} activity providers`);

        for (const wrapper of activityProviders) {
            const { instance } = wrapper;
            if (!instance) continue;

            try {
                const className = instance.constructor.name;
                this.logger.debug(`Processing activity class: ${className}`);

                // Validate the activity class
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
                    error.stack,
                );
            }
        }

        const activityCount = Object.keys(activities).length;
        this.logger.log(`Registered ${activityCount} activity methods in total`);

        return activities;
    }

    /**
     * Log comprehensive worker configuration
     */
    private logWorkerConfiguration(): void {
        const config = {
            taskQueue: this.options.taskQueue,
            namespace: this.options.connection?.namespace || DEFAULT_NAMESPACE,
            workflowSource: this.options.workflowBundle
                ? 'bundle'
                : this.options.workflowsPath
                  ? 'filesystem'
                  : 'none',
            activitiesCount: Object.keys(this.activities).length,
            autoStart: this.options.autoStart !== false,
            environment: process.env.NODE_ENV || 'development',
        };

        this.logger.log('Worker configuration summary:');
        this.logger.log(JSON.stringify(config, null, 2));

        if (this.options.workerOptions) {
            const additionalOptions = Object.keys(this.options.workerOptions).filter(
                (key) =>
                    !['taskQueue', 'activities', 'workflowsPath', 'workflowBundle'].includes(key),
            );

            if (additionalOptions.length > 0) {
                this.logger.debug(`Additional worker options: ${additionalOptions.join(', ')}`);
            }
        }
    }

    // ==========================================
    // Worker Management
    // ==========================================

    /**
     * Start the worker with enhanced error handling
     */
    async startWorker(): Promise<void> {
        if (!this.worker) {
            throw new Error(ERRORS.WORKER_NOT_INITIALIZED);
        }

        if (this.isRunning) {
            this.logger.warn('Worker is already running');
            return;
        }

        try {
            this.logger.log(`Starting worker for task queue: ${this.options.taskQueue}`);
            this.isRunning = true;
            this.startedAt = new Date();
            this.lastError = undefined;

            // Start the worker (this will block until shutdown)
            await this.worker.run();
        } catch (error) {
            this.isRunning = false;
            this.lastError = error?.message || 'Unknown worker error';
            this.logger.error('Error running worker', error?.stack || error);
            throw error;
        }
    }

    /**
     * Shutdown the worker and clean up resources
     */
    async shutdown(): Promise<void> {
        this.logger.log('Shutting down Temporal worker...');

        if (this.worker) {
            try {
                await this.worker.shutdown();
                this.isRunning = false;
                this.logger.log('Worker shut down successfully');
            } catch (error) {
                this.logger.error('Error during worker shutdown', error.stack);
            } finally {
                this.worker = null;
            }
        }

        if (this.connection) {
            try {
                await this.connection.close();
                this.logger.log('Connection closed successfully');
            } catch (error) {
                this.logger.error('Error during connection close', error.stack);
            } finally {
                this.connection = null;
            }
        }

        this.isInitialized = false;
        this.startedAt = undefined;
    }

    /**
     * Restart the worker (useful for configuration changes)
     */
    async restartWorker(): Promise<void> {
        this.logger.log('Restarting worker...');

        try {
            if (this.isRunning) {
                await this.shutdown();
            }

            await this.initializeWorker();

            if (this.options.autoStart !== false) {
                await this.startWorker();
            }
        } catch (error) {
            this.lastError = error?.message || 'Unknown restart error';
            this.logger.error('Error during worker restart', error?.stack || error);
            throw error;
        }
    }

    // ==========================================
    // Public API Methods
    // ==========================================

    /**
     * Get the worker instance
     */
    getWorker(): Worker | null {
        return this.worker;
    }

    /**
     * Get the connection instance
     */
    getConnection(): NativeConnection | null {
        return this.connection;
    }

    /**
     * Check if worker is running
     */
    isWorkerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Check if worker is initialized
     */
    isWorkerInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Get comprehensive worker status for monitoring
     */
    getWorkerStatus(): WorkerStatus {
        const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : undefined;

        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            isHealthy: this.isInitialized && !this.lastError && this.connection !== null,
            taskQueue: this.options.taskQueue,
            namespace: this.options.connection?.namespace || DEFAULT_NAMESPACE,
            workflowSource: this.options.workflowBundle
                ? 'bundle'
                : this.options.workflowsPath
                  ? 'filesystem'
                  : 'none',
            activitiesCount: Object.keys(this.activities).length,
            lastError: this.lastError,
            startedAt: this.startedAt,
            uptime,
        };
    }

    /**
     * Get list of registered activities
     */
    getRegisteredActivities(): string[] {
        return Object.keys(this.activities);
    }

    /**
     * Get detailed activity information
     */
    getActivityInfo(): Array<{
        name: string;
        className: string;
        methodName: string;
    }> {
        const activityInfo: Array<{
            name: string;
            className: string;
            methodName: string;
        }> = [];

        const providers = this.discoveryService.getProviders();

        for (const wrapper of providers) {
            const { instance } = wrapper;
            if (!instance || !this.metadataAccessor.isActivity(instance.constructor)) {
                continue;
            }

            const className = instance.constructor.name;
            const methodNames = this.metadataAccessor.getActivityMethodNames(instance.constructor);

            for (const methodName of methodNames) {
                activityInfo.push({
                    name: methodName,
                    className,
                    methodName,
                });
            }
        }

        return activityInfo;
    }

    /**
     * Health check method for monitoring
     */
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
