import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import {
    Client,
    WorkflowHandle,
    WorkflowStartOptions as TemporalWorkflowStartOptions,
    WorkflowExecutionAlreadyStartedError,
} from '@temporalio/client';
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
        args: readonly unknown[] = [],
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata> {
        this.ensureClientAvailable();

        // Validate workflow ID if user provided one (including empty strings)
        if (options?.workflowId !== undefined) {
            this.validateWorkflowId(options.workflowId);
        }

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

                this.logger.verbose(
                    `Starting workflow '${workflowType}' [${workflowId}] on queue '${taskQueue}'`,
                );

                const workflowOptions: TemporalWorkflowStartOptions = {
                    workflowId,
                    taskQueue,
                    args: [...args],
                    ...(options?.workflowExecutionTimeout && {
                        workflowExecutionTimeout: options.workflowExecutionTimeout,
                    }),
                    ...(options?.workflowRunTimeout && {
                        workflowRunTimeout: options.workflowRunTimeout,
                    }),
                    ...(options?.workflowTaskTimeout && {
                        workflowTaskTimeout: options.workflowTaskTimeout,
                    }),
                    ...(options?.searchAttributes && {
                        typedSearchAttributes: options.searchAttributes,
                    }),
                    ...(options?.memo && {
                        memo: options.memo,
                    }),
                    ...(options?.workflowIdReusePolicy !== undefined && {
                        workflowIdReusePolicy: options.workflowIdReusePolicy,
                    }),
                    ...(options?.retryPolicy && {
                        retry: options.retryPolicy,
                    }),
                };

                // Use our existing client
                const handle = await this.client!.workflow.start(workflowType, workflowOptions);

                this.logger.info(
                    `Started workflow '${workflowType}' [${workflowId}] on '${taskQueue}'`,
                );
                return { ...handle, handle };
            } catch (error) {
                // Re-throw WorkflowExecutionAlreadyStartedError as-is so callers can catch it by type
                if (error instanceof WorkflowExecutionAlreadyStartedError) {
                    throw error;
                }

                const message = this.extractErrorMessage(error);

                // Check if this is a gRPC connection error that we should retry
                const isRetryableError = this.isRetryableError(error, message);

                if (isRetryableError && attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
                    this.logger.warn(
                        `Workflow '${workflowType}' start failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms: ${message}`,
                    );
                    await this.sleep(retryDelay);
                    continue;
                }

                this.logger.error(
                    `Failed to start workflow '${workflowType}' [${workflowId}] on queue '${taskQueue}' after ${attempt} attempt(s)`,
                    error,
                );
                throw new Error(`Failed to start workflow '${workflowType}': ${message}`);
            }
        }

        /* istanbul ignore next */
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
            this.logger.verbose(
                `Retrieved workflow handle for '${workflowId}'${runId ? ` (run: ${runId})` : ''}`,
            );
            return handle;
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(`Failed to get workflow handle for '${workflowId}'`, error);
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

            this.logger.info(`Terminated workflow '${workflowId}'${reason ? `: ${reason}` : ''}`);
        } catch (error) {
            this.logger.error(`Failed to terminate workflow '${workflowId}'`, error);
            throw new Error(
                `Failed to terminate workflow ${workflowId}: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * Cancel a workflow execution
     */
    async cancelWorkflow(workflowId: string, runId?: string): Promise<void> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            await handle.cancel();

            this.logger.info(`Cancelled workflow '${workflowId}'`);
        } catch (error) {
            this.logger.error(`Failed to cancel workflow '${workflowId}'`, error);
            throw new Error(
                `Failed to cancel workflow ${workflowId}: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * Send a signal to a workflow
     */
    async signalWorkflow(
        workflowId: string,
        signalName: string,
        args?: readonly unknown[],
        runId?: string,
    ): Promise<void> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            await handle.signal(signalName, ...(args || []));

            this.logger.debug(`Sent signal '${signalName}' to workflow '${workflowId}'`);
        } catch (error) {
            this.logger.error(
                `Failed to send signal '${signalName}' to workflow '${workflowId}'`,
                error,
            );
            throw new Error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * Send a signal using workflow handle
     */
    async signalWorkflowHandle(
        handle: WorkflowHandle,
        signalName: string,
        args?: readonly unknown[],
    ): Promise<void> {
        try {
            await handle.signal(signalName, ...(args || []));
            this.logger.verbose(`Sent signal '${signalName}' to workflow`);
        } catch (error) {
            this.logger.error(`Failed to send signal '${signalName}'`, error);
            throw error;
        }
    }

    /**
     * Atomically start a workflow and send a signal to it.
     *
     * If the workflow is already running, only the signal is delivered.
     * This is Temporal's `signalWithStart` operation — useful for ensuring
     * a workflow is running before sending a signal without a race condition.
     *
     * @param workflowType - Temporal workflow type name
     * @param signalName - Signal name (string) to send
     * @param signalArgs - Arguments for the signal
     * @param workflowArgs - Arguments to start the workflow with (used only when starting)
     * @param options - Workflow start options (taskQueue, workflowId, etc.)
     */
    async signalWithStart(
        workflowType: string,
        signalName: string,
        signalArgs: readonly unknown[],
        workflowArgs: readonly unknown[],
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata> {
        this.ensureClientAvailable();

        const workflowId = options?.workflowId || this.generateWorkflowId(workflowType);
        const taskQueue = options?.taskQueue || this.options.taskQueue || 'default';

        try {
            this.logger.verbose(
                `Signal-with-starting workflow '${workflowType}' [${workflowId}] signal='${signalName}'`,
            );

            const handle = await this.client!.workflow.signalWithStart(workflowType, {
                workflowId,
                taskQueue,
                args: [...workflowArgs],
                signal: signalName,
                signalArgs: [...signalArgs],
                ...(options?.workflowExecutionTimeout && {
                    workflowExecutionTimeout: options.workflowExecutionTimeout,
                }),
                ...(options?.workflowRunTimeout && {
                    workflowRunTimeout: options.workflowRunTimeout,
                }),
                ...(options?.workflowTaskTimeout && {
                    workflowTaskTimeout: options.workflowTaskTimeout,
                }),
                ...(options?.memo && { memo: options.memo }),
                ...(options?.workflowIdReusePolicy && {
                    workflowIdReusePolicy: options.workflowIdReusePolicy,
                }),
            });

            this.logger.info(
                `Signal-with-started workflow '${workflowType}' [${workflowId}] signal='${signalName}'`,
            );
            return { ...handle, handle };
        } catch (error) {
            const message = this.extractErrorMessage(error);
            this.logger.error(
                `Failed to signalWithStart workflow '${workflowType}' [${workflowId}]`,
                error,
            );
            throw new Error(`Failed to signalWithStart workflow '${workflowType}': ${message}`);
        }
    }

    /**
     * Query a workflow for its current state
     */
    async queryWorkflow<T = unknown>(
        workflowId: string,
        queryName: string,
        args?: readonly unknown[],
        runId?: string,
    ): Promise<T> {
        try {
            const handle = await this.getWorkflowHandle(workflowId, runId);
            const result = await handle.query(queryName, ...(args || []));

            this.logger.debug(`Queried '${queryName}' from workflow '${workflowId}'`);
            return result as T;
        } catch (error) {
            this.logger.error(`Failed to query '${queryName}' on workflow '${workflowId}'`, error);
            throw new Error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${this.extractErrorMessage(error)}`,
            );
        }
    }

    /**
     * Query a workflow using handle
     */
    async queryWorkflowHandle<T = unknown>(
        handle: WorkflowHandle,
        queryName: string,
        args?: readonly unknown[],
    ): Promise<T> {
        try {
            const result = await handle.query(queryName, ...(args || []));
            this.logger.verbose(`Queried '${queryName}' from workflow`);
            return result as T;
        } catch (error) {
            this.logger.error(`Failed to query '${queryName}'`, error);
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

            this.logger.verbose(`Retrieved result from workflow '${workflowId}'`);
            return result as T;
        } catch (error) {
            this.logger.error(`Failed to get result from workflow '${workflowId}'`, error);
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
        const workflowId = `${workflowType}-${timestamp}-${random}`;
        this.validateWorkflowId(workflowId);
        return workflowId;
    }

    /**
     * Validate workflow ID format and constraints
     * Temporal has specific requirements for workflow IDs:
     * - Cannot be empty
     * - Cannot exceed 1000 characters
     * - Cannot contain newlines, tabs, or other control characters
     */
    private validateWorkflowId(workflowId: string): void {
        if (!workflowId || workflowId.trim() === '') {
            throw new Error('Workflow ID cannot be empty');
        }

        if (workflowId.length > 1000) {
            throw new Error(
                `Workflow ID too long (${workflowId.length} characters). Maximum length is 1000 characters`,
            );
        }

        // Temporal doesn't allow newlines, tabs, or other control characters
        if (/[\n\r\t\u0000-\u001f\u007f]/.test(workflowId)) {
            throw new Error('Workflow ID cannot contain newlines, tabs, or control characters');
        }
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
