import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    TemporalOptions,
    WorkflowStartOptions,
    ServiceHealth,
    WorkerStatus,
    ActivityMethodInfo,
    MetadataInfo,
    TemporalServiceInitResult,
    WorkflowExecutionResult,
    WorkflowSignalResult,
    WorkflowQueryResult,
    WorkflowTerminationResult,
    WorkflowCancellationResult,
    ActivityExecutionResult,
    OverallHealthStatus,
    ServiceStatistics,
    WorkerDefinition,
    MultipleWorkersInfo,
    CreateWorkerResult,
    Worker,
} from '../interfaces';
import { TemporalClientService } from './temporal-client.service';
import { TemporalWorkerManagerService } from './temporal-worker.service';
import { TemporalScheduleService } from './temporal-schedule.service';
import { TemporalDiscoveryService } from './temporal-discovery.service';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import { TemporalLogger } from '../utils/logger';
import { DEFAULT_TASK_QUEUE } from '../constants';

/**
 * Main unified service for Temporal operations
 * Provides a single interface to access all Temporal functionality
 */
@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TemporalService.name);
    private readonly temporalLogger = new TemporalLogger(TemporalService.name);
    private isInitialized = false;
    private shutdownPromise: Promise<void> | null = null;

    constructor(
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        private readonly clientService: TemporalClientService,
        private readonly workerService: TemporalWorkerManagerService,
        private readonly scheduleService: TemporalScheduleService,
        private readonly discoveryService: TemporalDiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {}

    /**
     * Initialize the unified service
     */
    async onModuleInit(): Promise<TemporalServiceInitResult> {
        const startTime = Date.now();

        try {
            this.logger.log('Initializing Temporal Service...');

            // Wait for all individual services to initialize
            const initResult = await this.waitForServicesInitialization();

            // Mark this service as initialized
            this.isInitialized = true;

            this.logger.log('Temporal Service initialized successfully');

            return {
                success: true,
                servicesInitialized: initResult,
                initializationTime: Date.now() - startTime,
            };
        } catch (error) {
            const errorMessage = this.extractErrorMessage(error);
            this.logger.error(`Failed to initialize Temporal Service: ${errorMessage}`);

            return {
                success: false,
                error: error instanceof Error ? error : new Error(errorMessage),
                servicesInitialized: {
                    client: false,
                    worker: false,
                    schedule: false,
                    discovery: false,
                    metadata: false,
                },
                initializationTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Cleanup on module destroy
     */
    async onModuleDestroy(): Promise<void> {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }

        this.shutdownPromise = this.performShutdown();
        return this.shutdownPromise;
    }

    /**
     * Wait for all services to initialize
     */
    private async waitForServicesInitialization(): Promise<{
        client: boolean;
        worker: boolean;
        schedule: boolean;
        discovery: boolean;
        metadata: boolean;
    }> {
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        const servicesStatus = {
            client: false,
            worker: false,
            schedule: false,
            discovery: false,
            metadata: false,
        };

        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Check if all critical services are ready
                servicesStatus.client = this.clientService.isHealthy();
                servicesStatus.discovery = this.discoveryService.getHealthStatus().isComplete;
                servicesStatus.worker = this.workerService?.isWorkerAvailable() || false;
                servicesStatus.schedule = this.scheduleService.isHealthy();
                servicesStatus.metadata = true; // Metadata accessor is always available

                if (servicesStatus.client && servicesStatus.discovery) {
                    this.logger.debug('All critical services are ready');
                    return servicesStatus;
                }

                // Wait a bit before checking again
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                this.logger.warn('Service readiness check failed', error);
            }
        }

        this.logger.warn('Service initialization timeout - continuing anyway');
        return servicesStatus;
    }

    /**
     * Perform graceful shutdown
     */
    private async performShutdown(): Promise<void> {
        try {
            this.logger.log('Shutting down Temporal Service...');

            // Stop worker if running
            if (this.workerService && this.workerService.isWorkerRunning()) {
                await this.workerService.stopWorker();
            }

            this.isInitialized = false;
            this.logger.log('Temporal Service shut down successfully');
        } catch (error) {
            this.logger.error(`Error during service shutdown: ${this.extractErrorMessage(error)}`);
        } finally {
            this.shutdownPromise = null;
        }
    }

    /**
     * Start a workflow execution
     */
    async startWorkflow<T = unknown>(
        workflowType: string,
        args?: unknown[],
        options?: WorkflowStartOptions,
    ): Promise<WorkflowExecutionResult<T>> {
        const startTime = Date.now();

        try {
            this.ensureInitialized();
            const enhancedOptions = this.enhanceWorkflowOptions(options || {});
            const result = await this.clientService.startWorkflow(
                workflowType,
                args || [],
                enhancedOptions,
            );

            return {
                success: true,
                result: result as T,
                executionTime: Date.now() - startTime,
            };
        } catch (error) {
            // Log the error and re-throw it instead of returning success: false
            this.logger.error(
                `Failed to start workflow '${workflowType}': ${this.extractErrorMessage(error)}`,
            );
            throw error instanceof Error ? error : new Error(this.extractErrorMessage(error));
        }
    }

    /**
     * Signal a workflow
     */
    async signalWorkflow(
        workflowId: string,
        signalName: string,
        args?: unknown[],
    ): Promise<WorkflowSignalResult> {
        if (!workflowId || workflowId.trim() === '') {
            throw new Error('Workflow ID is required');
        }

        try {
            this.ensureInitialized();
            await this.clientService.signalWorkflow(workflowId, signalName, args || []);

            return {
                success: true,
                workflowId,
                signalName,
            };
        } catch (error) {
            // Log the error and re-throw it instead of returning success: false
            this.logger.error(
                `Failed to signal workflow '${workflowId}' with signal '${signalName}': ${this.extractErrorMessage(error)}`,
            );
            throw error instanceof Error ? error : new Error(this.extractErrorMessage(error));
        }
    }

    /**
     * Query a workflow
     */
    async queryWorkflow<T = unknown>(
        workflowId: string,
        queryName: string,
        args?: unknown[],
    ): Promise<WorkflowQueryResult<T>> {
        if (!workflowId || workflowId.trim() === '') {
            throw new Error('Workflow ID is required');
        }

        try {
            this.ensureInitialized();
            const result = await this.clientService.queryWorkflow(
                workflowId,
                queryName,
                args || [],
            );

            return {
                success: true,
                result: result as T,
                workflowId,
                queryName,
            };
        } catch (error) {
            // Log the error and re-throw it instead of returning success: false
            this.logger.error(
                `Failed to query workflow '${workflowId}' with query '${queryName}': ${this.extractErrorMessage(error)}`,
            );
            throw error instanceof Error ? error : new Error(this.extractErrorMessage(error));
        }
    }

    /**
     * Get workflow handle
     */
    async getWorkflowHandle<T = unknown>(workflowId: string, runId?: string): Promise<T> {
        this.ensureInitialized();
        const handle = this.clientService.getWorkflowHandle(workflowId, runId);
        return handle as T;
    }

    /**
     * Terminate a workflow
     */
    async terminateWorkflow(
        workflowId: string,
        reason?: string,
    ): Promise<WorkflowTerminationResult> {
        try {
            this.ensureInitialized();
            await this.clientService.terminateWorkflow(workflowId, reason);

            return {
                success: true,
                workflowId,
                reason,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(this.extractErrorMessage(error)),
                workflowId,
                reason,
            };
        }
    }

    /**
     * Cancel a workflow
     */
    async cancelWorkflow(workflowId: string): Promise<WorkflowCancellationResult> {
        try {
            this.ensureInitialized();
            await this.clientService.cancelWorkflow(workflowId);

            return {
                success: true,
                workflowId,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(this.extractErrorMessage(error)),
                workflowId,
            };
        }
    }

    /**
     * Start the worker
     */
    async startWorker(): Promise<void> {
        this.ensureInitialized();
        return this.workerService.startWorker();
    }

    /**
     * Stop the worker
     */
    async stopWorker(): Promise<void> {
        this.ensureInitialized();
        return this.workerService.stopWorker();
    }

    /**
     * Check if worker is running
     */
    isWorkerRunning(): boolean {
        this.ensureInitialized();
        if (!this.workerService) {
            return false;
        }
        return this.workerService.isWorkerRunning();
    }

    /**
     * Check if worker is available
     */
    hasWorker(): boolean {
        return this.workerService?.isWorkerAvailable() || false;
    }

    /**
     * Get worker status
     */
    getWorkerStatus(): WorkerStatus | null {
        this.ensureInitialized();
        if (!this.workerService) {
            return null;
        }
        return this.workerService.getStatus();
    }

    /**
     * Get the worker manager service (provides access to getConnection())
     */
    getWorkerManager(): TemporalWorkerManagerService {
        return this.workerService;
    }

    /**
     * Get a specific worker by task queue (for multiple workers setup)
     */
    getWorker(taskQueue: string): Worker | null {
        this.ensureInitialized();
        if (!this.workerService) {
            return null;
        }
        return this.workerService.getWorker(taskQueue);
    }

    /**
     * Get all workers information (for multiple workers setup)
     */
    getAllWorkers(): MultipleWorkersInfo | null {
        this.ensureInitialized();
        if (!this.workerService) {
            return null;
        }
        return this.workerService.getAllWorkers();
    }

    /**
     * Get worker status for a specific task queue (for multiple workers setup)
     */
    getWorkerStatusByTaskQueue(taskQueue: string): WorkerStatus | null {
        this.ensureInitialized();
        if (!this.workerService) {
            return null;
        }
        return this.workerService.getWorkerStatusByTaskQueue(taskQueue);
    }

    /**
     * Start a specific worker by task queue (for multiple workers setup)
     */
    async startWorkerByTaskQueue(taskQueue: string): Promise<void> {
        this.ensureInitialized();
        if (!this.workerService) {
            throw new Error('Worker service not available');
        }
        return this.workerService.startWorkerByTaskQueue(taskQueue);
    }

    /**
     * Stop a specific worker by task queue (for multiple workers setup)
     */
    async stopWorkerByTaskQueue(taskQueue: string): Promise<void> {
        this.ensureInitialized();
        if (!this.workerService) {
            throw new Error('Worker service not available');
        }
        return this.workerService.stopWorkerByTaskQueue(taskQueue);
    }

    /**
     * Register and create a new worker dynamically at runtime
     */
    async registerWorker(workerDef: WorkerDefinition): Promise<CreateWorkerResult> {
        this.ensureInitialized();
        if (!this.workerService) {
            return {
                success: false,
                taskQueue: workerDef.taskQueue,
                error: new Error('Worker service not available'),
            };
        }
        return this.workerService.registerWorker(workerDef);
    }

    /**
     * Execute an activity
     */
    async executeActivity<T = unknown>(
        name: string,
        ...args: unknown[]
    ): Promise<ActivityExecutionResult<T>> {
        const startTime = Date.now();

        try {
            this.ensureInitialized();
            const result = await this.discoveryService.executeActivity(name, ...args);

            return {
                success: true,
                result: result as T,
                activityName: name,
                executionTime: Date.now() - startTime,
                args,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(this.extractErrorMessage(error)),
                activityName: name,
                executionTime: Date.now() - startTime,
                args,
            };
        }
    }

    /**
     * Get activity by name
     */
    getActivity(name: string): Function | undefined {
        this.ensureInitialized();
        return this.discoveryService.getActivity(name);
    }

    /**
     * Get all activities
     */
    getAllActivities(): Record<string, Function> {
        this.ensureInitialized();
        return this.discoveryService.getAllActivities();
    }

    /**
     * Check if activity exists
     */
    hasActivity(name: string): boolean {
        this.ensureInitialized();
        return this.discoveryService.hasActivity(name);
    }

    /**
     * Get activity names
     */
    getActivityNames(): string[] {
        this.ensureInitialized();
        return this.discoveryService.getActivityNames();
    }

    /**
     * Check if a class is an activity
     */
    isActivity(target: Function): boolean {
        return this.metadataAccessor.isActivity(target);
    }

    /**
     * Check if a method is an activity method
     */
    isActivityMethod(target: object, methodName: string): boolean {
        try {
            const targetObj = target as { constructor?: { prototype?: object } };
            return (
                Reflect.hasMetadata('TEMPORAL_ACTIVITY_METHOD', target, methodName) ||
                (targetObj.constructor?.prototype !== undefined &&
                    Reflect.hasMetadata(
                        'TEMPORAL_ACTIVITY_METHOD',
                        targetObj.constructor.prototype,
                        methodName,
                    ))
            );
        } catch {
            return false;
        }
    }

    /**
     * Get activity metadata
     */
    getActivityMetadata(target: Function): MetadataInfo | null {
        const metadata = this.metadataAccessor.getActivityMetadata(target);
        return metadata as MetadataInfo | null;
    }

    /**
     * Extract activity methods from a class
     */
    extractActivityMethods(target: Function): ActivityMethodInfo[] {
        return this.metadataAccessor.extractActivityMethodsFromClass(target);
    }

    /**
     * Get overall health status (async version for compatibility)
     */
    async getOverallHealth(): Promise<OverallHealthStatus> {
        const health = this.getHealth();
        return {
            status: health.status,
            components: {
                client: {
                    status: health.services.client.status,
                    isInitialized: this.isInitialized,
                    lastError: undefined,
                    uptime: undefined,
                    details: health.services.client.details || {},
                },
                worker: {
                    status: health.services.worker.status,
                    isInitialized: this.isInitialized,
                    lastError: undefined,
                    uptime: undefined,
                    details: health.services.worker.details || {},
                },
                schedule: {
                    status: health.services.schedule.status,
                    isInitialized: this.isInitialized,
                    lastError: undefined,
                    uptime: undefined,
                    details: health.services.schedule.details || {},
                },
                activity: {
                    status: health.services.activity.status,
                    isInitialized: this.isInitialized,
                    lastError: undefined,
                    uptime: undefined,
                    details: health.services.activity.details || {},
                },
                discovery: {
                    status: health.services.discovery.status,
                    isInitialized: this.isInitialized,
                    lastError: undefined,
                    uptime: undefined,
                    details: health.services.discovery.details || {},
                },
            },
            isInitialized: health.isInitialized,
            namespace: health.namespace,
            summary: health.summary,
            timestamp: new Date(),
        };
    }

    /**
     * Get worker health status
     */
    async getWorkerHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded' | 'not_available';
        details?: WorkerStatus;
    }> {
        try {
            if (!this.hasWorker()) {
                return { status: 'not_available' as const };
            }

            if (!this.workerService) {
                return { status: 'not_available' as const };
            }

            const workerStatus = this.workerService.getWorkerStatus();
            let status: 'healthy' | 'unhealthy' | 'degraded';

            if (workerStatus.isHealthy) {
                status = 'healthy';
            } else if (workerStatus.isRunning) {
                status = 'degraded';
            } else {
                status = 'unhealthy';
            }

            return {
                status,
                details: workerStatus as WorkerStatus,
            };
        } catch {
            return {
                status: 'unhealthy' as const,
                details: undefined,
            };
        }
    }

    /**
     * Get comprehensive health status
     */
    getHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        services: {
            client: ServiceHealth;
            worker: ServiceHealth;
            schedule: ServiceHealth;
            activity: ServiceHealth;
            discovery: ServiceHealth;
        };
        isInitialized: boolean;
        namespace: string;
        summary: {
            totalActivities: number;
            totalSchedules: number;
            workerRunning: boolean;
            clientConnected: boolean;
        };
    } {
        const clientHealth = this.getClientHealth();
        const workerHealth = this.getWorkerHealthStatus();
        const scheduleHealth = this.getScheduleHealth();
        const activityHealth = this.getActivityHealth();
        const discoveryHealth = this.getDiscoveryHealth();

        const services = {
            client: clientHealth as ServiceHealth,
            worker: workerHealth as ServiceHealth,
            schedule: scheduleHealth as ServiceHealth,
            activity: activityHealth as ServiceHealth,
            discovery: discoveryHealth as ServiceHealth,
        };

        // Determine overall status
        const allHealthy = Object.values(services).every((service) => service.status === 'healthy');
        const anyUnhealthy = Object.values(services).some(
            (service) => service.status === 'unhealthy',
        );

        // Check for specific degraded conditions

        let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
        if (allHealthy) {
            overallStatus = 'healthy';
        } else if (anyUnhealthy) {
            overallStatus = 'unhealthy';
        } else {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            services,
            isInitialized: this.isInitialized,
            namespace: this.options.connection?.namespace || 'default',
            summary: {
                totalActivities: activityHealth.activitiesCount?.total || 0,
                totalSchedules: scheduleHealth.schedulesCount || 0,
                workerRunning: workerHealth.status === 'healthy',
                clientConnected: clientHealth.status === 'healthy',
            },
        };
    }

    /**
     * Get service statistics
     */
    getStats(): ServiceStatistics {
        this.ensureInitialized();
        const activityCount = this.getActivityCount();
        const scheduleCount = this.getScheduleCount();
        const workerStatus = this.workerService.getWorkerStatus();
        const clientHealth = this.getClientHealth();
        const discoveryStats = this.discoveryService.getStats();

        return {
            activities: {
                classes: activityCount.classes,
                methods: activityCount.methods,
                total: activityCount.total,
                registered: activityCount.total,
                available: activityCount.total,
            },
            schedules: {
                total: scheduleCount,
                active: scheduleCount,
                paused: 0,
            },
            worker: {
                isRunning: workerStatus.isRunning,
                isHealthy: workerStatus.isHealthy,
                activitiesCount: workerStatus.activitiesCount,
                uptime: workerStatus.uptime,
            },
            client: {
                isConnected: clientHealth.status === 'healthy',
                isHealthy: clientHealth.status === 'healthy',
                namespace: this.options.connection?.namespace || 'default',
            },
            discovery: {
                isComplete: this.discoveryService.getHealthStatus().isComplete,
                discoveredCount: discoveryStats.methods,
                errors: 0,
            },
        };
    }

    /**
     * Log current service status
     */
    private logServiceStatus(): void {
        const health = this.getHealth();
        const stats = this.getStats();

        this.temporalLogger.debug(`Service Status - Overall: ${health.status}`);
        this.temporalLogger.debug(
            `Client: ${health.services.client.status}, Worker: ${health.services.worker.status}`,
        );
        this.temporalLogger.debug(
            `Activities: ${stats.activities.total}, Schedules: ${stats.schedules}`,
        );
        this.temporalLogger.debug(`Namespace: ${health.namespace}`);
    }

    /**
     * Ensure service is initialized
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Temporal Service is not initialized');
        }
    }

    /**
     * Enhance workflow options with default task queue if not provided
     */
    private enhanceWorkflowOptions(options: WorkflowStartOptions): WorkflowStartOptions {
        if (!options.taskQueue) {
            options.taskQueue = this.options.taskQueue || DEFAULT_TASK_QUEUE;
        }
        return options;
    }

    /**
     * Get client health status
     */
    private getClientHealth(): { status: 'healthy' | 'unhealthy' | 'degraded' } {
        const isHealthy = this.clientService.isHealthy();
        return { status: isHealthy ? 'healthy' : 'unhealthy' };
    }

    /**
     * Get worker health status
     */
    private getWorkerHealthStatus(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        details?: Record<string, unknown>;
    } {
        if (!this.workerService) {
            return {
                status: 'unhealthy' as const,
                details: { error: 'Worker service not available' },
            };
        }
        const workerStatus = this.workerService.getWorkerStatus();
        return {
            status: workerStatus.isHealthy ? 'healthy' : 'degraded',
            details: {
                isInitialized: workerStatus.isInitialized,
                isRunning: workerStatus.isRunning,
                isHealthy: workerStatus.isHealthy,
                taskQueue: workerStatus.taskQueue,
                namespace: workerStatus.namespace,
                workflowSource: workerStatus.workflowSource,
                activitiesCount: workerStatus.activitiesCount,
                workflowsCount: workerStatus.workflowsCount,
                lastError: workerStatus.lastError,
                startedAt: workerStatus.startedAt,
                uptime: workerStatus.uptime,
            },
        };
    }

    /**
     * Get schedule health status
     */
    private getScheduleHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        schedulesCount: number;
    } {
        const isHealthy = this.scheduleService.isHealthy();
        const stats = this.scheduleService.getScheduleStats();
        return { status: isHealthy ? 'healthy' : 'unhealthy', schedulesCount: stats.total };
    }

    /**
     * Get activity health status
     */
    private getActivityHealth(): {
        status: 'healthy' | 'unhealthy' | 'degraded';
        activitiesCount: { total: number };
    } {
        const healthStatus = this.discoveryService.getHealthStatus();
        const count = this.discoveryService.getActivityNames().length;
        return {
            status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
            activitiesCount: { total: count },
        };
    }

    /**
     * Get discovery health status
     */
    private getDiscoveryHealth(): { status: 'healthy' | 'unhealthy' | 'degraded' } {
        const healthStatus = this.discoveryService.getHealthStatus();
        return { status: healthStatus.status as 'healthy' | 'unhealthy' | 'degraded' };
    }

    /**
     * Get activity count
     */
    private getActivityCount(): { classes: number; methods: number; total: number } {
        const names = this.discoveryService.getActivityNames();
        return { classes: names.length, methods: names.length, total: names.length };
    }

    /**
     * Get schedule count
     */
    private getScheduleCount(): number {
        const stats = this.scheduleService.getScheduleStats();
        return stats.total;
    }

    /**
     * Get the client service instance
     */
    get client(): TemporalClientService {
        this.ensureInitialized();
        return this.clientService;
    }

    /**
     * Get the worker service instance
     */
    get worker(): TemporalWorkerManagerService {
        this.ensureInitialized();
        return this.workerService;
    }

    /**
     * Get the schedule service instance
     */
    get schedule(): TemporalScheduleService {
        this.ensureInitialized();
        return this.scheduleService;
    }

    /**
     * Get the discovery service instance (for activities)
     */
    get activity(): TemporalDiscoveryService {
        this.ensureInitialized();
        return this.discoveryService;
    }

    /**
     * Get the discovery service instance
     */
    get discovery(): TemporalDiscoveryService {
        this.ensureInitialized();
        return this.discoveryService;
    }

    /**
     * Get the metadata accessor instance
     */
    get metadata(): TemporalMetadataAccessor {
        return this.metadataAccessor;
    }

    /**
     * Extract error message from various error types
     */
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
