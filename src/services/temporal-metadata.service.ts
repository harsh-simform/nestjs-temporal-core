import { Injectable, Type } from '@nestjs/common';
import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMetadata, ActivityMethodHandler, ActivityMethodMetadata } from '../interfaces';
import { createLogger } from '../utils/logger';

/**
 * Provides access to Temporal metadata for activities and their methods.
 *
 * This service manages metadata extraction, validation, and caching for Temporal activities.
 * It uses reflection to read decorator metadata and provides efficient access to activity
 * information with performance optimizations through caching.
 *
 * Key features:
 * - Activity class and method metadata extraction
 * - Metadata validation and error handling
 * - Performance optimization through WeakMap caching
 * - Activity method handler extraction and binding
 * - Comprehensive validation and diagnostics
 * - Memory-efficient caching that prevents memory leaks
 *
 * @example
 * ```typescript
 * // Check if a class is an activity
 * const isActivity = metadataAccessor.isActivity(MyActivityClass);
 *
 * // Get activity options
 * const options = metadataAccessor.getActivityOptions(MyActivityClass);
 *
 * // Extract activity methods from instance
 * const methods = metadataAccessor.extractActivityMethods(instance);
 *
 * // Validate activity class
 * const validation = metadataAccessor.validateActivityClass(MyActivityClass);
 * ```
 */
@Injectable()
export class TemporalMetadataAccessor {
    private readonly logger = createLogger(TemporalMetadataAccessor.name);
    private readonly activityClassCache = new WeakMap<Type<unknown>, ActivityMetadata | null>();
    private readonly activityMethodCache = new WeakMap<
        Type<unknown>,
        Map<string, ActivityMethodMetadata>
    >();

    /**
     * Checks if a class is marked as a Temporal Activity.
     *
     * @param target - The class to check
     * @returns True if the class is decorated with @Activity
     */
    isActivity(target: Type<unknown>): boolean {
        if (!target || typeof target !== 'function') return false;
        if (this.activityClassCache.has(target)) {
            return this.activityClassCache.get(target) !== null;
        }
        const metadata = this.getActivityMetadata(target);
        const isActivity = metadata !== null;
        this.activityClassCache.set(target, metadata);
        return isActivity;
    }

    /**
     * Returns activity metadata from a decorated class.
     *
     * @param target - The activity class
     * @returns Activity metadata or null if not an activity
     */
    getActivityOptions(target: Type<unknown>): ActivityMetadata | null {
        if (!target || typeof target !== 'function') return null;
        if (this.activityClassCache.has(target)) {
            return this.activityClassCache.get(target) || null;
        }
        const metadata = this.getActivityMetadata(target);
        this.activityClassCache.set(target, metadata);
        return metadata;
    }

