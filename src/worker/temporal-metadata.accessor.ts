/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Injectable } from '@nestjs/common';
import {
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_ACTIVITY_METHOD_NAME,
    TEMPORAL_ACTIVITY_METHOD_OPTIONS,
} from '../constants';

/**
 * Service for accessing Temporal-related metadata
 * Used for discovering and extracting metadata from decorated classes and methods
 */
@Injectable()
export class TemporalMetadataAccessor {
    /**
     * Check if target is marked as a Temporal Activity
     * @param target Class to check
     */
    isActivity(target: Function): boolean {
        if (!target) {
            return false;
        }
        return !!Reflect.getMetadata(TEMPORAL_ACTIVITY, target);
    }

    /**
     * Get activity options from a decorated class
     * @param target Class to check
     */
    getActivityOptions(target: Function): Record<string, any> | undefined {
        if (!target) {
            return undefined;
        }
        return Reflect.getMetadata(TEMPORAL_ACTIVITY, target);
    }

    /**
     * Check if target is marked as a Temporal Activity Method
     * @param target Method to check
     */
    isActivityMethod(target: Function): boolean {
        if (!target) {
            return false;
        }
        return !!Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target);
    }

    /**
     * Get the name of the Activity Method
     * @param target Method to check
     */
    getActivityMethodName(target: Function): string | undefined {
        if (!target) {
            return undefined;
        }
        return Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD_NAME, target);
    }

    /**
     * Get options for an Activity Method
     * @param target Method to check
     */
    getActivityMethodOptions(target: Function): Record<string, any> | undefined {
        if (!target) {
            return undefined;
        }
        return Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD_OPTIONS, target);
    }

    /**
     * Extract all activity methods from a class instance
     * Returns map of activity name to method
     * @param instance Class instance to examine
     */
    extractActivityMethods(instance: any): Map<string, Function> {
        if (!instance) {
            return new Map();
        }

        const methods = new Map<string, Function>();
        const prototype = Object.getPrototypeOf(instance);
        const methodNames = Object.getOwnPropertyNames(prototype).filter(
            (prop) => prop !== 'constructor',
        );

        for (const methodName of methodNames) {
            const method = prototype[methodName];
            if (this.isActivityMethod(method)) {
                const activityName = this.getActivityMethodName(method) || methodName;
                methods.set(activityName, method.bind(instance));
            }
        }

        return methods;
    }
}
