import { Inject, Injectable, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TemporalMetadataAccessor } from './temporal-metadata.service';
import {
    ActivityModuleOptions,
    ActivityInfo,
    ActivityMethodHandler,
    ActivityMethodOptions,
} from '../interfaces';
import { ACTIVITY_MODULE_OPTIONS } from '../constants';
import { createLogger, TemporalLogger } from '../utils/logger';

/**
 * Manages activity discovery and registration in a Temporal NestJS application.
 *
 * This service automatically discovers classes decorated with @Activity and their methods
 * decorated with @ActivityMethod, validates them, and provides access to activity metadata
 * and handlers for worker registration.
 *
 * Key features:
 * - Automatic activity discovery using NestJS discovery service
 * - Activity class and method validation
 * - Handler extraction and binding
 * - Configuration validation and health checking
 * - Comprehensive statistics and monitoring
 * - Caching for performance optimization
 *
 * @example
 * ```typescript
 * // Get all discovered activities
 * const activities = activityService.getDiscoveredActivities();
 *
 * // Get activity handlers for worker registration
 * const handlers = activityService.getActivityHandlers();
 *
 * // Check activity health
 * const health = activityService.getHealthStatus();
 * ```
 */
@Injectable()
export class TemporalActivityService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private readonly discoveredActivities = new Map<string, ActivityInfo>();
    private readonly activityHandlers = new Map<string, ActivityMethodHandler>();

    constructor(
        @Inject(ACTIVITY_MODULE_OPTIONS)
        private readonly options: ActivityModuleOptions,
        private readonly discoveryService: DiscoveryService,
        private readonly metadataAccessor: TemporalMetadataAccessor,
    ) {
        this.logger = createLogger(TemporalActivityService.name);
    }

    /**
     * Initializes the activity service during module initialization.
     * Discovers all activities and logs a summary of findings.
     */
    async onModuleInit() {
        await this.discoverActivities();
        this.logActivitySummary();
    }

    /**
     * Discovers and registers all activity classes and methods in the application.
     * Scans all providers for classes decorated with @Activity and processes them.
     * Handles discovery errors gracefully and logs progress.
     */
    private async discoverActivities(): Promise<void> {
        const providers = this.discoveryService.getProviders();
        let discoveredCount = 0;
        for (const wrapper of providers) {
            const { instance, metatype } = wrapper;
            const targetClass = instance?.constructor || metatype;
            if (!targetClass || !instance) continue;
            if (!this.metadataAccessor.isActivity(targetClass)) continue;
            if (
                this.options.activityClasses?.length &&
                !this.options.activityClasses.includes(targetClass)
            )
                continue;
            try {
                const activityInfo = await this.processActivityClass(instance, targetClass);
                if (activityInfo) {
                    this.discoveredActivities.set(targetClass.name, activityInfo);
                    discoveredCount++;
                }
            } catch (error) {
                this.logger.error(
                    `Failed to process activity class ${targetClass.name}:`,
                    error.stack,
                );
            }
        }
        this.logger.log(`Discovered ${discoveredCount} activity classes`);
    }

    /**
     * Processes a single activity class, validates it, and registers its methods.
     *
     * @param instance - The activity class instance
     * @param targetClass - The activity class constructor
     * @returns Activity information or null if processing fails
     */
    private async processActivityClass(
        instance: object,
        targetClass: unknown,
    ): Promise<ActivityInfo | null> {
        const className = (targetClass as { name: string }).name;
        this.logger.debug(`Processing activity class: ${className}`);
        const validation = this.metadataAccessor.validateActivityClass(targetClass);
        if (!validation.isValid) {
            this.logger.warn(
                `Activity class ${className} has validation issues: ${validation.issues.join(', ')}`,
            );
            return null;
        }
        const activityMethods = this.metadataAccessor.extractActivityMethods(instance);
        const methodInfos: Array<{
            name: string;
            methodName: string;
            options: ActivityMethodOptions;
        }> = [];
        for (const [activityName, handler] of activityMethods.entries()) {
            // Check for duplicate activity names
            if (this.activityHandlers.has(activityName)) {
                this.logger.warn(`Duplicate activity name found: ${activityName}`);
            }
            this.activityHandlers.set(activityName, handler as ActivityMethodHandler);
            const methodName = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).find(
                (name) => (instance as Record<string, unknown>)[name] === handler,
            );
            if (methodName) {
                const method = Object.getPrototypeOf(instance)[methodName];
                methodInfos.push({
                    name: activityName,
                    methodName,
                    options: this.metadataAccessor.getActivityMethodOptions(
                        method,
                    ) as ActivityMethodOptions,
                });
            }
            this.logger.debug(`Registered activity: ${className}.${activityName}`);
        }
        return {
            className,
            instance,
            targetClass: targetClass as Type<unknown>,
            methods: methodInfos,
            totalMethods: methodInfos.length,
        };
    }

    /**
     * Returns all discovered activity metadata.
     *
     * @returns Array of activity information objects
     */
    getDiscoveredActivities(): ActivityInfo[] {
        return Array.from(this.discoveredActivities.values());
    }

    /**
     * Returns activity metadata by class name.
     *
     * @param className - The name of the activity class
     * @returns Activity information or undefined if not found
     */
    getActivityByClassName(className: string): ActivityInfo | undefined {
        return this.discoveredActivities.get(className);
    }

    /**
     * Returns all registered activity handlers for worker registration.
     *
     * @returns Object mapping activity names to their handler functions
     */
    getActivityHandlers(): Record<string, ActivityMethodHandler> {
        return Object.fromEntries(this.activityHandlers.entries());
    }

    /**
     * Returns a specific activity handler by name.
     *
     * @param activityName - The name of the activity
     * @returns Activity handler function or undefined if not found
     */
    getActivityHandler(activityName: string): ActivityMethodHandler | undefined {
        return this.activityHandlers.get(activityName);
    }

    /**
     * Returns all registered activity names.
     *
     * @returns Array of activity names
     */
    getActivityNames(): string[] {
        return Array.from(this.activityHandlers.keys());
    }

    /**
     * Checks if an activity is registered by name.
     *
     * @param activityName - The name of the activity to check
     * @returns True if the activity is registered
     */
    hasActivity(activityName: string): boolean {
        return this.activityHandlers.has(activityName);
    }

    /**
     * Returns statistics about discovered activities.
     *
     * @returns Object containing activity statistics
     */
    getActivityStats(): {
        totalClasses: number;
        totalMethods: number;
        classNames: string[];
        methodNames: string[];
    } {
        const activities = this.getDiscoveredActivities();
        const totalMethods = this.activityHandlers.size; // Use actual registered handlers count
        return {
            totalClasses: activities.length,
            totalMethods,
            classNames: activities.map((a) => a.className),
            methodNames: this.getActivityNames(),
        };
    }

    /**
     * Validates the activity configuration and returns issues and warnings.
     * Checks for duplicate activity names and missing specified classes.
     *
     * @returns Validation result with issues and warnings
     */
    validateConfiguration(): {
        isValid: boolean;
        issues: string[];
        warnings: string[];
    } {
        const issues: string[] = [];
        const warnings: string[] = [];
        if (this.discoveredActivities.size === 0) {
            warnings.push(
                'No activities were discovered. Make sure classes are decorated with @Activity()',
            );
        }

        // Check for duplicate activity names by tracking registration
        const registeredNames = new Set<string>();
        const duplicates = new Set<string>();
        for (const activity of this.getDiscoveredActivities()) {
            for (const method of activity.methods) {
                if (registeredNames.has(method.name)) {
                    duplicates.add(method.name);
                } else {
                    registeredNames.add(method.name);
                }
            }
        }

        if (duplicates.size > 0) {
            issues.push(`Duplicate activity names found: ${Array.from(duplicates).join(', ')}`);
        }

        if (this.options.activityClasses?.length) {
            const foundClasses = this.getDiscoveredActivities().map((a) => a.targetClass);
            const missingClasses = this.options.activityClasses.filter(
                (cls: import('@nestjs/common').Type<unknown>) => !foundClasses.includes(cls),
            );
            if (missingClasses.length > 0) {
                warnings.push(
                    `Some specified activity classes were not found: ${missingClasses.map((c: { name: string }) => c.name).join(', ')}`,
                );
            }
        }
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
        };
    }

    /**
     * Returns health status for activities including validation results.
     * Categorizes health based on validation issues and activity registration.
     *
     * @returns Health status object with detailed information
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        activities: {
            total: number;
            registered: number;
        };
        validation: {
            isValid: boolean;
            issues: string[];
            warnings: string[];
        };
    } {
        const stats = this.getActivityStats();
        const validation = this.validateConfiguration();
        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (!validation.isValid) {
            status = 'unhealthy';
        } else if (validation.warnings.length > 0 || stats.totalMethods === 0) {
            status = 'degraded';
        } else {
            status = 'healthy';
        }
        return {
            status,
            activities: {
                total: stats.totalClasses,
                registered: stats.totalMethods,
            },
            validation,
        };
    }

    /**
     * Logs a comprehensive summary of activity discovery results.
     * Includes statistics, validation results, and any issues found.
     */
    private logActivitySummary(): void {
        const stats = this.getActivityStats();
        const validation = this.validateConfiguration();
        this.logger.log(
            `Activity discovery completed: ${stats.totalClasses} classes, ${stats.totalMethods} methods`,
        );
        if (stats.totalClasses > 0) {
            this.logger.debug(`Activity classes: ${stats.classNames.join(', ')}`);
        }
        if (stats.totalMethods > 0) {
            this.logger.debug(`Activity methods: ${stats.methodNames.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            validation.warnings.forEach((warning) => this.logger.warn(warning));
        }
        if (validation.issues.length > 0) {
            validation.issues.forEach((issue) => this.logger.error(issue));
        }
    }
}
