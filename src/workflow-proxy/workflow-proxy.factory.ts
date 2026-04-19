import { Injectable } from '@nestjs/common';
import { TemporalClientService } from '../services/temporal-client.service';
import { WorkflowProxyConfig } from '../interfaces';
import { IWorkflowProxy, WorkflowProxy } from './workflow-proxy';
import type { Workflow } from '@temporalio/workflow';

/**
 * Factory service for creating typed workflow proxies.
 *
 * Registered as a global provider by `TemporalModule`. Inject this service
 * directly, or use `createWorkflowProvider()` to create a pre-configured
 * provider that resolves to an `IWorkflowProxy<T>` injection token.
 *
 * @example Direct factory usage
 * ```typescript
 * @Injectable()
 * class OrderService {
 *   private orderProxy: IWorkflowProxy<typeof orderWorkflow>;
 *
 *   constructor(factory: WorkflowProxyFactory) {
 *     this.orderProxy = factory.createProxy<typeof orderWorkflow>({
 *       workflowType: 'orderWorkflow',
 *       taskQueue: 'orders',
 *     });
 *   }
 * }
 * ```
 *
 * @example Via injection token (recommended)
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
@Injectable()
export class WorkflowProxyFactory {
    constructor(private readonly clientService: TemporalClientService) {}

    /**
     * Create a typed workflow proxy for a given workflow type.
     *
     * @typeParam T - The workflow function type
     * @param config - Workflow type name and optional task queue override
     */
    createProxy<T extends Workflow>(
        config: WorkflowProxyConfig,
    ): IWorkflowProxy<T> {
        return new WorkflowProxy<T>(this.clientService, config);
    }
}
