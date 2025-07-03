import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMethodOptions, ActivityOptions } from '../interfaces';

/**
 * Activity decorator for marking classes as Temporal activities
 *
 * @param options Activity configuration options
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
            methodOptions = { name: nameOrOptions };
        } else if (nameOrOptions?.name) {
            activityName = nameOrOptions.name;
            methodOptions = nameOrOptions;
        } else {
            activityName = propertyKey.toString();
            methodOptions = { name: activityName };
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
 * Utility function to check if a class is marked as an Activity
 */
export function isActivity(target: object): boolean {
    return Reflect.hasMetadata(TEMPORAL_ACTIVITY, target);
}

/**
 * Utility function to get activity metadata from a class
 */
export function getActivityMetadata(target: object): ActivityOptions | undefined {
    return Reflect.getMetadata(TEMPORAL_ACTIVITY, target);
}

/**
 * Utility function to check if a method is marked as an Activity method
 */
export function isActivityMethod(target: object): boolean {
    return Reflect.hasMetadata(TEMPORAL_ACTIVITY_METHOD, target);
}

/**
 * Utility function to get activity method metadata from a method
 */
export function getActivityMethodMetadata(target: object): ActivityMethodOptions | undefined {
    return Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target);
}
