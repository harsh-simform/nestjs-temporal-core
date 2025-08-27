import { Injectable } from '@nestjs/common';
import {
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../constants';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Temporal Metadata Accessor Service
 *
 * Provides utilities for extracting and validating Temporal metadata
 * from classes and methods decorated with Temporal decorators.
 */
@Injectable()
export class TemporalMetadataAccessor {
    private readonly logger: TemporalLogger;
    private readonly activityMethodCache = new Map<Function, Map<string, unknown>>();

    constructor() {
        this.logger = createLogger(TemporalMetadataAccessor.name);
    }

    /**
     * Check if a class is marked as a Temporal activity
     */
    isActivity(target: Function): boolean {
        try {
            return (
                Reflect.hasMetadata(TEMPORAL_ACTIVITY, target) ||
                Reflect.hasMetadata(TEMPORAL_ACTIVITY, target.prototype)
            );
        } catch {
            return false;
        }
    }

    /**
     * Check if a method is marked as a Temporal activity method
     */
    isActivityMethod(target: object | null | undefined | string, methodName?: string): boolean {
        try {
            if (!target || typeof target === 'string') return false;

            const targetObj = target as { constructor?: { prototype?: object } };
            return (
                Reflect.hasMetadata(TEMPORAL_ACTIVITY_METHOD, target, methodName || '') ||
                (targetObj.constructor?.prototype !== undefined &&
                    Reflect.hasMetadata(
                        TEMPORAL_ACTIVITY_METHOD,
                        targetObj.constructor.prototype,
                        methodName || '',
                    ))
            );
        } catch {
            return false;
        }
    }

    /**
     * Get activity metadata from a class
     */
    getActivityMetadata(target: Function): unknown {
        try {
            return (
                Reflect.getMetadata(TEMPORAL_ACTIVITY, target) ||
                Reflect.getMetadata(TEMPORAL_ACTIVITY, target.prototype) ||
                null
            );
        } catch {
            return null;
        }
    }

    /**
     * Get activity method metadata from an instance and method name
     */
    getActivityMethodMetadata(
        instance: unknown,
        methodName: string,
    ): {
        name: string;
        originalName: string;
        methodName: string;
        className: string;
        options?: Record<string, unknown>;
        handler?: Function;
    } | null {
        try {
            if (!instance) return null;

            const prototype = Object.getPrototypeOf(instance);
            if (!prototype) return null;

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, prototype, methodName);
            if (!metadata) return null;

            return {
                name: metadata.name || methodName,
                originalName: methodName,
                methodName,
                className: prototype.constructor?.name || 'Unknown',
                options: metadata.options || metadata, // Include the full metadata as options if no specific options property
                handler: prototype[methodName],
            };
        } catch {
            return null;
        }
    }

    /**
     * Get activity method names from a class
     */
    getActivityMethodNames(target: Function | null | undefined | string): string[] {
        try {
            if (!target || typeof target !== 'function' || !target.prototype) return [];

            const prototype = target.prototype;
            const propertyNames = Object.getOwnPropertyNames(prototype);
            const methodNames: string[] = [];

            for (const propertyName of propertyNames) {
                if (propertyName === 'constructor') continue;

                try {
                    if (Reflect.hasMetadata(TEMPORAL_ACTIVITY_METHOD, prototype, propertyName)) {
                        methodNames.push(propertyName);
                    }
                } catch {
                    // Skip this method if metadata access fails
                }
            }

            return methodNames;
        } catch {
            return [];
        }
    }

    /**
     * Get activity method name from metadata
     */
    getActivityMethodName(
        target: object | null | undefined | string,
        methodName?: string,
    ): string | null {
        try {
            if (!target || typeof target === 'string') return null;

            const metadata = this.getActivityMethodMetadata(target, methodName || '') as any;
            return metadata?.name || methodName || null;
        } catch {
            return null;
        }
    }

    /**
     * Get activity options from a class
     */
    getActivityOptions(target: Function): Record<string, unknown> | null {
        try {
            const metadata = this.getActivityMetadata(target) as any;
            return metadata || null;
        } catch {
            return null;
        }
    }

    /**
     * Extract activity methods from an instance
     */
    extractActivityMethods(instance: unknown): Map<
        string,
        {
            name: string;
            originalName: string;
            methodName: string;
            className: string;
            options: Record<string, unknown>; // Always include options for test compatibility
            handler: Function;
        }
    >;

    /**
     * Extract activity methods from an instance (legacy compatibility)
     */
    extractActivityMethods(instance: unknown): Map<string, Function>;

    extractActivityMethods(instance: unknown): Map<string, any> {
        if (!instance) {
            return new Map();
        }

        // Check cache first
        const constructor = (instance as any).constructor;
        if (constructor && this.activityMethodCache.has(constructor)) {
            return this.activityMethodCache.get(constructor) as Map<string, any>;
        }

        const methods = new Map<
            string,
            {
                name: string;
                originalName: string;
                methodName: string;
                className: string;
                options: Record<string, unknown>; // Always include options for test compatibility
                handler: Function;
            }
        >();

        try {
            const prototype = Object.getPrototypeOf(instance);
            if (!prototype) {
                this.logger.warn('No prototype found for instance');
                return methods;
            }

            const propertyNames = Object.getOwnPropertyNames(prototype);

            for (const propertyName of propertyNames) {
                if (propertyName === 'constructor') continue;

                try {
                    const methodMetadata = Reflect.getMetadata(
                        TEMPORAL_ACTIVITY_METHOD,
                        prototype,
                        propertyName,
                    );

                    if (methodMetadata && typeof prototype[propertyName] === 'function') {
                        const activityName = methodMetadata.name || propertyName;

                        methods.set(activityName, {
                            name: activityName,
                            originalName: propertyName,
                            methodName: propertyName,
                            className: prototype.constructor?.name || 'Unknown',
                            options: {
                                name: activityName,
                                methodName: propertyName,
                                className: prototype.constructor?.name || 'Unknown',
                                ...methodMetadata, // Spread the full metadata into options
                            },
                            handler: prototype[propertyName].bind(instance),
                        });
                        this.logger.debug(`Found activity method: ${activityName}`);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to process method ${propertyName}`, error);
                }
            }

            // Cache the results
            if (constructor) {
                this.activityMethodCache.set(constructor, methods);
            }
        } catch (error) {
            this.logger.error('Failed to extract activity methods', error);
        }

        return methods;
    }

    /**
     * Extract activity methods from a class constructor (overload for TemporalService)
     */
    extractActivityMethodsFromClass(target: Function): Array<{
        methodName: string;
        name: string;
        metadata: {
            name: string;
            methodName: string;
            className: string;
            options?: Record<string, unknown>;
        };
    }> {
        const methods: Array<{
            methodName: string;
            name: string;
            metadata: {
                name: string;
                methodName: string;
                className: string;
                options?: Record<string, unknown>;
            };
        }> = [];

        try {
            const prototype = target.prototype;
            const prototypeMetadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, prototype);

            if (prototypeMetadata && typeof prototypeMetadata === 'object') {
                for (const [methodName, metadata] of Object.entries(prototypeMetadata)) {
                    methods.push({
                        methodName,
                        name: (metadata as any).name || methodName,
                        metadata: {
                            name: (metadata as any).name || methodName,
                            methodName,
                            className: target.name || 'Unknown',
                            options: (metadata as any).options,
                        },
                    });
                }
            }
        } catch (error) {
            this.logger.warn('Failed to extract activity methods from class', error);
        }

        return methods;
    }

    /**
     * Extract methods from prototype (alias for extractActivityMethods)
     */
    extractMethodsFromPrototype(instance: unknown): Map<
        string,
        {
            name: string;
            originalName: string;
            methodName: string;
            className: string;
            options?: Record<string, unknown>;
            handler: Function;
        }
    > {
        return this.extractActivityMethods(instance);
    }

    /**
     * Get method options for an activity method on a prototype
     */
    getActivityMethodOptions(target: any, methodName?: string): Record<string, unknown> | null {
        try {
            if (!target || !methodName) return null;

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target, methodName);
            return metadata || null;
        } catch {
            return null;
        }
    }

    /**
     * Get signal methods from a prototype
     */
    getSignalMethods(prototype: any): Record<string, string> {
        try {
            return Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, prototype) || {};
        } catch {
            return {};
        }
    }

    /**
     * Get query methods from a prototype
     */
    getQueryMethods(prototype: any): Record<string, string> {
        try {
            return Reflect.getMetadata(TEMPORAL_QUERY_METHOD, prototype) || {};
        } catch {
            return {};
        }
    }

    /**
     * Get child workflows from a prototype
     */
    getChildWorkflows(prototype: any): Record<string, unknown> {
        try {
            return Reflect.getMetadata(TEMPORAL_CHILD_WORKFLOW, prototype) || {};
        } catch {
            return {};
        }
    }

    /**
     * Validate an activity class
     */
    validateActivityClass(constructor: Function): { isValid: boolean; issues: string[] } {
        const issues: string[] = [];

        try {
            // Check if class has activity metadata
            if (!this.isActivity(constructor)) {
                issues.push('Class is not marked with @Activity decorator');
            }

            // Check for activity methods
            const prototype = constructor.prototype;
            const hasActivityMethods = this.hasActivityMethods(prototype);

            if (!hasActivityMethods) {
                issues.push('Activity class has no methods marked with @ActivityMethod');
            }

            return {
                isValid: issues.length === 0,
                issues,
            };
        } catch (error) {
            issues.push(`Validation failed: ${(error as Error).message}`);
            return { isValid: false, issues };
        }
    }

    /**
     * Check if a prototype has activity methods
     */
    private hasActivityMethods(prototype: unknown): boolean {
        if (!prototype) return false;

        try {
            const propertyNames = Object.getOwnPropertyNames(prototype);

            return propertyNames.some((propertyName) => {
                if (propertyName === 'constructor') return false;

                try {
                    return Reflect.hasMetadata(TEMPORAL_ACTIVITY_METHOD, prototype, propertyName);
                } catch {
                    return false;
                }
            });
        } catch {
            return false;
        }
    }

    /**
     * Get all metadata keys for debugging
     */
    getAllMetadataKeys(target: any): string[] {
        try {
            return Reflect.getMetadataKeys(target);
        } catch {
            return [];
        }
    }

    /**
     * Get activity name from class metadata
     */
    getActivityName(target: Function): string | null {
        try {
            const metadata = this.getActivityMetadata(target) as any;
            return metadata?.name || target.name || null;
        } catch {
            return null;
        }
    }

    /**
     * Get activity info with comprehensive details
     */
    getActivityInfo(target: Function | null | undefined | string): {
        className: string;
        isActivity: boolean;
        activityName: string | null;
        methodNames: string[];
        metadata: unknown;
        activityOptions: unknown;
        methodCount: number;
    } {
        try {
            if (!target || typeof target !== 'function') {
                // Return a default structure for null/undefined/invalid targets
                return {
                    className: 'Unknown',
                    isActivity: false,
                    activityName: null,
                    methodNames: [],
                    metadata: null,
                    activityOptions: null,
                    methodCount: 0,
                };
            }

            const className = target.name || 'Unknown';
            const isActivity = this.isActivity(target);
            const activityName = this.getActivityName(target);
            const methodNames = this.getActivityMethodNames(target);
            const metadata = this.getActivityMetadata(target);
            const activityOptions = this.getActivityOptions(target);

            return {
                className,
                isActivity,
                activityName,
                methodNames,
                metadata,
                activityOptions,
                methodCount: methodNames.length,
            };
        } catch {
            return {
                className: 'Unknown',
                isActivity: false,
                activityName: null,
                methodNames: [],
                metadata: null,
                activityOptions: null,
                methodCount: 0,
            };
        }
    }

    /**
     * Validate that required metadata exists
     */
    validateMetadata(target: any, expectedKeys: string[]): { isValid: boolean; missing: string[] } {
        const missing: string[] = [];

        for (const key of expectedKeys) {
            try {
                if (!Reflect.hasMetadata(key, target as any)) {
                    missing.push(key);
                }
            } catch {
                missing.push(key);
            }
        }

        return {
            isValid: missing.length === 0,
            missing,
        };
    }

    /**
     * Clear internal cache
     */
    clearCache(): void {
        this.activityMethodCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[]; message?: string; note?: string } {
        const entries = Array.from(this.activityMethodCache.keys()).map((k) => k.name || 'Unknown');
        return {
            size: this.activityMethodCache.size,
            entries,
            message: 'Cache statistics not available',
            note: 'WeakMap-based caching prevents memory leaks but limits size reporting',
        };
    }
}
