import { SetMetadata } from '@nestjs/common';
import {
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_ACTIVITY_METHOD_NAME,
    TEMPORAL_ACTIVITY_METHOD_OPTIONS,
} from '../constants';
import { ActivityMethodOptions } from '../interfaces/activity.interface';

/**
 * Decorator that marks a method as a Temporal Activity Method
 *
 * Activity methods are the implementation of individual activities that can be
 * executed by a workflow.
 *
 * @param options Optional configuration or activity name string
 *
 * @example
 * ```typescript
 * @Activity()
 * export class EmailActivities {
 *   @ActivityMethod()
 *   async sendWelcomeEmail(to: string): Promise<boolean> {
 *     // Implementation
 *     return true;
 *   }
 *
 *   @ActivityMethod('processPayment')
 *   async processPayment(orderId: string, amount: number): Promise<string> {
 *     // Implementation
 *     return 'payment-id';
 *   }
 *
 *   @ActivityMethod({
 *     name: 'sendInvoice',
 *     timeout: '30s',
 *     maxRetries: 3
 *   })
 *   async sendInvoice(orderId: string): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export const ActivityMethod = (options?: string | ActivityMethodOptions): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        // Handle both string (name) and options object
        let methodName: string;
        let methodOptions: ActivityMethodOptions = {};

        if (typeof options === 'string') {
            methodName = options;
            methodOptions = { name: options };
        } else if (options && typeof options === 'object') {
            methodName = options.name || propertyKey.toString();
            methodOptions = options;
        } else {
            methodName = propertyKey.toString();
        }

        // Store metadata on the method
        Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD, true, descriptor.value);
        Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD_NAME, methodName, descriptor.value);

        if (Object.keys(methodOptions).length > 0) {
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD_OPTIONS,
                methodOptions,
                descriptor.value,
            );
        }

        // Set NestJS metadata for discovery
        SetMetadata(TEMPORAL_ACTIVITY_METHOD, true)(descriptor.value);
        SetMetadata(TEMPORAL_ACTIVITY_METHOD_NAME, methodName)(descriptor.value);

        if (Object.keys(methodOptions).length > 0) {
            SetMetadata(TEMPORAL_ACTIVITY_METHOD_OPTIONS, methodOptions)(descriptor.value);
        }

        return descriptor;
    };
};
