import type { Workflow, SignalDefinition, QueryDefinition } from '@temporalio/workflow';
import { WorkflowHandle } from '@temporalio/client';
import { TemporalClientService } from '../services/temporal-client.service';
import {
    WorkflowHandleWithMetadata,
    WorkflowStartOptions,
    WorkflowProxyConfig,
} from '../interfaces';

/**
 * Typed proxy interface for interacting with a specific workflow type.
 *
 * `T` must be a Temporal workflow function type (e.g. `typeof myWorkflow`).
 * All method signatures are inferred from `T` — no `any`, no `unknown[]` at the call site.
 *
 * @typeParam T - A Temporal `Workflow` function type
 *
 * @example
 * ```typescript
 * constructor(
 *   @Inject(ORDER_WORKFLOW)
 *   private readonly orderProxy: IWorkflowProxy<typeof orderWorkflow>,
 * ) {}
 *
 * // start — args are typed as Parameters<typeof orderWorkflow>
 * await this.orderProxy.start([orderId, customerId], { workflowId: `order-${orderId}` });
 *
 * // signal — TArgs inferred from the SignalDefinition
 * await this.orderProxy.signal(workflowId, approveSignal, reason);
 *
 * // query — return type inferred from the QueryDefinition
 * const status: OrderStatus = await this.orderProxy.query(workflowId, statusQuery);
 * ```
 */
export interface IWorkflowProxy<T extends Workflow> {
    /**
     * Start a new execution of this workflow.
     * Args are typed as `Parameters<T>` — TypeScript enforces the workflow's signature.
     */
    start(
        args: Parameters<T>,
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata<T>>;

    /**
     * Get a typed handle to an existing workflow execution.
     * `result()` on the handle returns `Promise<WorkflowResultType<T>>`.
     */
    getHandle(workflowId: string, runId?: string): Promise<WorkflowHandle<T>>;

    /**
     * Send a typed signal using a `SignalDefinition` created with `defineSignal`.
     * TypeScript infers `TArgs` from the definition — call site is fully type-checked.
     */
    signal<TArgs extends unknown[]>(
        workflowId: string,
        signalDef: SignalDefinition<TArgs>,
        ...args: TArgs
    ): Promise<void>;

    /**
     * Send a signal by string name. Use when a `SignalDefinition` is unavailable.
     * Args are `readonly unknown[]` — no implicit `any`.
     */
    signalByName(workflowId: string, signalName: string, args?: readonly unknown[]): Promise<void>;

    /**
     * Query the workflow using a typed `QueryDefinition` created with `defineQuery`.
     * `TResult` and `TArgs` are both inferred from the definition.
     */
    query<TResult, TArgs extends unknown[] = []>(
        workflowId: string,
        queryDef: QueryDefinition<TResult, TArgs>,
        ...args: TArgs
    ): Promise<TResult>;

    /**
     * Query by string name. Use when a `QueryDefinition` is unavailable.
     * Caller must supply `TResult` explicitly (e.g. `queryByName<OrderStatus>(...)`).
     */
    queryByName<TResult>(
        workflowId: string,
        queryName: string,
        args?: readonly unknown[],
    ): Promise<TResult>;

    /**
     * Atomically start the workflow and send a signal.
     * If the workflow is already running, only the signal is delivered (no duplicate start).
     * Both `signalArgs` and `workflowArgs` are fully typed via the respective definitions.
     */
    signalWithStart<TSignalArgs extends unknown[]>(
        signalDef: SignalDefinition<TSignalArgs>,
        signalArgs: TSignalArgs,
        workflowArgs: Parameters<T>,
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata<T>>;
}

/**
 * Concrete implementation of `IWorkflowProxy<T>`.
 *
 * Plain class — not `@Injectable`. Instances are created by `WorkflowProxyFactory`
 * and registered as NestJS providers via `createWorkflowProvider()`.
 */
export class WorkflowProxy<T extends Workflow> implements IWorkflowProxy<T> {
    constructor(
        private readonly clientService: TemporalClientService,
        private readonly config: WorkflowProxyConfig,
    ) {}

    async start(
        args: Parameters<T>,
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata<T>> {
        const handle = await this.clientService.startWorkflow(
            this.config.workflowType,
            args,
            this.mergeOptions(options),
        );
        return handle as WorkflowHandleWithMetadata<T>;
    }

    async getHandle(workflowId: string, runId?: string): Promise<WorkflowHandle<T>> {
        const handle = await this.clientService.getWorkflowHandle(workflowId, runId);
        return handle as WorkflowHandle<T>;
    }

    async signal<TArgs extends unknown[]>(
        workflowId: string,
        signalDef: SignalDefinition<TArgs>,
        ...args: TArgs
    ): Promise<void> {
        return this.clientService.signalWorkflow(workflowId, signalDef.name, args);
    }

    async signalByName(
        workflowId: string,
        signalName: string,
        args?: readonly unknown[],
    ): Promise<void> {
        return this.clientService.signalWorkflow(workflowId, signalName, args);
    }

    async query<TResult, TArgs extends unknown[] = []>(
        workflowId: string,
        queryDef: QueryDefinition<TResult, TArgs>,
        ...args: TArgs
    ): Promise<TResult> {
        return this.clientService.queryWorkflow<TResult>(workflowId, queryDef.name, args);
    }

    async queryByName<TResult>(
        workflowId: string,
        queryName: string,
        args?: readonly unknown[],
    ): Promise<TResult> {
        return this.clientService.queryWorkflow<TResult>(workflowId, queryName, args);
    }

    async signalWithStart<TSignalArgs extends unknown[]>(
        signalDef: SignalDefinition<TSignalArgs>,
        signalArgs: TSignalArgs,
        workflowArgs: Parameters<T>,
        options?: WorkflowStartOptions,
    ): Promise<WorkflowHandleWithMetadata<T>> {
        const handle = await this.clientService.signalWithStart(
            this.config.workflowType,
            signalDef.name,
            signalArgs,
            workflowArgs,
            this.mergeOptions(options),
        );
        return handle as WorkflowHandleWithMetadata<T>;
    }

    private mergeOptions(options?: WorkflowStartOptions): WorkflowStartOptions {
        return {
            ...(this.config.taskQueue && { taskQueue: this.config.taskQueue }),
            ...options,
        };
    }
}
