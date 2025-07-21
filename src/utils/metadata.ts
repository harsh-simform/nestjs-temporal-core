import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMethodOptions, ActivityOptions } from '../interfaces';

// ==========================================
// Activity Metadata Utilities
// ==========================================

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
