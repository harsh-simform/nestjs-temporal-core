import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_WORKFLOW_METHOD, TEMPORAL_WORKFLOW_METHOD_NAME } from '../constants';
import { WorkflowMethodOptions } from 'src/interfaces';

/**
 * Decorator that marks a method as a Temporal Workflow Method
 *
 * Workflow methods are the entry points to workflow execution.
 *
 * @param options Optional configuration or workflow name string
 *
 * @example
 * ```typescript
 * @Workflow({
 *   name: 'OrderWorkflow',
 *   taskQueue: 'order-queue'
 * })
 * export class OrderWorkflow {
 *   @WorkflowMethod()
 *   async processOrder(orderId: string): Promise<string> {
 *     // Workflow implementation
 *     return 'completed';
 *   }
 *
 *   @WorkflowMethod('cancelOrder')
 *   async cancelOrder(orderId: string): Promise<string> {
 *     // Workflow implementation
 *     return 'cancelled';
 *   }
 * }
 * ```
 */
export const WorkflowMethod = (options?: string | WorkflowMethodOptions): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        // Handle both string (name) and options object
        let methodName: string;

        if (typeof options === 'string') {
            methodName = options;
        } else if (options && typeof options === 'object' && options.name) {
            methodName = options.name;
        } else {
            methodName = propertyKey.toString();
        }

        // Store metadata
        Reflect.defineMetadata(TEMPORAL_WORKFLOW_METHOD, true, descriptor.value);
        Reflect.defineMetadata(TEMPORAL_WORKFLOW_METHOD_NAME, methodName, descriptor.value);

        // Set NestJS metadata
        SetMetadata(TEMPORAL_WORKFLOW_METHOD, true)(descriptor.value);
        SetMetadata(TEMPORAL_WORKFLOW_METHOD_NAME, methodName)(descriptor.value);

        return descriptor;
    };
};
