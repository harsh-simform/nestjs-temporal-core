import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    OnApplicationBootstrap,
    Inject,
} from '@nestjs/common';
import { Worker, NativeConnection } from '@temporalio/worker';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../constants';
import {
    TemporalOptions,
    WorkerStatus,
    WorkerConfig,
    WorkerInitResult,
    WorkerRestartResult,
    WorkerHealthStatus,
    WorkerStats,
    ActivityRegistrationResult,
    WorkerDiscoveryResult,
    WorkerDefinition,
    MultipleWorkersInfo,
    CreateWorkerResult,
    WorkerInstance,
} from '../interfaces';
import { TemporalDiscoveryService } from './temporal-discovery.service';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Temporal Worker Manager Service
 *
 * Manages the lifecycle of Temporal workers including:
 * - Worker initialization and configuration (single or multiple workers)
 * - Activity discovery and registration
 * - Worker health monitoring
 * - Graceful shutdown handling
 * - Support for multiple task queues
 */
@Injectable()
export class TemporalWorkerManagerService
    implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
    private readonly logger: TemporalLogger;

    // Legacy single worker support (for backward compatibility)
    private worker: Worker | null = null;
    private restartCount = 0;
    private readonly maxRestarts = 3;
    private isInitialized = false;
    private isRunning = false;
    private lastError: string | null = null;
    private startedAt: Date | null = null;
    private readonly activities = new Map<string, Function>();

    // Multiple workers support
    private readonly workers = new Map<string, WorkerInstance>();

    // Shared resources
    private connection: NativeConnection | null = null;
    private shutdownPromise: Promise<void> | null = null;

    constructor(
        private readonly discoveryService: TemporalDiscoveryService,
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

            // Check if we should use multiple workers mode
            if (this.options.workers && this.options.workers.length > 0) {
                await this.initializeMultipleWorkers();
                return;
            }

            // Legacy single worker initialization
            if (!this.shouldInitializeWorker()) {
                this.logger.info(
                    'Worker initialization skipped - no worker configuration provided',
                );
                return;
            }

            const initResult = await this.initializeWorker();
            this.isInitialized = initResult.success;

            if (initResult.success) {
                this.logger.info('Temporal worker manager initialized successfully');
            } else {
                this.lastError = initResult.error?.message || 'Unknown initialization error';
                this.logger.error('Failed to initialize worker manager', initResult.error);

                // Don't throw if connection failures are allowed
                if (this.options.allowConnectionFailure === true) {
                    this.logger.warn(
                        'Worker initialization failed but connection failures are allowed',
                    );
                    return;
                }

                throw initResult.error || new Error('Worker initialization failed');
            }
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to initialize worker manager', error);

            // Don't throw if connection failures are allowed
            if (this.options.allowConnectionFailure === true) {
                this.logger.warn(
                    'Worker initialization failed but connection failures are allowed',
                );
                return;
            }

            throw error;
        }
    }

    async onApplicationBootstrap(): Promise<void> {
        // Start multiple workers if configured
        if (this.options.workers && this.options.workers.length > 0) {
            for (const [taskQueue] of this.workers.entries()) {
                const workerDef = this.options.workers.find((w) => w.taskQueue === taskQueue);
                if (workerDef?.autoStart !== false) {
                    await this.startWorkerByTaskQueue(taskQueue);
                }
            }
            return;
        }

        // Legacy single worker auto-start
        if (this.worker && this.options.worker?.autoStart !== false) {
            await this.startWorker();
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.shutdownWorker();
    }

    // ==========================================
    // Multiple Workers Support
    // ==========================================

    /**
     * Initialize multiple workers from configuration
     */
    private async initializeMultipleWorkers(): Promise<void> {
        this.logger.info(`Initializing ${this.options.workers!.length} workers...`);

        // Ensure connection is established first
        await this.createConnection();

        if (!this.connection && this.options.allowConnectionFailure !== false) {
            this.logger.warn('Connection failed, skipping worker initialization');
            return;
        }

        for (const workerDef of this.options.workers!) {
            try {
                await this.createWorkerFromDefinition(workerDef);
            } catch (error) {
                this.logger.error(
                    `Failed to initialize worker for task queue '${workerDef.taskQueue}'`,
                    error,
                );
                if (this.options.allowConnectionFailure !== true) {
                    throw error;
                }
            }
        }

        this.logger.info(`Successfully initialized ${this.workers.size} workers`);
    }

    /**
     * Create a worker from a worker definition
     */
    private async createWorkerFromDefinition(workerDef: WorkerDefinition): Promise<WorkerInstance> {
        this.logger.debug(`Creating worker for task queue: ${workerDef.taskQueue}`);

        // Check if worker already exists
        if (this.workers.has(workerDef.taskQueue)) {
            throw new Error(`Worker for task queue '${workerDef.taskQueue}' already exists`);
        }

        // Load activities for this worker
        const activities = new Map<string, Function>();

        // Get activities from discovery service
        if (workerDef.activityClasses && workerDef.activityClasses.length > 0) {
            await this.loadActivitiesForWorker(activities);
        } else {
            // Use all discovered activities
            const allActivities = this.discoveryService.getAllActivities();
            for (const [name, handler] of Object.entries(allActivities)) {
                activities.set(name, handler);
            }
        }

        // Create worker config
        const workerConfig: WorkerConfig = {
            taskQueue: workerDef.taskQueue,
            namespace: this.options.connection?.namespace || 'default',
            connection: this.connection!,
            activities: Object.fromEntries(activities),
        };

        // Add workflow configuration
        if (workerDef.workflowsPath) {
            workerConfig.workflowsPath = workerDef.workflowsPath;
        } else if (workerDef.workflowBundle) {
            workerConfig.workflowBundle = workerDef.workflowBundle;
        }

        // Add worker options
        if (workerDef.workerOptions) {
            Object.assign(workerConfig, workerDef.workerOptions);
        }

        // Create the worker
        const { Worker } = await import('@temporalio/worker');
        const worker = await Worker.create(workerConfig as never);

        // Create worker instance
        const workerInstance: WorkerInstance = {
            worker,
            taskQueue: workerDef.taskQueue,
            namespace: this.options.connection?.namespace || 'default',
            isRunning: false,
            isInitialized: true,
            lastError: null,
            startedAt: null,
            restartCount: 0,
            activities,
            workflowSource: this.getWorkflowSourceFromDef(workerDef),
        };

        // Store worker instance
        this.workers.set(workerDef.taskQueue, workerInstance);

        this.logger.info(
            `Worker created for task queue '${workerDef.taskQueue}' with ${activities.size} activities`,
        );

        return workerInstance;
    }

    /**
     * Register and create a new worker dynamically at runtime
     */
    async registerWorker(workerDef: WorkerDefinition): Promise<CreateWorkerResult> {
        try {
            // Validate task queue
            if (!workerDef.taskQueue || workerDef.taskQueue.trim().length === 0) {
                throw new Error('Task queue is required');
            }

            // Ensure connection exists
            if (!this.connection) {
                await this.createConnection();
            }

            const workerInstance = await this.createWorkerFromDefinition(workerDef);

            // Auto-start if requested
            if (workerDef.autoStart !== false) {
                await this.startWorkerByTaskQueue(workerDef.taskQueue);
            }

            return {
                success: true,
                taskQueue: workerDef.taskQueue,
                worker: workerInstance.worker,
            };
        } catch (error) {
            this.logger.error(`Failed to create worker for '${workerDef.taskQueue}'`, error);
            return {
                success: false,
                taskQueue: workerDef.taskQueue,
                error: error instanceof Error ? error : new Error(this.extractErrorMessage(error)),
            };
        }
    }

    /**
     * Get a specific worker by task queue
     */
    getWorker(taskQueue: string): Worker | null {
        const workerInstance = this.workers.get(taskQueue);
        return workerInstance ? workerInstance.worker : null;
    }

    /**
     * Get all workers information
     */
    getAllWorkers(): MultipleWorkersInfo {
        const workersStatus = new Map<string, WorkerStatus>();

        for (const [taskQueue, workerInstance] of this.workers.entries()) {
            workersStatus.set(taskQueue, this.getWorkerStatusFromInstance(workerInstance));
        }

        return {
            workers: workersStatus,
            totalWorkers: this.workers.size,
            runningWorkers: Array.from(this.workers.values()).filter((w) => w.isRunning).length,
            healthyWorkers: Array.from(this.workers.values()).filter(
                (w) => w.isInitialized && !w.lastError && w.isRunning,
            ).length,
        };
    }

    /**
     * Get worker status for a specific task queue
     */
    getWorkerStatusByTaskQueue(taskQueue: string): WorkerStatus | null {
        const workerInstance = this.workers.get(taskQueue);
        return workerInstance ? this.getWorkerStatusFromInstance(workerInstance) : null;
    }

    /**
     * Start a specific worker by task queue
     */
    async startWorkerByTaskQueue(taskQueue: string): Promise<void> {
        const workerInstance = this.workers.get(taskQueue);

        if (!workerInstance) {
            throw new Error(`Worker for task queue '${taskQueue}' not found`);
        }

        if (workerInstance.isRunning) {
            this.logger.warn(`Worker for '${taskQueue}' is already running`);
            return;
        }

        try {
            this.logger.info(`Starting worker for task queue '${taskQueue}'...`);
            workerInstance.isRunning = true;
            workerInstance.startedAt = new Date();
            workerInstance.lastError = null;

            // Start the worker in the background
            workerInstance.worker.run().catch((error) => {
                workerInstance.lastError = this.extractErrorMessage(error);
                workerInstance.isRunning = false;
                this.logger.error(`Worker '${taskQueue}' failed`, error);
            });

            this.logger.info(`Worker for '${taskQueue}' started successfully`);
        } catch (error) {
            workerInstance.lastError = this.extractErrorMessage(error);
            workerInstance.isRunning = false;
            this.logger.error(`Failed to start worker for '${taskQueue}'`, error);
            throw error;
        }
    }

    /**
     * Stop a specific worker by task queue
     */
    async stopWorkerByTaskQueue(taskQueue: string): Promise<void> {
        const workerInstance = this.workers.get(taskQueue);

        if (!workerInstance) {
            throw new Error(`Worker for task queue '${taskQueue}' not found`);
        }

        if (!workerInstance.isRunning) {
            this.logger.debug(`Worker for '${taskQueue}' is not running`);
            return;
        }

        try {
            this.logger.info(`Stopping worker for task queue '${taskQueue}'...`);
            await workerInstance.worker.shutdown();
            workerInstance.isRunning = false;
            workerInstance.startedAt = null;
            this.logger.info(`Worker for '${taskQueue}' stopped successfully`);
        } catch (error) {
            workerInstance.lastError = this.extractErrorMessage(error);
            this.logger.error(`Failed to stop worker for '${taskQueue}'`, error);
            throw error;
        }
    }

    /**
     * Get the native connection for creating custom workers
     * @returns NativeConnection instance or null
     */
    getConnection(): NativeConnection | null {
        return this.connection;
    }

    /**
     * Helper method to get worker status from worker instance
     */
    private getWorkerStatusFromInstance(workerInstance: WorkerInstance): WorkerStatus {
        const uptime = workerInstance.startedAt
            ? Date.now() - workerInstance.startedAt.getTime()
            : undefined;

        return {
            isInitialized: workerInstance.isInitialized,
            isRunning: workerInstance.isRunning,
            isHealthy:
                workerInstance.isInitialized &&
                !workerInstance.lastError &&
                workerInstance.isRunning,
            taskQueue: workerInstance.taskQueue,
            namespace: workerInstance.namespace,
            workflowSource: workerInstance.workflowSource,
            activitiesCount: workerInstance.activities.size,
            lastError: workerInstance.lastError || undefined,
            startedAt: workerInstance.startedAt || undefined,
            uptime,
        };
    }

    /**
     * Helper to load activities for a specific worker
     */
    private async loadActivitiesForWorker(activities: Map<string, Function>): Promise<void> {
        // Wait for discovery service to complete
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            const healthStatus = this.discoveryService.getHealthStatus();
            if (healthStatus.isComplete) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }

        const allActivities = this.discoveryService.getAllActivities();

        for (const [activityName, handler] of Object.entries(allActivities)) {
            activities.set(activityName, handler);
        }
    }

    /**
     * Helper to determine workflow source from definition
     */
    private getWorkflowSourceFromDef(
        workerDef: WorkerDefinition,
    ): 'bundle' | 'filesystem' | 'registered' | 'none' {
        if (workerDef.workflowBundle) return 'bundle';
        if (workerDef.workflowsPath) return 'filesystem';
        return 'none';
    }

    // ==========================================
    // Legacy Single Worker Support (Backward Compatibility)
    // ==========================================

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

            // Start the worker and wait for it to be ready
            await this.runWorkerWithAutoRestart();

            this.logger.info('Temporal worker started successfully');
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to start worker', error);
            this.isRunning = false;
            throw error;
        }
    }

    private async runWorkerWithAutoRestart(): Promise<void> {
        if (!this.worker) return;

        // Start the worker and wait for it to be ready
        try {
            // Use setImmediate to ensure non-blocking execution
            await new Promise<void>((resolve, reject) => {
                setImmediate(async () => {
                    try {
                        // Start the worker in the background
                        this.worker!.run().catch((error) => {
                            this.lastError = this.extractErrorMessage(error);
                            this.logger.error('Worker run failed', error);
                            this.isRunning = false;

                            // Auto-restart if enabled and within restart limits
                            if (
                                this.options.autoRestart !== false &&
                                this.restartCount < this.maxRestarts
                            ) {
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

                        // Give the worker a moment to start up and be ready
                        setTimeout(() => resolve(), 500);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            throw error;
        }
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
    async restartWorker(): Promise<WorkerRestartResult> {
        this.logger.info('Restarting Temporal worker...');

        try {
            await this.stopWorker();

            // Wait a bit before restarting
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await this.startWorker();

            return {
                success: true,
                restartCount: this.restartCount,
                maxRestarts: this.maxRestarts,
            };
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to restart worker', error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(this.lastError),
                restartCount: this.restartCount,
                maxRestarts: this.maxRestarts,
            };
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
     * Register activities from discovery service
     */
    async registerActivitiesFromDiscovery(): Promise<ActivityRegistrationResult> {
        const errors: Array<{ activityName: string; error: string }> = [];
        let registeredCount = 0;

        try {
            // Wait for discovery service to complete discovery
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds max wait

            while (attempts < maxAttempts) {
                const healthStatus = this.discoveryService.getHealthStatus();
                if (healthStatus.isComplete) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
                attempts++;
            }

            // Load all discovered activities
            const allActivities = this.discoveryService.getAllActivities();

            for (const [activityName, handler] of Object.entries(allActivities)) {
                try {
                    this.activities.set(activityName, handler);
                    registeredCount++;
                    this.logger.debug(`Registered activity: ${activityName}`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push({ activityName, error: errorMessage });
                    this.logger.warn(
                        `Failed to register activity ${activityName}: ${errorMessage}`,
                    );
                }
            }

            this.logger.info(`Registered ${registeredCount} activities from discovery service`);

            return {
                success: errors.length === 0,
                registeredCount,
                errors,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error('Failed to register activities from discovery', error);
            return {
                success: false,
                registeredCount,
                errors: [{ activityName: 'discovery', error: errorMessage }],
            };
        }
    }

    /**
     * Check if worker is available
     */
    isWorkerAvailable(): boolean {
        return this.worker !== null;
    }

    /**
     * Check if worker is running
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
     * Get worker health status
     */
    getHealthStatus(): WorkerHealthStatus {
        const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : undefined;

        return {
            isHealthy: this.isInitialized && !this.lastError && this.isRunning,
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            lastError: this.lastError || undefined,
            uptime,
            activitiesCount: this.activities.size,
            restartCount: this.restartCount,
            maxRestarts: this.maxRestarts,
        };
    }

    /**
     * Get worker statistics
     */
    getStats(): WorkerStats {
        const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : undefined;

        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            activitiesCount: this.activities.size,
            restartCount: this.restartCount,
            maxRestarts: this.maxRestarts,
            uptime,
            startedAt: this.startedAt || undefined,
            lastError: this.lastError || undefined,
            taskQueue: this.options.taskQueue || 'default',
            namespace: this.options.connection?.namespace || 'default',
            workflowSource: this.getWorkflowSource(),
        };
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
            const connectOptions: Record<string, unknown> = {
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

            // In development or when connection failures are allowed, don't throw
            if (this.options.allowConnectionFailure !== false) {
                this.logger.warn(
                    'Worker connection failed - continuing without worker functionality',
                );
                this.connection = null;
                return;
            }

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

    private async initializeWorker(): Promise<WorkerInitResult> {
        if (!this.options.worker) {
            return {
                success: false,
                error: new Error('Worker configuration is required'),
                activitiesCount: 0,
                taskQueue: this.options.taskQueue || 'default',
                namespace: this.options.connection?.namespace || 'default',
            };
        }

        try {
            // Validate configuration first
            this.validateConfiguration();

            // Ensure connection is established
            await this.createConnection();

            // If connection failed and we're allowing connection failures, return gracefully
            if (!this.connection && this.options.allowConnectionFailure !== false) {
                this.logger.info('Worker initialization skipped due to connection failure');
                return {
                    success: false,
                    error: new Error('No worker connection available'),
                    activitiesCount: 0,
                    taskQueue: this.options.taskQueue || 'default',
                    namespace: this.options.connection?.namespace || 'default',
                };
            }

            // Get activities from discovery service
            await this.loadActivitiesFromDiscovery();

            // Create worker configuration
            const workerConfig = await this.createWorkerConfig();

            // Create the worker
            const { Worker } = await import('@temporalio/worker');
            this.worker = await Worker.create(workerConfig as never);

            this.logger.debug(
                `Worker created - TaskQueue: ${workerConfig.taskQueue}, Activities: ${this.activities.size}, Source: ${this.getWorkflowSource()}`,
            );

            return {
                success: true,
                worker: this.worker,
                activitiesCount: this.activities.size,
                taskQueue: workerConfig.taskQueue,
                namespace: workerConfig.namespace,
            };
        } catch (error) {
            this.lastError = this.extractErrorMessage(error);
            this.logger.error('Failed to initialize worker', error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(this.lastError),
                activitiesCount: this.activities.size,
                taskQueue: this.options.taskQueue || 'default',
                namespace: this.options.connection?.namespace || 'default',
            };
        }
    }

    private async loadActivitiesFromDiscovery(): Promise<WorkerDiscoveryResult> {
        const startTime = Date.now();
        const errors: Array<{ component: string; error: string }> = [];
        let discoveredActivities = 0;
        let loadedActivities = 0;

        try {
            // Wait for discovery service to complete discovery
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds max wait

            while (attempts < maxAttempts) {
                const healthStatus = this.discoveryService.getHealthStatus();
                if (healthStatus.isComplete) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
                attempts++;
            }

            // Load all discovered activities
            const allActivities = this.discoveryService.getAllActivities();
            discoveredActivities = Object.keys(allActivities).length;

            for (const [activityName, handler] of Object.entries(allActivities)) {
                try {
                    this.activities.set(activityName, handler);
                    loadedActivities++;
                    this.logger.debug(`Loaded activity: ${activityName}`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push({ component: activityName, error: errorMessage });
                    this.logger.warn(`Failed to load activity ${activityName}: ${errorMessage}`);
                }
            }

            this.logger.info(`Loaded ${loadedActivities} activities from discovery service`);

            return {
                success: errors.length === 0,
                discoveredActivities,
                loadedActivities,
                errors,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error('Failed to load activities from discovery', error);
            return {
                success: false,
                discoveredActivities,
                loadedActivities,
                errors: [{ component: 'discovery', error: errorMessage }],
                duration: Date.now() - startTime,
            };
        }
    }

    private async createWorkerConfig(): Promise<WorkerConfig> {
        const taskQueue = this.options.taskQueue || 'default';
        const namespace = this.options.connection?.namespace || 'default';

        if (!this.connection) {
            throw new Error('Connection not established');
        }

        const config: WorkerConfig = {
            taskQueue,
            namespace,
            connection: this.connection,
            activities: Object.fromEntries(this.activities),
        };

        // Add workflow configuration
        if (this.options.worker?.workflowsPath) {
            config.workflowsPath = this.options.worker.workflowsPath;
            this.logger.debug(`Using workflows from path: ${this.options.worker.workflowsPath}`);
        } else if (this.options.worker?.workflowBundle) {
            config.workflowBundle = this.options.worker.workflowBundle;
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

        return config as WorkerConfig;
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
            this.logger.info('Shutting down Temporal worker manager...');

            // Shutdown multiple workers if they exist
            if (this.workers.size > 0) {
                this.logger.info(`Shutting down ${this.workers.size} workers...`);
                for (const [taskQueue, workerInstance] of this.workers.entries()) {
                    try {
                        if (workerInstance.isRunning) {
                            this.logger.debug(`Stopping worker for '${taskQueue}'...`);
                            await workerInstance.worker.shutdown();
                            workerInstance.isRunning = false;
                        }
                    } catch (error) {
                        this.logger.warn(`Error shutting down worker '${taskQueue}'`, error);
                    }
                }
                this.workers.clear();
            }

            // Shutdown legacy single worker if it exists
            if (this.worker) {
                await this.stopWorker();
                this.worker = null;
            }

            // Close connection
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
            this.logger.info('Worker manager shutdown completed');
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
