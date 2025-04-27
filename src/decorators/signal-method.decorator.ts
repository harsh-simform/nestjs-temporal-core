import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_SIGNAL_METHOD, TEMPORAL_SIGNAL_NAME } from '../constants';

/**
 * Decorator that marks a method as a Temporal Signal Method
 *
 * Signal methods handle incoming signals to a workflow.
 *
 * @param name Optional signal name (defaults to method name)
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
 *   @SignalMethod()
 *   async addItem(item: string): void {
 *     // Handle signal
 *   }
 *
 *   @SignalMethod('cancelProcessing')
 *   async cancel(): void {
 *     // Handle cancel signal
 *   }
 * }
 * ```
 */
export const SignalMethod = (name?: string): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const signalName = name || propertyKey.toString();

        // Store metadata
        Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, true, descriptor.value);
        Reflect.defineMetadata(TEMPORAL_SIGNAL_NAME, signalName, descriptor.value);

        // Set NestJS metadata
        SetMetadata(TEMPORAL_SIGNAL_METHOD, true)(descriptor.value);
        SetMetadata(TEMPORAL_SIGNAL_NAME, signalName)(descriptor.value);

        return descriptor;
    };
};
