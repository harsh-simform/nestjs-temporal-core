import { InjectionToken, FactoryProvider } from '@nestjs/common';
import type { Workflow } from '@temporalio/workflow';
import { WorkflowProxyFactory } from '../workflow-proxy/workflow-proxy.factory';
import { IWorkflowProxy } from '../workflow-proxy/workflow-proxy';
import { WorkflowProxyConfig } from '../interfaces';

/**
 * Create a unique NestJS injection token for a workflow proxy.
 *
 * Pair with `createWorkflowProvider` to register a typed proxy provider
 * that can be injected by this token anywhere in the application.
 *
 * @example
 * ```typescript
 * export const ORDER_WORKFLOW = createWorkflowToken('orderWorkflow');
 * ```
 */
export function createWorkflowToken(workflowType: string): InjectionToken {
    return `TEMPORAL_WORKFLOW_${workflowType.toUpperCase()}`;
}

/**
 * Create a NestJS `FactoryProvider` that resolves to a typed `IWorkflowProxy<T>`.
 *
 * Add the returned provider to your feature module's `providers` array and
 * export the token so other modules can inject the proxy.
 *
 * Requires `TemporalModule` to be imported (globally or in the same module)
 * so that `WorkflowProxyFactory` is available for injection.
 *
 * @typeParam T - The workflow function type (e.g. `typeof orderWorkflow`)
 * @param token - Injection token created with `createWorkflowToken`
 * @param config - Workflow type name and optional task queue override
 *
 * @example
 * ```typescript
 * // constants.ts
 * export const ORDER_WORKFLOW = createWorkflowToken('orderWorkflow');
 *
 * // order.module.ts
 * @Module({
 *   providers: [
 *     createWorkflowProvider<typeof orderWorkflow>(ORDER_WORKFLOW, {
 *       workflowType: 'orderWorkflow',
 *       taskQueue: 'orders',
 *     }),
 *   ],
 *   exports: [ORDER_WORKFLOW],
 * })
 * export class OrderModule {}
 *
 * // order.service.ts
 * constructor(
 *   @Inject(ORDER_WORKFLOW)
 *   private readonly orderProxy: IWorkflowProxy<typeof orderWorkflow>,
 * ) {}
 * ```
 */
export function createWorkflowProvider<T extends Workflow>(
    token: InjectionToken,
    config: WorkflowProxyConfig,
): FactoryProvider {
    return {
        provide: token,
        inject: [WorkflowProxyFactory],
        useFactory: (factory: WorkflowProxyFactory): IWorkflowProxy<T> =>
            factory.createProxy<T>(config),
    };
}
