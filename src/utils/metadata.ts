import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMethodOptions, ActivityOptions, LocalActivityOptions } from '../interfaces';

/**
 * Checks if a class is marked as a Temporal Activity.
 *
 * @param target - The class to check
 * @returns True if the class has activity metadata
 *
 * @example
 * ```typescript
 * @Activity()
 * class MyActivity {}
 *
 * console.log(isActivity(MyActivity)); // true
 * ```
 */
export function isActivity(target: object): boolean {
    if (!target) return false;
    return Reflect.hasMetadata(TEMPORAL_ACTIVITY, target);
}

/**
 * Retrieves activity metadata from a class.
 *
 * @param target - The class to get metadata from
 * @returns Activity options or undefined if not found
 *
 * @example
 * ```typescript
 * @Activity({ taskQueue: 'my-queue' })
 * class MyActivity {}
 *
 * const metadata = getActivityMetadata(MyActivity);
 * console.log(metadata.taskQueue); // 'my-queue'
 * ```
 */
export function getActivityMetadata(target: object): ActivityOptions | undefined {
    if (!target) return undefined;
    return Reflect.getMetadata(TEMPORAL_ACTIVITY, target);
}

/**
 * Checks if a method is marked as a Temporal Activity method.
 *
 * @param target - The method to check
 * @returns True if the method has activity method metadata
 */
export function isActivityMethod(target: object): boolean {
    if (!target) return false;
    return Reflect.hasMetadata(TEMPORAL_ACTIVITY_METHOD, target);
}

/**
 * Retrieves activity method metadata from a method.
 *
 * @param target - The method to get metadata from
 * @returns Activity method options or undefined if not found
 */
export function getActivityMethodMetadata(target: object): ActivityMethodOptions | undefined {
    if (!target) return undefined;
    return Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target);
}

/**
 * Checks whether an `@ActivityMethod` was marked `local: true` for
 * `proxyLocalActivities()` use. Sandbox-safe (no NestJS/DI imports) - reads
 * the same collection metadata written on the class prototype by
 * `@ActivityMethod`, so it's safe to call from a workflow file at
 * module-load time.
 *
 * @param target - The activity class
 * @param methodName - The activity method name
 *
 * @example
 * ```typescript
 * @Activity()
 * class MyActivity {
 *   @ActivityMethod({ local: true })
 *   quickLookup() {}
 * }
 *
 * console.log(isLocalActivity(MyActivity, 'quickLookup')); // true
 * ```
 */
export function isLocalActivity(target: Function, methodName: string): boolean {
    if (!target || !methodName) return false;
    const activityMethods = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target.prototype);
    return Boolean(activityMethods?.[methodName]?.local);
}

/**
 * Retrieves the `localActivityOptions` recorded on an `@ActivityMethod`.
 * Sandbox-safe (no NestJS/DI imports).
 *
 * @param target - The activity class
 * @param methodName - The activity method name
 * @returns The recorded options, or undefined if not found
 */
export function getLocalActivityOptions(
    target: Function,
    methodName: string,
): Partial<LocalActivityOptions> | undefined {
    if (!target || !methodName) return undefined;
    const activityMethods = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target.prototype);
    return activityMethods?.[methodName]?.localActivityOptions;
}
