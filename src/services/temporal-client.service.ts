import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, WorkflowClient, WorkflowHandle } from '@temporalio/client';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { StartWorkflowOptions } from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Provides client-side operations for interacting with Temporal workflows.
 *
 * This service handles workflow lifecycle management including starting, signaling,
 * querying, terminating, and canceling workflows. It provides a high-level interface
 * to the Temporal client SDK with proper error handling and logging.
 *
 * Key features:
 * - Workflow execution management (start, signal, query, terminate, cancel)
 * - Workflow handle management and retrieval
 * - Workflow listing and description
 * - Client health monitoring
 * - Automatic workflow ID generation
 * - Comprehensive error handling and logging
 *
 * @example
 * ```typescript
 * // Start a workflow
 * const { workflowId, result } = await clientService.startWorkflow(
 *   'processOrder',
 *   [orderId, customerId],
 *   { taskQueue: 'orders', workflowId: 'order-123' }
 * );
 *
 * // Send a signal to a workflow
 * await clientService.signalWorkflow('order-123', 'updateStatus', ['shipped']);
 *
 * // Query workflow state
 * const status = await clientService.queryWorkflow('order-123', 'getStatus');
 * ```
 */
@Injectable()
export class TemporalClientService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private readonly workflowClient: WorkflowClient | null;

    constructor(
        @Inject(TEMPORAL_CLIENT)
        private readonly client: Client | null,
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: Record<string, unknown>,
    ) {
        this.workflowClient = this.client?.workflow || null;
        this.logger = createLogger(TemporalClientService.name);
    }

    /**
     * Initializes the client service during module initialization.
     * Logs initialization status and warns if client is not available.
     */
    async onModuleInit() {
        if (!this.client) {
            this.logger.warn('Temporal client not initialized - some features may be unavailable');
        } else {
            this.logger.log('Temporal client initialized successfully');
        }
    }

    /**
     * Starts a new workflow execution with the specified type and arguments.
     *
     * @param workflowType - The name of the workflow type to start
     * @param args - Arguments to pass to the workflow
     * @param options - Workflow execution options including task queue and workflow ID
     * @returns Promise resolving to workflow execution details including handle and result
     * @throws Error if client is not initialized or workflow start fails
     *
     * @example
     * ```typescript
     * const { workflowId, result } = await startWorkflow(
     *   'processPayment',
     *   [paymentId, amount],
     *   { taskQueue: 'payments', workflowId: 'payment-123' }
     * );
     * ```
     */
    async startWorkflow<T, A extends unknown[]>(
        workflowType: string,
        args: A,
        options: StartWorkflowOptions,
    ): Promise<{
        result: Promise<T>;
        workflowId: string;
        firstExecutionRunId: string;
        handle: WorkflowHandle;
    }> {
        this.ensureClientInitialized();
        const {
            taskQueue,
            workflowId = this.generateWorkflowId(workflowType),
            signal,
            ...restOptions
        } = options;
        try {
            const handle = await this.workflowClient!.start(workflowType, {
                taskQueue,
                workflowId,
                args,
                ...restOptions,
            });
            if (signal) {
                await handle.signal(signal.name, ...(signal.args || []));
            }
            this.logger.debug(`Started workflow: ${workflowType} (${workflowId})`);
            return {
                result: handle.result() as Promise<T>,
                workflowId: handle.workflowId,
                firstExecutionRunId: handle.firstExecutionRunId,
                handle,
            };
        } catch (error) {
            this.logger.error(
                `Failed to start workflow '${workflowType}': ${(error as Error).message}`,
            );
            throw new Error(
                `Failed to start workflow '${workflowType}': ${(error as Error).message}`,
            );
        }
    }

    /**
     * Sends a signal to a running workflow to update its state or trigger actions.
     *
     * @param workflowId - The ID of the workflow to signal
     * @param signalName - The name of the signal to send
     * @param args - Arguments to pass with the signal
     * @throws Error if client is not initialized or signal fails
     *
     * @example
     * ```typescript
     * await signalWorkflow('order-123', 'updateInventory', [itemId, quantity]);
     * ```
     */
    async signalWorkflow(
        workflowId: string,
        signalName: string,
        args: unknown[] = [],
    ): Promise<void> {
        this.ensureClientInitialized();
        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.signal(signalName, ...args);
            this.logger.debug(`Sent signal '${signalName}' to workflow ${workflowId}`);
        } catch (error) {
            this.logger.error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${(error as Error).message}`,
            );
            throw new Error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Queries a workflow's current state without affecting its execution.
     *
     * @param workflowId - The ID of the workflow to query
     * @param queryName - The name of the query to execute
     * @param args - Arguments to pass with the query
     * @returns Promise resolving to the query result
     * @throws Error if client is not initialized or query fails
     *
     * @example
     * ```typescript
     * const orderStatus = await queryWorkflow('order-123', 'getStatus');
     * const orderDetails = await queryWorkflow('order-123', 'getOrderDetails', [includeItems]);
     * ```
     */
    async queryWorkflow<T>(
        workflowId: string,
        queryName: string,
        args: unknown[] = [],
    ): Promise<T> {
        this.ensureClientInitialized();
        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            const result = await handle.query(queryName, ...args);
            this.logger.debug(`Queried '${queryName}' on workflow ${workflowId}`);
            return result as T;
        } catch (error) {
            this.logger.error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${(error as Error).message}`,
            );
            throw new Error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Terminates a running workflow, stopping its execution immediately.
     *
     * @param workflowId - The ID of the workflow to terminate
     * @param reason - Optional reason for termination
     * @throws Error if client is not initialized or termination fails
     *
     * @example
     * ```typescript
     * await terminateWorkflow('order-123', 'Order cancelled by customer');
     * ```
     */
    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        this.ensureClientInitialized();
        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.terminate(reason);
            this.logger.log(`Terminated workflow ${workflowId}${reason ? `: ${reason}` : ''}`);
        } catch (error) {
            this.logger.error(`Failed to terminate workflow ${workflowId}: ${error.message}`);
            throw new Error(`Failed to terminate workflow ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Cancels a running workflow, requesting it to stop gracefully.
     *
     * @param workflowId - The ID of the workflow to cancel
     * @throws Error if client is not initialized or cancellation fails
     *
     * @example
     * ```typescript
     * await cancelWorkflow('order-123');
     * ```
     */
    async cancelWorkflow(workflowId: string): Promise<void> {
        this.ensureClientInitialized();
        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.cancel();
            this.logger.log(`Cancelled workflow ${workflowId}`);
        } catch (error) {
            this.logger.error(`Failed to cancel workflow ${workflowId}: ${error.message}`);
            throw new Error(`Failed to cancel workflow ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Returns a workflow handle for interacting with a running workflow.
     *
     * @param workflowId - The ID of the workflow
     * @param runId - Optional run ID for a specific execution
     * @returns Promise resolving to the workflow handle
     * @throws Error if client is not initialized or handle retrieval fails
     *
     * @example
     * ```typescript
     * const handle = await getWorkflowHandle('order-123');
     * const result = await handle.result();
     * ```
     */
    async getWorkflowHandle(workflowId: string, runId?: string): Promise<WorkflowHandle> {
        this.ensureClientInitialized();
        try {
            return await this.workflowClient!.getHandle(workflowId, runId);
        } catch (error) {
            this.logger.error(`Failed to get workflow handle for ${workflowId}: ${error.message}`);
            throw new Error(`Failed to get workflow handle for ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Describes a workflow execution, returning detailed information about its state.
     *
     * @param workflowId - The ID of the workflow to describe
     * @param runId - Optional run ID for a specific execution
     * @returns Promise resolving to workflow description
     * @throws Error if client is not initialized or description fails
     *
     * @example
     * ```typescript
     * const description = await describeWorkflow('order-123');
     * console.log('Workflow status:', description.status);
     * ```
     */
    async describeWorkflow(workflowId: string, runId?: string) {
        this.ensureClientInitialized();
        try {
            const handle = await this.workflowClient!.getHandle(workflowId, runId);
            return await handle.describe();
        } catch (error) {
            this.logger.error(`Failed to describe workflow ${workflowId}: ${error.message}`);
            throw new Error(`Failed to describe workflow ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Lists workflows matching a query with pagination support.
     *
     * @param query - Query string to filter workflows
     * @param pageSize - Number of results per page (default: 100)
     * @returns Async iterator of workflow descriptions
     * @throws Error if client is not initialized or listing fails
     *
     * @example
     * ```typescript
     * const workflows = listWorkflows('WorkflowType="processOrder"');
     * for await (const workflow of workflows) {
     *   console.log('Workflow:', workflow.workflowId);
     * }
     * ```
     */
    listWorkflows(query: string, pageSize = 100) {
        this.ensureClientInitialized();
        try {
            return this.workflowClient!.list({ query, pageSize });
        } catch (error) {
            this.logger.error(`Failed to list workflows with query '${query}': ${error.message}`);
            throw new Error(`Failed to list workflows with query '${query}': ${error.message}`);
        }
    }

    /**
     * Returns the Temporal workflow client instance for advanced operations.
     *
     * @returns The workflow client instance or null if not initialized
     */
    getWorkflowClient(): WorkflowClient | null {
        return this.workflowClient;
    }

    /**
     * Returns the raw Temporal client instance for low-level operations.
     *
     * @returns The raw client instance or null if not initialized
     */
    getRawClient(): Client | null {
        return this.client;
    }

    /**
     * Checks if the client is available and healthy.
     *
     * @returns True if both client and workflow client are initialized
     */
    isHealthy(): boolean {
        return Boolean(this.client && this.workflowClient);
    }

    /**
     * Returns client status information for monitoring and debugging.
     *
     * @returns Object containing client availability and health status
     */
    getStatus(): {
        available: boolean;
        healthy: boolean;
        connection?: string;
        namespace?: string;
    } {
        return {
            available: Boolean(this.client),
            healthy: this.isHealthy(),
        };
    }

    /**
     * Ensures the workflow client is initialized before operations.
     *
     * @throws Error if workflow client is not initialized
     */
    private ensureClientInitialized(): void {
        if (!this.workflowClient) {
            throw new Error('Temporal client not initialized');
        }
    }

    /**
     * Generates a unique workflow ID for a given workflow type.
     *
     * @param workflowType - The workflow type name
     * @returns A unique workflow ID with timestamp and random suffix
     */
    private generateWorkflowId(workflowType: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2);
        return `${workflowType}-${timestamp}-${random}`;
    }
}
