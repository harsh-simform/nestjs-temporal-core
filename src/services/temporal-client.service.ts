import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Client, WorkflowHandle } from '@temporalio/client';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    TemporalOptions,
    WorkflowStartOptions,
    WorkflowHandleWithMetadata,
    ClientServiceStatus,
    ClientHealthStatus,
} from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Temporal Client Service
 *
 * Provides a clean interface for Temporal client operations including:
 * - Workflow execution (start, terminate, cancel)
 * - Signal and query operations
 * - Workflow handle management
 * - Client health monitoring
 *
 * @example
 * ```typescript
 * // Start a workflow
 * const handle = await clientService.startWorkflow('myWorkflow', { data: 'example' });
 *
 * // Send a signal
 * await clientService.signalWorkflow(handle, 'updateData', 'new data');
 *
 * // Query workflow state
 * const result = await clientService.queryWorkflow(handle, 'getStatus');
 * ```
 */
@Injectable()
export class TemporalClientService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private client: Client | null = null;
    private isInitialized = false;
    private lastHealthCheck: Date | null = null;
    private healthCheckInterval: number = 30000; // 30 seconds

    constructor(
        @Inject(TEMPORAL_CLIENT)
        private readonly temporalClient: Client | null,
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
    ) {
        this.logger = createLogger(TemporalClientService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            this.client = this.temporalClient;

            if (this.client) {
                this.isInitialized = true;
                this.logger.info('Temporal client service initialized successfully');
                this.logger.debug(
                    `Client namespace: ${this.options?.connection?.namespace || 'default'}`,
                );

                // Perform initial health check
                await this.performHealthCheck();
            } else {
                this.logger.warn('No Temporal client available - running in client-less mode');
            }
        } catch (error) {
            this.logger.error('Failed to initialize Temporal client service', error);
            throw error;
        }
    }

    /**
     * Start a new workflow execution
     */
    async startWorkflow(
        workflowType: string,
        args: unknown[] = [],
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata> {
        this.ensureClientAvailable();

        const workflowId = options?.workflowId || this.generateWorkflowId(workflowType);
        const taskQueue = options?.taskQueue || this.options.taskQueue || 'default';

        // Retry configuration for gRPC connection issues
        const maxRetries = 3;
        const baseRetryDelay = 1000; // Base delay in milliseconds

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Perform health check before attempting workflow start (except for first attempt)
                if (attempt > 1) {
                    this.logger.debug(`Performing health check before retry attempt ${attempt}`);
                    await this.performHealthCheck();
                }

                this.logger.debug(`Starting workflow '${workflowType}' with ID: ${workflowId}`);

                // Use our existing client
                const handle = await this.client!.workflow.start(workflowType, {
                    workflowId,
                    taskQueue,
                    args,
                });

                this.logger.info(
                    `Started workflow: ${workflowType} [${workflowId}] on queue: ${taskQueue}`,
                );
                return { ...handle, handle };
            } catch (error) {
                const message = this.extractErrorMessage(error);

                // Check if this is a gRPC connection error that we should retry
                const isRetryableError = this.isRetryableError(error, message);

                if (isRetryableError && attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
                    this.logger.warn(
                        `Attempt ${attempt}/${maxRetries} failed for workflow '${workflowType}': ${message}. Retrying in ${retryDelay}ms...`,
                    );
                    this.logger.debug(`Error details for retry decision:`, error);
                    await this.sleep(retryDelay);
                    continue;
                }

                this.logger.error(`Failed to start workflow '${workflowType}': ${message}`);
                this.logger.error('Full error object:', error);
                this.logger.debug(
                    `Error details - Workflow: ${workflowType}, ID: ${workflowId}, Queue: ${taskQueue}, Retryable: ${isRetryableError}, Attempt: ${attempt}`,
                );
                throw new Error(`Failed to start workflow '${workflowType}': ${message}`);
            }
        }

        // This should never be reached due to the throw in the catch block
        throw new Error(`Failed to start workflow '${workflowType}' after ${maxRetries} attempts`);
    }

    /**
     * Get handle to an existing workflow
     */
    async getWorkflowHandle(workflowId: string, runId?: string): Promise<WorkflowHandle> {
        this.ensureClientAvailable();

        try {
            const handle = await (this.client as Client).workflow.getHandle(workflowId, runId);
            this.logger.debug(
                `Retrieved workflow handle: ${workflowId}${runId ? ` (run: ${runId})` : ''}`,
            );
            return handle;
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(`Failed to get workflow handle for ${workflowId}: ${message}`, error);
            throw new Error(`Failed to get workflow handle for ${workflowId}: ${message}`);
        }
    }

    /**
     * Terminate a workflow execution
     */
    async terminateWorkflow(workflowId: string, reason?: string, runId?: string): Promise<void> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            await handle.terminate(reason);

            this.logger.info(`Terminated workflow: ${workflowId}${reason ? ` (${reason})` : ''}`);
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(`Failed to terminate workflow ${workflowId}: ${message}`, error);
            throw new Error(`Failed to terminate workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Cancel a workflow execution
     */
    async cancelWorkflow(workflowId: string, runId?: string): Promise<void> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            await handle.cancel();

            this.logger.info(`Cancelled workflow: ${workflowId}`);
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(`Failed to cancel workflow ${workflowId}: ${message}`, error);
            throw new Error(`Failed to cancel workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Send a signal to a workflow
     */
    async signalWorkflow(
        workflowId: string,
        signalName: string,
        args?: unknown[],
        runId?: string,
    ): Promise<void> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            await handle.signal(signalName, ...(args || []));

            this.logger.debug(`Sent signal '${signalName}' to workflow: ${workflowId}`);
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${message}`,
                error,
            );
            throw new Error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${message}`,
            );
        }
    }

    /**
     * Send a signal using workflow handle
     */
    async signalWorkflowHandle(
        handle: WorkflowHandle,
        signalName: string,
        args?: unknown[],
    ): Promise<void> {
        try {
            await handle.signal(signalName, ...(args || []));
            this.logger.debug(`Sent signal '${signalName}' to workflow handle`);
        } catch (error) {
            this.logger.error(
                `Failed to send signal '${signalName}': ${this.extractErrorMessage(error)}`,
                error,
            );
            throw error;
        }
    }

    /**
     * Query a workflow for its current state
     */
    async queryWorkflow<T = unknown>(
        workflowId: string,
        queryName: string,
        args?: unknown[],
        runId?: string,
    ): Promise<T> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            const result = await handle.query(queryName, ...(args || []));

            this.logger.debug(`Queried '${queryName}' from workflow: ${workflowId}`);
            return result as T;
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${message}`,
                error,
            );
            throw new Error(`Failed to query '${queryName}' on workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Query a workflow using handle
     */
    async queryWorkflowHandle<T = unknown>(
        handle: WorkflowHandle,
        queryName: string,
        args?: unknown[],
    ): Promise<T> {
        try {
            const result = await handle.query(queryName, ...(args || []));
            this.logger.debug(`Queried '${queryName}' from workflow handle`);
            return result as T;
        } catch (error) {
            this.logger.error(
                `Failed to query '${queryName}': ${this.extractErrorMessage(error)}`,
                error,
            );
            throw error;
        }
    }

    /**
     * Wait for workflow completion and get result
     */
    async getWorkflowResult<T = unknown>(workflowId: string, runId?: string): Promise<T> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            const result = await handle.result();

            this.logger.debug(`Retrieved result from workflow: ${workflowId}`);
            return result as T;
        } catch (error) {
            this.logger.error(
                `Failed to get result from ${workflowId}: ${this.extractErrorMessage(error)}`,
                error,
            );
            throw error;
        }
    }

    /**
     * Check if client is available and healthy
     */
    isHealthy(): boolean {
        if (!this.isInitialized || !this.client) {
            return false;
        }

        // Check if health check is due
        const now = new Date();
        if (
            !this.lastHealthCheck ||
            now.getTime() - this.lastHealthCheck.getTime() > this.healthCheckInterval
        ) {
            // Perform async health check
            this.performHealthCheck().catch((error) => {
                this.logger.warn('Health check failed', error);
            });
        }

        return Boolean(this.client.workflow);
    }

    /**
     * Get client health status
     */
    getHealth(): ClientHealthStatus {
        return { status: this.isHealthy() ? 'healthy' : 'unhealthy' };
    }

    /**
     * Get client status for monitoring
     */
    getStatus(): ClientServiceStatus {
        return {
            available: this.client !== null,
            healthy: this.isHealthy(),
            initialized: this.isInitialized,
            lastHealthCheck: this.lastHealthCheck,
            namespace: this.options.connection?.namespace || 'default',
        };
    }

    /**
     * Get raw Temporal client (use with caution)
     */
    getRawClient(): Client | null {
        return this.client;
    }

    /**
     * Perform health check on the client
     */
    private async performHealthCheck(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            // Simplified health check - just check if client exists
            // More detailed health checks can be done via actual workflow operations
            if (!this.client) {
                throw new Error('Client is not initialized');
            }

            this.lastHealthCheck = new Date();
            this.logger.debug('Client health check passed');
        } catch (error) {
            this.logger.warn('Client health check failed', error);
            throw error; // Re-throw to indicate health check failure
        }
    }

    private ensureClientAvailable(): void {
        if (!this.client) {
            throw new Error('Temporal client not initialized');
        }
    }

    private generateWorkflowId(workflowType: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${workflowType}-${timestamp}-${random}`;
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

    private isRetryableError(error: unknown, message: string): boolean {
        // Check common gRPC connection error patterns
        const gRpcErrorPatterns = [
            'Unexpected error while making gRPC request',
            'connection error',
            'UNAVAILABLE',
            'DEADLINE_EXCEEDED',
            'RESOURCE_EXHAUSTED',
            'INTERNAL',
            'Service unavailable',
            'Connection refused',
            'Network error',
            'timeout',
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
        ];

        // Check if the error message contains any retryable patterns
        const messageMatch = gRpcErrorPatterns.some((pattern) =>
            message.toLowerCase().includes(pattern.toLowerCase()),
        );

        // Check if it's a specific gRPC error type
        if (error && typeof error === 'object' && 'code' in error) {
            const grpcCode = (error as { code: unknown }).code;
            // gRPC status codes that are retryable
            const retryableGrpcCodes = [1, 2, 4, 8, 10, 13, 14]; // CANCELLED, UNKNOWN, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED, INTERNAL, UNAVAILABLE
            if (typeof grpcCode === 'number' && retryableGrpcCodes.includes(grpcCode)) {
                return true;
            }
        }

        return messageMatch;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
