import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_ACTIVITY } from '../constants';
import { ActivityOptions } from '../interfaces/activity.interface';

/**
 * Decorator that marks a class as a Temporal Activity
 *
 * Activities are the basic unit of work in Temporal. They can be retried independently
 * from the Workflow and are executed outside of the Workflow context.
 *
 * @param options Optional activity configuration
 *
 * @example
 * ```typescript
 * @Activity()
 * export class EmailActivities {
 *   // Activity methods go here
 * }
 *
 * @Activity({ name: 'PaymentActivities' })
 * export class PaymentService {
 *   // Activity methods go here
 * }
 * ```
 */
export const Activity = (options: ActivityOptions = {}): ClassDecorator => {
    return (target: any) => {
        Reflect.defineMetadata(TEMPORAL_ACTIVITY, { ...options }, target);
        SetMetadata(TEMPORAL_ACTIVITY, { ...options })(target);
        return target;
    };
};
