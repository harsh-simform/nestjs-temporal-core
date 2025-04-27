import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, WorkflowClient, WorkflowHandle } from '@temporalio/client';
import { TEMPORAL_CLIENT, ERRORS } from '../constants';
import { StartWorkflowOptions } from '../interfaces';

@Injectable()
export class TemporalClientService implements OnModuleInit {
    private readonly logger = new Logger(TemporalClientService.name);
    private workflowClient: WorkflowClient | null = null;

    constructor(
        @Inject(TEMPORAL_CLIENT)
        private readonly client: Client | null,
    ) {
        if (this.client) {
            this.workflowClient = this.client.workflow;
        }
    }

    async onModuleInit() {
        if (!this.client) {
            this.logger.warn('Temporal client not initialized - some features may be unavailable');
        } else {
            this.logger.log('Temporal client initialized successfully');
        }
    }

    /**
     * Get the Temporal workflow client instance
     * @returns Workflow client or null if not initialized
     */
    getWorkflowClient(): WorkflowClient | null {
        return this.workflowClient;
    }

    /**
     * Get the raw Temporal client instance
     * @returns Raw client or null if not initialized
     */
    getRawClient(): Client | null {
        return this.client;
    }

    /**
     * Ensure client is initialized before performing operations
     * @private
     */
    private ensureClientInitialized() {
        if (!this.workflowClient) {
            throw new Error(ERRORS.CLIENT_NOT_INITIALIZED);
        }
    }

    /**
     * Start a workflow execution with simplified options
     *
     * @param workflowType Type of workflow to start
     * @param args Arguments to pass to the workflow
     * @param options Workflow configuration options
     * @returns Object containing workflow result promise, ID, and handle
     */
    async startWorkflow<T, A extends any[]>(
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
            workflowId = `${workflowType}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            signal,
            ...restOptions
        } = options;

        try {
            // Create workflow options in Temporal SDK format
            const startOptions: any = {
                taskQueue,
                workflowId,
                ...restOptions,
            };

            const handle = await this.workflowClient!.start(workflowType, {
                args,
                ...startOptions,
            });

            // If a signal is provided, send it to the newly created workflow
            if (signal) {
                await handle.signal(signal.name, ...(signal.args || []));
            }

            return {
                result: handle.result() as Promise<T>,
                workflowId: handle.workflowId,
                firstExecutionRunId: handle.firstExecutionRunId,
                handle,
            };
        } catch (error) {
            this.logger.error(`Failed to start workflow '${workflowType}': ${error.message}`);
            throw new Error(`Failed to start workflow '${workflowType}': ${error.message}`);
        }
    }

    /**
     * Send a signal to a running workflow
     *
     * @param workflowId ID of the workflow to signal
     * @param signalName Name of the signal to send
     * @param args Arguments to pass with the signal
     */
    async signalWorkflow(workflowId: string, signalName: string, args: any[] = []): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.signal(signalName, ...args);
        } catch (error) {
            this.logger.error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${error.message}`,
            );
            throw new Error(
                `Failed to send signal '${signalName}' to workflow ${workflowId}: ${error.message}`,
            );
        }
    }

    /**
     * Query a workflow's state
     *
     * @param workflowId ID of the workflow to query
     * @param queryName Name of the query to execute
     * @param args Arguments to pass to the query
     * @returns Query result
     */
    async queryWorkflow<T>(workflowId: string, queryName: string, args: any[] = []): Promise<T> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            return await handle.query(queryName, ...args);
        } catch (error) {
            this.logger.error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${error.message}`,
            );
            throw new Error(
                `Failed to query '${queryName}' on workflow ${workflowId}: ${error.message}`,
            );
        }
    }

    /**
     * Terminate a running workflow
     *
     * @param workflowId ID of the workflow to terminate
     * @param reason Reason for termination (optional)
     */
    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.terminate(reason);
        } catch (error) {
            this.logger.error(`Failed to terminate workflow ${workflowId}: ${error.message}`);
            throw new Error(`Failed to terminate workflow ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Cancel a running workflow
     *
     * @param workflowId ID of the workflow to cancel
     */
    async cancelWorkflow(workflowId: string): Promise<void> {
        this.ensureClientInitialized();

        try {
            const handle = await this.workflowClient!.getHandle(workflowId);
            await handle.cancel();
        } catch (error) {
            this.logger.error(`Failed to cancel workflow ${workflowId}: ${error.message}`);
            throw new Error(`Failed to cancel workflow ${workflowId}: ${error.message}`);
        }
    }

    /**
     * Get a workflow handle for a running workflow
     *
     * @param workflowId ID of the workflow
     * @param runId Specific run ID (optional)
     * @returns Workflow handle
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
     * Describe a workflow execution
     *
     * @param workflowId ID of the workflow
     * @param runId Specific run ID (optional)
     * @returns Workflow execution description
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
     * List workflows matching a query
     *
     * @param query Query string in SQL-like syntax to filter workflows
     * @param pageSize Number of results per page
     * @returns AsyncIterable of workflow executions
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
}
