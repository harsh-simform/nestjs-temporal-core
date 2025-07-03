import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Client, WorkflowClient, WorkflowHandle } from '@temporalio/client';
import { ERRORS, TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { StartWorkflowOptions } from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Streamlined Temporal Client Service
 * Handles all workflow operations: start, signal, query, terminate, cancel
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

    async onModuleInit() {
        if (!this.client) {
            this.logger.warn('Temporal client not initialized - some features may be unavailable');
        } else {
            this.logger.log('Temporal client initialized successfully');
        }
    }

    // ==========================================
    // Core Workflow Operations
    // ==========================================

    /**
     * Start a workflow execution
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
            const startOptions = {
                taskQueue,
                workflowId,
                ...restOptions,
            };

            const handle = await this.workflowClient!.start(workflowType, {
                taskQueue: startOptions.taskQueue,
                workflowId: startOptions.workflowId,
                args,
                ...restOptions,
            });

            // Send initial signal if provided
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
            const errorMsg = `Failed to start workflow '${workflowType}': ${(error as Error).message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Send a signal to a running workflow
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
            const errorMsg = `Failed to send signal '${signalName}' to workflow ${workflowId}: ${(error as Error).message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Query a workflow's state
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
            const errorMsg = `Failed to query '${queryName}' on workflow ${workflowId}: ${(error as Error).message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Terminate a running workflow
     */
    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.terminate(reason);
            this.logger.log(`Terminated workflow ${workflowId}${reason ? `: ${reason}` : ''}`);
        } catch (error) {
            const errorMsg = `Failed to terminate workflow ${workflowId}: ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Cancel a running workflow
     */
    async cancelWorkflow(workflowId: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.cancel();
            this.logger.log(`Cancelled workflow ${workflowId}`);
        } catch (error) {
            const errorMsg = `Failed to cancel workflow ${workflowId}: ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    // ==========================================
    // Workflow Information & Management
    // ==========================================

    /**
     * Get a workflow handle for a running workflow
     */
    async getWorkflowHandle(workflowId: string, runId?: string): Promise<WorkflowHandle> {
        this.ensureClientInitialized();

        try {
            return await this.workflowClient!.getHandle(workflowId, runId);
        } catch (error) {
            const errorMsg = `Failed to get workflow handle for ${workflowId}: ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Describe a workflow execution
     */
    async describeWorkflow(workflowId: string, runId?: string) {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId, runId);
            return await handle.describe();
        } catch (error) {
            const errorMsg = `Failed to describe workflow ${workflowId}: ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * List workflows matching a query
     */
    listWorkflows(query: string, pageSize = 100) {
        this.ensureClientInitialized();

        try {
            return this.workflowClient!.list({ query, pageSize });
        } catch (error) {
            const errorMsg = `Failed to list workflows with query '${query}': ${error.message}`;
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    // ==========================================
    // Client Access & Health
    // ==========================================

    /**
     * Get the Temporal workflow client instance
     */
    getWorkflowClient(): WorkflowClient | null {
        return this.workflowClient;
    }

    /**
     * Get the raw Temporal client instance
     */
    getRawClient(): Client | null {
        return this.client;
    }

    /**
     * Check if client is available and healthy
     */
    isHealthy(): boolean {
        return Boolean(this.client && this.workflowClient);
    }

    /**
     * Get client status for monitoring
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
            // Note: Connection details would need to be stored during initialization
            // This is a simplified version
        };
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Ensure client is initialized before performing operations
     */
    private ensureClientInitialized(): void {
        if (!this.workflowClient) {
            throw new Error(ERRORS.CLIENT_NOT_INITIALIZED);
        }
    }

    /**
     * Generate a unique workflow ID
     */
    private generateWorkflowId(workflowType: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2);
        return `${workflowType}-${timestamp}-${random}`;
    }
}
