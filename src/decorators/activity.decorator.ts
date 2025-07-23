import { SetMetadata, Type } from '@nestjs/common';
import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMethodOptions, ActivityOptions } from '../interfaces';
import { proxyActivities } from '@temporalio/workflow';

/**
 * Activity decorator for marking classes as Temporal activities
 *
 * @param options Activity configuration options
 *
 * @example
 * ```typescript
 * @Activity({ name: 'email-activities' })
 * export class EmailActivities {
 *   @ActivityMethod('sendEmail')
 *   async sendEmail(to: string, subject: string, body: string): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export const Activity = (options?: ActivityOptions): ClassDecorator => {
    return (target: unknown) => {
        const metadata = {
            ...options,
            className: (target as { name: string }).name,
        };

        SetMetadata(TEMPORAL_ACTIVITY, metadata)(target as Function);
        Reflect.defineMetadata(TEMPORAL_ACTIVITY, metadata, target as object);

        return target as never;
    };
};

/**
 * Activity method decorator for marking methods as Temporal activity methods
 *
 * @param nameOrOptions Activity name or configuration options
 *
 * @example
 * ```typescript
 * // Using method name as activity name
 * @ActivityMethod()
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 *
 * // Using custom activity name
 * @ActivityMethod('process-order')
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 *
 * // Using options object
 * @ActivityMethod({
 *   name: 'process-order',
 *   timeout: '5m',
 *   maxRetries: 3
 * })
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 * ```
 */
export const ActivityMethod = (nameOrOptions?: string | ActivityMethodOptions): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor?: PropertyDescriptor,
    ): PropertyDescriptor | void => {
        let activityName: string;
        let methodOptions: ActivityMethodOptions = {};

        if (typeof nameOrOptions === 'string') {
            activityName = nameOrOptions;
            methodOptions = { name: activityName };
        } else if (
            nameOrOptions &&
            typeof nameOrOptions.name === 'string' &&
            nameOrOptions.name.trim().length > 0
        ) {
            activityName = nameOrOptions.name;
            methodOptions = { ...nameOrOptions };
        } else if (nameOrOptions && nameOrOptions.name === '') {
            // Handle explicit empty name - should throw error
            activityName = '';
            methodOptions = { ...nameOrOptions };
        } else if (nameOrOptions && !nameOrOptions.name) {
            // Handle options object without name property
            activityName = propertyKey.toString();
            methodOptions = { name: activityName, ...nameOrOptions };
        } else {
            activityName = propertyKey.toString();
            methodOptions = { name: activityName };
        }

        // Validate activity name
        if (!activityName || activityName.trim().length === 0) {
            throw new Error('Activity name cannot be empty');
        }

        const metadata = {
            name: activityName,
            methodName: propertyKey.toString(),
            ...methodOptions,
        };

        if (descriptor?.value) {
            SetMetadata(TEMPORAL_ACTIVITY_METHOD, metadata)(descriptor.value as Function);
            Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD, metadata, descriptor.value as object);
            return descriptor;
        } else {
            // Handle property-style decorators
            Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD, metadata, target, propertyKey);
        }
    };
};

/**
 * Property decorator to inject a Temporal activity proxy into a workflow class.
 *
 * This decorator allows you to call activities from within a workflow by injecting
 * a type-safe proxy for the specified activity class. The proxy will use the provided
 * options (timeouts, retry policies, etc.) or sensible defaults if not specified.
 *
 * @param activityType The activity class to inject as a proxy
 * @param options Optional proxy options (timeouts, retry policies, etc.)
 *
 * @example
 * ```typescript
 * import { InjectActivity } from '@nestjs-temporal/core';
 * import { EmailActivities } from './email.activities';
 *
 * @Workflow()
 * export class UserWorkflow {
 *   @InjectActivity(EmailActivities, { startToCloseTimeout: '2m' })
 *   private readonly email!: EmailActivities;
 *
 *   @WorkflowRun()
 *   async execute(userId: string) {
 *     await this.email.sendWelcomeEmail(userId);
 *   }
 * }
 * ```
 *
 * @remarks
 * - The injected property will be a proxy that calls the actual activity implementation.
 * - At least one timeout (startToCloseTimeout or scheduleToCloseTimeout) must be provided; a default is used if omitted.
 * - This decorator is only valid inside workflow classes.
 *
 * @see {@link Activity} for marking activity classes
 * @see {@link ActivityMethod} for marking activity methods
 */
export function InjectActivity<T>(
    activityType: Type<T>,
    options?: Record<string, unknown>,
): PropertyDecorator {
    return (target: Object, propertyKey: string | symbol) => {
        // Ensure required timeout is present
        const safeOptions = (() => {
            const opts = options ? { ...options } : {};
            if (!('scheduleToCloseTimeout' in opts) && !('startToCloseTimeout' in opts)) {
                opts.startToCloseTimeout =
                    typeof require !== 'undefined'
                        ? require('../constants').TIMEOUTS.ACTIVITY_SHORT
                        : '1m';
            }
            return opts;
        })();
        // Use globalThis.proxyActivities if available (for test mocks), otherwise use imported proxyActivities
        let proxyActivitiesFn: typeof proxyActivities;
        if (
            typeof globalThis !== 'undefined' &&
            (globalThis as unknown as { proxyActivities?: typeof proxyActivities }).proxyActivities
        ) {
            proxyActivitiesFn = (
                globalThis as unknown as { proxyActivities: typeof proxyActivities }
            ).proxyActivities;
        } else if (proxyActivities) {
            proxyActivitiesFn = proxyActivities;
        } else {
            throw new Error('proxyActivities is not available');
        }
        const proxy = proxyActivitiesFn(safeOptions);
        Object.defineProperty(target, propertyKey, {
            value: proxy,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    };
}

// Re-export InjectWorkflowClient from workflow decorator for compatibility
export { InjectWorkflowClient } from './workflow.decorator';
