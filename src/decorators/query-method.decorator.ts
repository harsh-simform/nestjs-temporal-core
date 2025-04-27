import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_QUERY_METHOD, TEMPORAL_QUERY_NAME } from '../constants';

/**
 * Decorator that marks a method as a Temporal Query Method
 *
 * Query methods allow reading workflow state without affecting it.
 *
 * @param name Optional query name (defaults to method name)
 *
 * @example
 * ```typescript
 * @Workflow({
 *   name: 'OrderWorkflow',
 *   taskQueue: 'order-queue'
 * })
 * export class OrderWorkflow {
 *   private status: string = 'pending';
 *
 *   @WorkflowMethod()
 *   async processOrder(orderId: string): Promise<string> {
 *     this.status = 'processing';
 *     // ...
 *     this.status = 'completed';
 *     return this.status;
 *   }
 *
 *   @QueryMethod()
 *   getStatus(): string {
 *     return this.status;
 *   }
 * }
 * ```
 */
export const QueryMethod = (name?: string): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const queryName = name || propertyKey.toString();

        // Store metadata
        Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, true, descriptor.value);
        Reflect.defineMetadata(TEMPORAL_QUERY_NAME, queryName, descriptor.value);

        // Set NestJS metadata
        SetMetadata(TEMPORAL_QUERY_METHOD, true)(descriptor.value);
        SetMetadata(TEMPORAL_QUERY_NAME, queryName)(descriptor.value);

        return descriptor;
    };
};