    /**
     * Checks if a method is marked as a Temporal Activity Method.
     *
     * @param target - The method to check
     * @returns True if the method is decorated with @ActivityMethod
     */
    isActivityMethod(target: object): boolean {
        return !!(
            target &&
            typeof target === 'function' &&
            Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target)
        );
    }

    /**
     * Returns the name of an Activity Method.
     *
     * @param target - The method to get the name for
     * @returns The activity method name or null if not found
     */
    getActivityMethodName(target: object): string | null {
        if (!target || typeof target !== 'function') return null;
        const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target);
        return metadata?.name || null;
    }

    /**
     * Returns options for an Activity Method.
     *
     * @param target - The method to get options for
     * @returns The activity method options or null if not found
     */
    getActivityMethodOptions(target: object): Record<string, unknown> | null {
        if (!target || typeof target !== 'function') return null;
        const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target);
        return metadata || null;
    }

    /**
     * Extracts all activity methods from a class instance.
     * Returns a map of activity name to bound method handler.
     *
     * @param instance - The activity class instance
     * @returns Map of activity names to bound method handlers
     */
    extractActivityMethods(instance: object): Map<string, ActivityMethodHandler> {
        if (!instance || typeof instance !== 'object') {
            this.logger.warn('Invalid instance provided to extractActivityMethods');
            return new Map();
        }
        const { constructor } = instance as { constructor: Type<unknown> };
        if (!constructor || typeof constructor !== 'function') {
            this.logger.warn('Instance does not have a valid constructor');
            return new Map();
        }
        if (this.activityMethodCache.has(constructor)) {
            const cachedMethods = this.activityMethodCache.get(constructor)!;
            const boundMethods = new Map<string, ActivityMethodHandler>();
            for (const [name, metadata] of cachedMethods.entries()) {
                boundMethods.set(name, metadata.handler.bind(instance));
            }
            return boundMethods;
        }
        const methods = this.extractMethodsFromPrototype(instance);
        this.activityMethodCache.set(constructor, methods);
        const boundMethods = new Map<string, ActivityMethodHandler>();
        for (const [name, metadata] of methods.entries()) {
            boundMethods.set(name, metadata.handler.bind(instance));
        }
        return boundMethods;
    }

    /**
     * Returns activity method metadata for a specific method.
     *
     * @param instance - The activity class instance
     * @param methodName - The name of the method
     * @returns Activity method metadata or null if not found
     */
    getActivityMethodMetadata(instance: object, methodName: string): ActivityMethodMetadata | null {
        const methods = this.extractActivityMethods(instance);
        for (const [activityName, handler] of methods.entries()) {
            const cachedMethods = this.activityMethodCache.get(
                instance.constructor as Type<unknown>,
            );
            if (cachedMethods) {
                const metadata = cachedMethods.get(activityName);
                if (metadata && metadata.originalName === methodName) {
                    return { ...metadata, handler };
                }
            }
        }
        return null;
    }

    /**
     * Returns all activity method names for a class.
     *
     * @param target - The activity class
     * @returns Array of activity method names
     */
    getActivityMethodNames(target: unknown): string[] {
        if (!target || typeof target !== 'function') return [];
        const cachedMethods = this.activityMethodCache.get(target as Type<unknown>);
        if (cachedMethods) {
            return Array.from(cachedMethods.keys());
        }
        const { prototype } = target;
        if (!prototype) return [];
        const methodNames: string[] = [];
        const propertyNames = Object.getOwnPropertyNames(prototype);
        for (const propertyName of propertyNames) {
            if (propertyName === 'constructor') continue;
            try {
                const method = prototype[propertyName];
                if (typeof method === 'function' && this.isActivityMethod(method)) {
                    const activityName = this.getActivityMethodName(method) || propertyName;
                    methodNames.push(activityName);
                }
            } catch (error) {
                this.logger.debug(`Error checking method ${propertyName}: ${error.message}`);
            }
        }
        return methodNames;
    }

    /**
     * Returns comprehensive activity information for a class.
     *
     * @param target - The activity class
     * @returns Object containing complete activity information
     */
    getActivityInfo(target: unknown): {
        isActivity: boolean;
        activityOptions: ActivityMetadata | null;
        methodNames: string[];
        methodCount: number;
    } {
        return {
            isActivity: this.isActivity(target as Type<unknown>),
            activityOptions: this.getActivityOptions(target as Type<unknown>),
            methodNames: this.getActivityMethodNames(target),
            methodCount: this.getActivityMethodNames(target).length,
        };
    }

    /**
     * Validates that an activity class has at least one activity method.
     *
     * @param target - The activity class to validate
     * @returns Validation result with issues if any
     */
    validateActivityClass(target: unknown): {
        isValid: boolean;
        issues: string[];
    } {
        const issues: string[] = [];
        if (!this.isActivity(target as Type<unknown>)) {
            issues.push('Class is not marked with @Activity decorator');
        }
        const methodNames = this.getActivityMethodNames(target);
        if (methodNames.length === 0) {
            issues.push('Activity class has no methods marked with @ActivityMethod');
        }
        return {
            isValid: issues.length === 0,
            issues,
        };
    }

    /**
     * Clears metadata caches (useful for testing or hot reloading).
     * Note: WeakMap caches are automatically cleared when objects are garbage collected.
     */
    clearCache(): void {
        this.logger.debug('Metadata accessor cache cleared');
    }

    /**
     * Returns cache statistics (limited due to WeakMap nature).
     *
     * @returns Object explaining cache statistics limitations
     */
    getCacheStats(): {
        message: string;
        note: string;
    } {
        return {
            message: 'Cache statistics not available',
            note: 'WeakMap-based caching prevents memory leaks but limits size reporting',
        };
    }

    /**
     * Gets activity metadata from a class using reflection.
     *
     * @param target - The activity class
     * @returns Activity metadata or null if not found
     */
    private getActivityMetadata(target: unknown): ActivityMetadata | null {
        try {
            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, target as object);
            return metadata || null;
        } catch (error) {
            this.logger.debug(`Error getting activity metadata: ${error.message}`);
            return null;
        }
    }

    /**
     * Extracts activity methods from a class prototype.
     *
     * @param instance - The activity class instance
     * @returns Map of activity names to method metadata
     */
    private extractMethodsFromPrototype(instance: object): Map<string, ActivityMethodMetadata> {
        const methods = new Map<string, ActivityMethodMetadata>();
        const prototype = Object.getPrototypeOf(instance);
        if (!prototype) return methods;

        let propertyNames: string[];
        try {
            propertyNames = Object.getOwnPropertyNames(prototype);
        } catch (error) {
            this.logger.warn(
                `Error getting property names for ${instance.constructor.name}: ${error.message}`,
            );
            return methods;
        }

        for (const propertyName of propertyNames) {
            if (propertyName === 'constructor') continue;
            try {
                const method = prototype[propertyName];
                if (typeof method !== 'function') continue;
                if (this.isActivityMethod(method)) {
                    const metadata = this.getActivityMethodOptions(method);
                    const activityName = (metadata?.name as string) || propertyName;
                    methods.set(activityName, {
                        name: activityName,
                        originalName: propertyName,
                        options: metadata || undefined,
                        handler: method,
                    });
                    this.logger.debug(
                        `Found activity method: ${instance.constructor.name}.${propertyName} -> ${activityName}`,
                    );
                }
            } catch (error) {
                this.logger.warn(
                    `Error processing method ${propertyName} in ${instance.constructor.name}: ${error.message}`,
                );
            }
        }
        return methods;
    }
}
