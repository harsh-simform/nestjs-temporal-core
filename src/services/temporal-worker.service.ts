import {
    Inject,
    Injectable,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import { DEFAULT_NAMESPACE, TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    ActivityMethodHandler,
    WorkerCreateOptions,
    WorkerStatus,
    WorkerModuleOptions,
} from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Manages the lifecycle of Temporal Workers in a NestJS application.
 *
 * This service handles worker initialization, startup, shutdown, and monitoring.
 * It provides a non-blocking worker startup to prevent application startup delays
 * and includes comprehensive error handling and restart capabilities.
 *
 * Key features:
 * - Non-blocking worker startup to prevent app startup delays
 * - Automatic worker restart on failure (configurable)
 * - Activity discovery and registration
 * - Worker health monitoring and status reporting
 * - Graceful shutdown handling
 * - Support for both workflow bundles and filesystem paths
 *
 * @example
 * ```typescript
 * // Check worker status
 * const status = workerManager.getWorkerStatus();
 * console.log('Worker running:', status.isRunning);
 *
 * // Restart worker manually
 * await workerManager.restartWorker();
 *
 * // Get health status
 * const health = await workerManager.healthCheck();
 * ```
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
    private workerPromise: Promise<void> | null = null;

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: WorkerModuleOptions,
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {
        this.logger = createLogger(TemporalWorkerManagerService.name);
    }

    /**
     * Initializes the worker during module initialization.
     * Sets up the worker configuration but does not start it yet.
     * Handles initialization errors gracefully based on configuration.
     */
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

    /**
     * Starts the worker after application bootstrap completes.
     * Uses non-blocking startup to prevent application startup delays.
     * Worker starts in the background using setImmediate.
     */
    async onApplicationBootstrap() {
        if (this.options?.autoStart === false || !this.worker) {
            this.logger.debug('Worker auto-start disabled or worker not initialized');
            return;
        }

        // Start worker in background - DO NOT BLOCK APPLICATION STARTUP
        // Use setImmediate to ensure this runs after the current event loop tick
        // This prevents deadlocks during NestJS application startup
        setImmediate(() => {
            this.startWorkerInBackground();
        });
    }

    /**
     * Cleanly shuts down the worker when the module is destroyed.
     * Ensures all resources are properly cleaned up.
     */
    async onModuleDestroy() {
        await this.shutdown();
    }

    // ==========================================
    // Worker Lifecycle (NON-BLOCKING)
    // ==========================================

    /**
     * Starts the worker in the background without blocking application startup.
     * Implements automatic restart on failure if configured.
     * Handles errors gracefully and logs worker state changes.
     */
    private startWorkerInBackground(): void {
        if (!this.worker || this.isRunning) {
            return;
        }

        this.logger.log(`Starting worker for task queue: ${this.options?.taskQueue} in background`);

        // Create the worker promise with comprehensive error handling
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

            // Don't re-throw, just handle the error gracefully
            return Promise.resolve();
        });

        // Add unhandled rejection handler as safety net
        this.workerPromise.catch(() => {
            // This should never be reached due to the catch above, but included for safety
        });
    }

    /**
     * Main worker execution loop that handles activities and workflows.
     * This method blocks indefinitely while the worker is running.
     * Runs in the background to avoid blocking the application.
     */
    private async runWorkerLoop(): Promise<void> {
        if (!this.worker) {
            throw new Error('Temporal worker not initialized');
        }

        this.isRunning = true;
        this.startedAt = new Date();
        this.lastError = undefined;

        this.logger.log('Worker started successfully');

        try {
            // This blocks indefinitely (intended behavior), but it's running in background
            // The worker.run() method handles the event loop for processing activities and workflows
            await this.worker.run();
        } catch (error) {
            this.isRunning = false;
            this.lastError = error?.message || 'Worker execution error';
            this.logger.error('Worker execution failed', error?.stack || error);
            throw error;
        } finally {
            this.isRunning = false;
            this.logger.log('Worker execution completed');
        }
    }

    /**
     * Initializes the worker configuration and connections.
     * Sets up activities discovery, creates connections, and prepares the worker.
     * Does not start the worker - that's handled separately.
     */
    private async initializeWorker(): Promise<void> {
        this.validateConfiguration();
        this.activities = await this.discoverActivities();
        await this.createConnection();
        await this.createWorker();
        this.logWorkerConfiguration();
    }

    /**
     * Validates the worker configuration before initialization.
     * Checks for required settings and ensures workflow configuration is valid.
     * Throws errors for invalid configurations.
     */
    private validateConfiguration(): void {
        const taskQueue = this.options?.taskQueue as string;
        if (!taskQueue) {
            throw new Error('Task queue is required');
        }

        const connection = this.options?.connection;
        if (!connection) {
            throw new Error('Connection configuration is required');
        }

        if (!connection.address) {
            throw new Error('Connection address is required');
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

    /**
     * Creates a connection to the Temporal server.
     * Handles TLS configuration and authentication if provided.
     * Sets up connection metadata including API keys.
     */
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

    /**
     * Creates the Temporal worker instance with all necessary configuration.
     * Combines discovered activities, workflow configuration, and connection settings.
     * Applies environment-specific defaults and user overrides.
     */
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

    /**
     * Builds the complete worker options configuration.
     * Combines base options, environment defaults, and user overrides.
     * Handles both workflow bundles and filesystem paths.
     */
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

    /**
     * Returns environment-specific default configurations.
     * Provides optimized settings for production, development, and other environments.
     * Balances performance and resource usage based on environment.
     */
    private getEnvironmentDefaults(): WorkerCreateOptions {
        const env = process.env.NODE_ENV || 'development';

        switch (env) {
            case 'production':
                // TODO: Provide appropriate worker preset or configuration here
                return {} as WorkerCreateOptions;
            case 'development':
                // TODO: Provide appropriate worker preset or configuration here
                return {} as WorkerCreateOptions;
            default:
                return {
                    maxConcurrentActivityTaskExecutions: 20,
                    maxConcurrentWorkflowTaskExecutions: 10,
                    maxConcurrentLocalActivityExecutions: 20,
                    reuseV8Context: true,
                };
        }
    }

    /**
     * Discovers and registers all activity methods in the application.
     * Scans for classes decorated with @Activity and extracts their methods.
     * Validates activity classes and handles registration errors gracefully.
     */
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

    /**
     * Logs a comprehensive summary of the worker configuration.
     * Includes task queue, namespace, workflow source, and activity count.
     * Provides debugging information for configuration validation.
     */
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

    /**
     * Gracefully shuts down the worker and all connections.
     * Implements timeout handling and proper resource cleanup.
     * Ensures all pending operations complete before shutdown.
     */
    async shutdown(): Promise<void> {
        this.logger.log('Shutting down Temporal worker...');

        // First, stop the worker if it exists
        if (this.worker) {
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

        // Wait for the worker promise to complete if it exists
        if (this.workerPromise) {
            try {
                await Promise.race([
                    this.workerPromise,
                    new Promise((resolve) => setTimeout(resolve, 5000)), // 5 second timeout
                ]);
            } catch (error) {
                this.logger.debug(
                    'Worker promise completed with error during shutdown:',
                    error?.message,
                );
            } finally {
                this.workerPromise = null;
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

    /**
     * Returns the current worker instance or null if not initialized.
     */
    getWorker(): Worker | null {
        return this.worker;
    }

    /**
     * Returns the current Temporal connection or null if not established.
     */
    getConnection(): NativeConnection | null {
        return this.connection;
    }

    /**
     * Checks if the worker is currently running and processing tasks.
     */
    isWorkerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Checks if the worker has been properly initialized.
     */
    isWorkerInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Returns comprehensive worker status information.
     * Includes initialization state, running state, health status,
     * configuration details, and error information.
     */
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

    /**
     * Returns the names of all registered activity methods.
     */
    getRegisteredActivities(): string[] {
        return Object.keys(this.activities);
    }

    /**
     * Restarts the worker by shutting down and reinitializing.
     * Handles errors during restart and maintains proper state.
     * Automatically starts the worker if auto-start is enabled.
     */
    async restartWorker(): Promise<void> {
        this.logger.log('Restarting Temporal worker...');

        // Check if worker is initialized
        if (!this.isInitialized) {
            throw new Error('Worker not initialized');
        }

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

    /**
     * Performs a comprehensive health check of the worker.
     * Returns status, detailed worker information, and activity statistics.
     * Categorizes health as healthy, degraded, or unhealthy based on various factors.
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
