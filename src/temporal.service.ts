import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { TemporalClientService } from './client/temporal-client.service';
import { TemporalScheduleService } from './client/temporal-schedule.service';
import { WorkerManager } from './worker/worker-manager.service';

/**
 * Unified service for interacting with Temporal
 * Provides access to both client and worker functionality
 */
@Injectable()
export class TemporalService implements OnModuleInit {
    private readonly logger = new Logger(TemporalService.name);

    constructor(
        private readonly clientService: TemporalClientService,
        private readonly scheduleService: TemporalScheduleService,
        @Optional() private readonly workerManager?: WorkerManager,
    ) {}

    async onModuleInit() {
        this.logger.log('Temporal service initialized');

        if (this.workerManager) {
            this.logger.log('Worker manager is available');
        } else {
            this.logger.log('Worker manager is not available - running in client-only mode');
        }
    }

    /**
     * Get the Temporal client service
     * For starting workflows, signaling, querying, etc.
     */
    getClient(): TemporalClientService {
        return this.clientService;
    }

    /**
     * Get the Temporal schedule service
     * For managing scheduled workflows
     */
    getScheduleService(): TemporalScheduleService {
        return this.scheduleService;
    }

    /**
     * Get the worker manager if available
     * For controlling worker lifecycle
     */
    getWorkerManager(): WorkerManager | undefined {
        return this.workerManager;
    }

    /**
     * Check if worker functionality is available
     */
    hasWorker(): boolean {
        return !!this.workerManager;
    }

    /**
     * Start workflow with simplified options
     *
     * @param workflowType Name of the workflow type to start
     * @param args Arguments to pass to the workflow
     * @param taskQueue Task queue to use (required)
     * @param options Additional options (optional)
     * @returns Object containing workflow execution details
     *
     * @example
     * ```typescript
     * // Start a workflow
     * const { workflowId, result } = await temporalService.startWorkflow(
     *   'orderProcessingWorkflow',
     *   [orderId, customerId],
     *   'order-processing-queue',
     *   { workflowId: `order-${orderId}` }
     * );
     *
     * // Wait for the result if needed
     * const outcome = await result;
     * ```
     */
    async startWorkflow<T, A extends any[]>(
        workflowType: string,
        args: A,
        taskQueue: string,
        options: {
            workflowId?: string;
            searchAttributes?: Record<string, unknown>;
            [key: string]: any;
        } = {},
    ) {
        return this.clientService.startWorkflow<T, A>(workflowType, args, {
            taskQueue,
            ...options,
        });
    }
}
