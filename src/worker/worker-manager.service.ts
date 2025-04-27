import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TEMPORAL_WORKER_MODULE_OPTIONS, ERRORS, DEFAULT_NAMESPACE } from '../constants';
import { TemporalWorkerOptions } from '../interfaces';
import { TemporalMetadataAccessor } from './temporal-metadata.accessor';

/**
 * Service responsible for creating and managing Temporal workers
 */
@Injectable()
export class WorkerManager implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
    private readonly logger = new Logger(WorkerManager.name);
    private worker: Worker | null = null;
    private connection: NativeConnection | null = null;
    private timerId: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        @Inject(TEMPORAL_WORKER_MODULE_OPTIONS)
        private readonly options: TemporalWorkerOptions,
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {}

    /**
     * Initialize the worker on module init
     */
    async onModuleInit() {
        try {
            this.logger.log('Initializing Temporal worker...');
            await this.setupWorker();
        } catch (error) {
            this.logger.error('Error during worker initialization', error);

            // Allow the application to start even if worker initialization fails
            if (this.options.allowWorkerFailure !== false) {
                this.logger.warn('Continuing application startup without Temporal worker');
            } else {
                throw error;
            }
        }
    }

    /**
     * Properly shut down the worker when the module is destroyed
     */
    async onModuleDestroy() {
        await this.shutdown();
    }

    /**
     * Start the worker when the application is bootstrapped
     */
    onApplicationBootstrap() {
        // Skip if autoStart is explicitly disabled or if worker was not created
        if (this.options.autoStart === false || !this.worker) {
            return;
        }

        this.startWorker();
    }

    /**
     * Start the worker if it's not already running
     */
    async startWorker() {
        if (!this.worker) {
            this.logger.warn('Cannot start worker: Worker not initialized');
            return;
        }

        if (this.isRunning) {
            this.logger.warn('Worker is already running');
            return;
        }

        try {
            this.logger.log(`Starting worker for task queue: ${this.options.taskQueue}`);
            this.isRunning = true;

            await this.worker.run();
        } catch (error) {
            this.isRunning = false;
            this.logger.error('Error running worker', error);
            throw error;
        }
    }

    /**
     * Shutdown the worker and clean up resources
     */
    async shutdown(): Promise<void> {
        this.clearTimeout();

        if (this.worker) {
            try {
                this.logger.log('Shutting down Temporal worker...');
                await this.worker.shutdown();
                this.isRunning = false;
                this.logger.log('Temporal worker shut down successfully');
            } catch (error) {
                this.logger.error('Error during worker shutdown', error);
            } finally {
                this.worker = null;
            }
        }

        if (this.connection) {
            try {
                this.logger.log('Closing Temporal worker connection...');
                await this.connection.close();
                this.logger.log('Temporal worker connection closed successfully');
            } catch (error) {
                this.logger.error('Error during connection close', error);
            } finally {
                this.connection = null;
            }
        }
    }

    /**
     * Clear the startup timer if it exists
     */
    private clearTimeout() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Set up the worker, discover activities, and prepare workflows
     */
    private async setupWorker() {
        if (!this.options.taskQueue) {
            throw new Error(ERRORS.MISSING_TASK_QUEUE);
        }

        // Gather activity implementations
        const activities = await this.discoverActivities();

        // Convert ConnectionOptions to NativeConnectionOptions
        const connectionOptions: any = {
            address: this.options.connection?.address,
            tls: this.options.connection?.tls,
        };

        // Add API key to metadata if provided
        if (this.options.connection?.apiKey) {
            connectionOptions.metadata = {
                ...(this.options.connection.metadata || {}),
                authorization: `Bearer ${this.options.connection.apiKey}`,
            };
        }

        // Connect to Temporal server
        this.logger.debug(`Connecting to Temporal server at ${connectionOptions.address}`);
        this.connection = await NativeConnection.connect(connectionOptions);

        // Create worker options
        const workerOptions = {
            taskQueue: this.options.taskQueue,
            activities,
            workflowsPath: this.options.workflowsPath,
            // Apply sensible defaults
            maxConcurrentActivityTaskExecutions: 100,
            maxConcurrentWorkflowTaskExecutions: 40,
            // Enable V8 context reuse for better performance
            reuseV8Context: true,
        };

        // Create the worker
        this.worker = await Worker.create({
            connection: this.connection,
            namespace: this.options.namespace || DEFAULT_NAMESPACE,
            ...workerOptions,
        });

        this.logger.log(
            `Worker created for queue: ${this.options.taskQueue} in namespace: ${this.options.namespace || DEFAULT_NAMESPACE}`,
        );
    }

    /**
     * Discover and register activity implementations
     */
    private async discoverActivities(): Promise<Record<string, (...args: unknown[]) => unknown>> {
        const activities: Record<string, (...args: unknown[]) => unknown> = {};
        const providers = this.discoveryService.getProviders();

        // Filter providers to find activities
        const activityProviders = providers.filter((wrapper) => {
            const { instance, metatype } = wrapper;
            const targetClass = instance?.constructor || metatype;

            // If specific activity classes are specified, only include those
            if (this.options.activityClasses?.length) {
                return (
                    targetClass &&
                    this.options.activityClasses.includes(targetClass) &&
                    this.metadataAccessor.isActivity(targetClass)
                );
            }

            // Otherwise, include all classes marked with @Activity()
            return targetClass && this.metadataAccessor.isActivity(targetClass);
        });

        this.logger.log(`Found ${activityProviders.length} activity providers`);

        // Extract activity methods
        for (const wrapper of activityProviders) {
            const { instance } = wrapper;
            if (!instance) continue;

            // Get class name for logging
            const className = instance.constructor.name;
            this.logger.debug(`Processing activity class: ${className}`);

            // Extract all activity methods using metadata accessor
            const activityMethods = this.metadataAccessor.extractActivityMethods(instance);

            // Register each activity method
            for (const [activityName, method] of activityMethods.entries()) {
                activities[activityName] = method as (...args: unknown[]) => unknown;
                this.logger.debug(`Registered activity method: ${className}.${activityName}`);
            }
        }

        const activityCount = Object.keys(activities).length;
        this.logger.log(`Registered ${activityCount} activity methods in total`);

        return activities;
    }

    /**
     * Get the worker instance
     */
    getWorker(): Worker | null {
        return this.worker;
    }

    /**
     * Check if worker is running
     */
    isWorkerRunning(): boolean {
        return this.isRunning;
    }
}
