import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    OnApplicationBootstrap,
    Inject,
    Type,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Worker, NativeConnection } from '@temporalio/worker';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../constants';
import { TemporalOptions, WorkerStatus } from '../interfaces';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Temporal Worker Manager Service
 *
 * Manages the lifecycle of Temporal workers including:
 * - Worker initialization and configuration
 * - Activity discovery and registration
 * - Worker health monitoring
 * - Graceful shutdown handling
 */
@Injectable()
export class TemporalWorkerManagerService
    implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
    private readonly logger: TemporalLogger;
    private worker: Worker | null = null;
    private restartCount = 0;
    private readonly maxRestarts = 3;
    private connection: NativeConnection | null = null;
    private isInitialized = false;
    private isRunning = false;
    private lastError: string | null = null;
    private startedAt: Date | null = null;
    private readonly activities = new Map<string, Function>();
    private shutdownPromise: Promise<void> | null = null;

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        @Inject(TEMPORAL_CONNECTION)
        private readonly injectedConnection: NativeConnection | null,
    ) {
        this.logger = createLogger(TemporalWorkerManagerService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            this.logger.debug('Initializing Temporal worker manager...');

            if (!this.shouldInitializeWorker()) {
                this.logger.info(
                    'Worker initialization skipped - no worker configuration provided',
                );
                return;
            }

            await this.initializeWorker();
            this.isInitialized = true;

            this.logger.info('Temporal worker manager initialized successfully');
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to initialize worker manager', error);
            throw error;
        }
    }

    async onApplicationBootstrap(): Promise<void> {
        if (this.worker && this.options.worker?.autoStart !== false) {
            await this.startWorker();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.shutdownWorker();
    }

    /**
     * Start the worker
     */
    async startWorker(): Promise<void> {
        if (!this.worker) {
            throw new Error('Worker not initialized. Cannot start worker.');
        }

        if (this.isRunning) {
            this.logger.warn('Worker is already running');
            return;
        }

        try {
            this.logger.info('Starting Temporal worker...');
            this.isRunning = true;
            this.startedAt = new Date();
            this.lastError = null;
            this.restartCount = 0; // Reset restart count on successful start

            // Start the worker and handle auto-restart on failure
            this.runWorkerWithAutoRestart();

            this.logger.info('Temporal worker started successfully');
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to start worker', error);
            this.isRunning = false;
            throw error;
        }
    }

    private runWorkerWithAutoRestart(): void {
        if (!this.worker) return;

        this.worker.run().catch(async (error) => {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Worker run failed', error);
            this.isRunning = false;

            // Auto-restart if enabled and within restart limits
            if (this.options.autoRestart !== false && this.restartCount < this.maxRestarts) {
                this.restartCount++;
                this.logger.info(
                    `Auto-restart enabled, attempting to restart worker (attempt ${this.restartCount}/${this.maxRestarts}) in 1 second...`,
                );
                setTimeout(async () => {
                    try {
                        await this.autoRestartWorker();
                    } catch (restartError) {
                        this.logger.error('Auto-restart failed', restartError);
                    }
                }, 1000);
            } else if (this.restartCount >= this.maxRestarts) {
                this.logger.error(
                    `Max restart attempts (${this.maxRestarts}) exceeded. Stopping auto-restart.`,
                );
            }
        });
    }

    /**
     * Auto-restart the worker (used internally for auto-restart functionality)
     */
    private async autoRestartWorker(): Promise<void> {
        this.logger.info('Auto-restarting Temporal worker...');

        try {
            if (this.worker) {
                await this.worker.shutdown();
            }

            // Wait a bit before restarting
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Reset state
            this.isRunning = true;
            this.startedAt = new Date();
            this.lastError = null;

            // Start the worker again with auto-restart capability
            this.runWorkerWithAutoRestart();

            this.logger.info('Temporal worker auto-restarted successfully');
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Auto-restart failed', error);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the worker gracefully
     */
    async stopWorker(): Promise<void> {
        if (!this.worker || !this.isRunning) {
            this.logger.debug('Worker is not running or not initialized');
            return;
        }

        try {
            this.logger.info('Stopping Temporal worker...');
            await this.worker.shutdown();
            this.isRunning = false;
            this.startedAt = null;

            this.logger.info('Temporal worker stopped successfully');
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to stop worker gracefully', error);
        }
    }

    /**
     * Shutdown the worker (alias for shutdownWorker)
     */
    async shutdown(): Promise<void> {
        await this.shutdownWorker();
    }

    /**
     * Restart the worker
     */
    async restartWorker(): Promise<void> {
        this.logger.info('Restarting Temporal worker...');

        try {
            await this.stopWorker();

            // Wait a bit before restarting
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await this.startWorker();
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to restart worker', error);
            throw error;
        }
    }

    /**
     * Get worker status
     */
    getWorkerStatus(): WorkerStatus {
        const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : undefined;

        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            isHealthy: this.isInitialized && !this.lastError && this.isRunning,
            taskQueue: this.options.taskQueue || 'default',
            namespace: this.options.connection?.namespace || 'default',
            workflowSource: this.getWorkflowSource(),
            activitiesCount: this.activities.size,
            lastError: this.lastError || undefined,
            startedAt: this.startedAt || undefined,
            uptime,
        };
    }

    /**
     * Get registered activities
     */
    getRegisteredActivities(): Record<string, Function> {
        const result: Record<string, Function> = {};
        for (const [name, func] of this.activities.entries()) {
            result[name] = func;
        }
        return result;
    }

    /**
     * Get registered activities as an array-like object (for testing compatibility)
     * This maintains backward compatibility with existing tests
     */
    getRegisteredActivitiesForTesting(): string[] {
        return Array.from(this.activities.keys());
    }

    /**
     * Get registered activity names as an array (for testing compatibility)
     */
    getRegisteredActivityNames(): string[] {
        return Array.from(this.activities.keys());
    }

    /**
     * Check worker health
     */
    async healthCheck() {
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
                total: Object.keys(activities).length,
                registered: activities,
            },
        };
    }

    /**
     * Check if worker is available
     */
    isWorkerAvailable(): boolean {
        return this.worker !== null;
    }

    /**
     * Check if worker is initialized
     */
    isWorkerInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Check if worker is running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Check if worker is running (alias)
     */
    isWorkerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get worker status (alias for getWorkerStatus)
     */
    getStatus(): WorkerStatus {
        return this.getWorkerStatus();
    }

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
        return this.connection || this.injectedConnection;
    }

    /**
     * Validate worker configuration
     */
    private validateConfiguration(): void {
        if (!this.options.taskQueue) {
            throw new Error('Task queue is required');
        }
        if (!this.options.connection?.address) {
            throw new Error('Connection address is required');
        }

        // Check for conflicting workflow configurations
        if (this.options.worker?.workflowsPath && this.options.worker?.workflowBundle) {
            throw new Error('Cannot specify both workflowsPath and workflowBundle');
        }
    }

    /**
     * Get environment defaults for worker configuration
     */
    private getEnvironmentDefaults(): Record<string, unknown> {
        return {
            taskQueue: this.options.taskQueue || 'default',
            namespace: this.options.connection?.namespace || 'default',
        };
    }

    /**
     * Build worker options from configuration
     */
    private buildWorkerOptions(): Record<string, unknown> {
        const baseOptions = this.getEnvironmentDefaults();

        // Add workflow configuration
        if (this.options.worker?.workflowsPath) {
            Object.assign(baseOptions, { workflowsPath: this.options.worker.workflowsPath });
        } else if (this.options.worker?.workflowBundle) {
            Object.assign(baseOptions, { workflowBundle: this.options.worker.workflowBundle });
        }

        // Add activities - ensure activities map is properly converted
        const activitiesObj: Record<string, Function> = {};
        for (const [name, func] of this.activities.entries()) {
            activitiesObj[name] = func;
        }
        Object.assign(baseOptions, { activities: activitiesObj });

        // Add additional worker options
        if (this.options.worker?.workerOptions) {
            Object.assign(baseOptions, this.options.worker.workerOptions);
        }

        return baseOptions;
    }

    /**
     * Create connection to Temporal server
     */
    private async createConnection(): Promise<void> {
        if (this.injectedConnection) {
            this.connection = this.injectedConnection;
            this.logger.debug('Using injected connection');
            return;
        }

        if (!this.options.connection?.address) {
            throw new Error('Connection address is required');
        }

        try {
            const address = this.options.connection.address;
            const connectOptions: any = {
                address,
                tls: this.options.connection.tls,
            };

            if (this.options.connection.apiKey) {
                connectOptions.metadata = {
                    ...(this.options.connection.metadata || {}),
                    authorization: `Bearer ${this.options.connection.apiKey}`,
                };
            }

            this.logger.debug(`Creating NativeConnection to ${address}`);
            this.connection = await NativeConnection.connect(connectOptions);
            this.logger.info(`Connection established to ${address}`);
        } catch (error) {
            this.logger.error('Failed to create connection', error);
            throw error;
        }
    }

    /**
     * Create worker instance
     */
    private async createWorker(): Promise<void> {
        await this.createConnection();

        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const workerConfig = await this.createWorkerConfig();
        const { Worker } = await import('@temporalio/worker');
        this.worker = await Worker.create(workerConfig as never);
    }

    /**
     * Log worker configuration for debugging
     */
    private logWorkerConfiguration(): void {
        this.logger.debug(`Worker configuration: ${JSON.stringify(this.options.worker)}`);
    }

    /**
     * Run worker loop (for testing purposes)
     */
    private async runWorkerLoop(): Promise<void> {
        if (!this.worker) {
            throw new Error('Temporal worker not initialized');
        }

        try {
            await this.worker.run();
        } catch (error) {
            this.logger.error('Worker execution failed', error);
            throw new Error('Execution error');
        }
    }

    /**
     * Start worker in background (for testing purposes)
     */
    private startWorkerInBackground(): void {
        if (this.worker && !this.isRunning) {
            this.startWorker().catch((error) => {
                this.logger.error('Background worker start failed', error);
            });
        }
    }

    private shouldInitializeWorker(): boolean {
        return Boolean(
            this.options.worker &&
                (this.options.worker.workflowsPath ||
                    this.options.worker.workflowBundle ||
                    this.options.worker.activityClasses?.length),
        );
    }

    private async initializeWorker(): Promise<void> {
        if (!this.options.worker) {
            throw new Error('Worker configuration is required');
        }

        // Validate configuration first
        this.validateConfiguration();

        // Ensure connection is established
        await this.createConnection();

        // Discover and register activities
        await this.discoverActivities();

        // Create worker configuration
        const workerConfig = await this.createWorkerConfig();

        // Create the worker
        const { Worker } = await import('@temporalio/worker');
        this.worker = await Worker.create(workerConfig as never);

        this.logger.debug(
            `Worker created - TaskQueue: ${workerConfig.taskQueue}, Activities: ${this.activities.size}, Source: ${this.getWorkflowSource()}`,
        );
    }

    private async discoverActivities(): Promise<void> {
        const providers = this.discoveryService.getProviders();
        const activityClasses = this.options.worker?.activityClasses || [];

        this.logger.debug(`Discovering activities from ${providers.length} providers`);

        for (const wrapper of providers) {
            const { instance, metatype } = wrapper as { instance?: unknown; metatype?: Function };

            if (!instance || !metatype) continue;

            // Check if this class should be included
            if (
                activityClasses.length > 0 &&
                !activityClasses.includes(metatype as Type<unknown>)
            ) {
                continue;
            }

            // Check if it's an activity class
            if (!this.metadataAccessor.isActivity(metatype)) {
                continue;
            }

            try {
                const className = metatype.name;
                this.logger.debug(`Processing activity class: ${className}`);

                const validation = this.metadataAccessor.validateActivityClass(metatype);
                if (!validation.isValid) {
                    this.logger.warn(
                        `Activity class ${className} has validation issues: ${validation.issues.join(', ')}`,
                    );
                    continue;
                }

                const activityMethods = this.metadataAccessor.extractActivityMethods(instance);

                for (const [activityName, method] of activityMethods.entries()) {
                    // Handle both object format (with handler property) and direct function format
                    const handler = typeof method === 'function' ? method : method.handler;
                    if (typeof handler === 'function') {
                        this.activities.set(activityName, handler);
                        this.logger.debug(`Registered activity: ${className}.${activityName}`);
                    } else {
                        this.logger.warn(
                            `Invalid activity method for ${activityName}: not a function`,
                        );
                    }
                }
            } catch (error) {
                this.logger.error(`Failed to process activity class ${metatype.name}`, error);
            }
        }

        this.logger.info(`Discovered ${this.activities.size} activity methods`);
    }

    private async createWorkerConfig() {
        const taskQueue = this.options.taskQueue || 'default';
        const namespace = this.options.connection?.namespace || 'default';

        const config = {
            taskQueue,
            namespace,
            connection: this.connection,
            activities: Object.fromEntries(this.activities),
        };

        // Add workflow configuration
        if (this.options.worker?.workflowsPath) {
            Object.assign(config, { workflowsPath: this.options.worker.workflowsPath });
            this.logger.debug(`Using workflows from path: ${this.options.worker.workflowsPath}`);
        } else if (this.options.worker?.workflowBundle) {
            Object.assign(config, { workflowBundle: this.options.worker.workflowBundle });
            this.logger.debug('Using workflow bundle');
        } else {
            this.logger.warn(
                'No workflow configuration provided - worker will only handle activities',
            );
        }

        // Add additional worker options
        if (this.options.worker?.workerOptions) {
            Object.assign(config, this.options.worker.workerOptions);
        }

        return config;
    }

    private async shutdownWorker(): Promise<void> {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = this.performShutdown();
        return this.shutdownPromise;
    }

    private async performShutdown(): Promise<void> {
        try {
            this.logger.info('Shutting down Temporal worker...');

            if (this.worker) {
                await this.stopWorker();
                this.worker = null;
            }

            if (this.connection && !this.injectedConnection) {
                try {
                    await this.connection.close();
                    this.logger.info('Connection closed successfully');
                } catch (error) {
                    this.logger.warn('Error closing connection', error);
                }
                this.connection = null;
            }

            this.isInitialized = false;
            this.logger.info('Worker shutdown completed');
        } catch (error) {
            this.logger.error('Error during worker shutdown', error);
        } finally {
            this.shutdownPromise = null;
        }
    }

    private getWorkflowSource(): 'bundle' | 'filesystem' | 'registered' | 'none' {
        if (this.options.worker?.workflowBundle) return 'bundle';
        if (this.options.worker?.workflowsPath) return 'filesystem';
        return 'none';
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Unknown error';
    }
}
