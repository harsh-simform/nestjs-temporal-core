import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TemporalMetadataAccessor } from '../worker/temporal-metadata.accessor';
import { ActivityModuleOptions, ActivityInfo, ActivityMethodHandler } from '../interfaces';
import { ACTIVITY_MODULE_OPTIONS } from '../constants';
import { TemporalLogger } from '../utils/logger';

/**
 * Temporal Activity Service
 * Manages activity discovery, registration, and metadata
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
        this.logger = new TemporalLogger(TemporalActivityService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    async onModuleInit() {
        await this.discoverActivities();
        this.logActivitySummary();
    }

    // ==========================================
    // Activity Discovery
    // ==========================================

    /**
     * Discover all activities in the application
     */
    private async discoverActivities(): Promise<void> {
        const providers = this.discoveryService.getProviders();
        let discoveredCount = 0;

        for (const wrapper of providers) {
            const { instance, metatype } = wrapper;
            const targetClass = instance?.constructor || metatype;

            if (!targetClass || !instance) continue;

            // Check if it's an activity class
            if (!this.metadataAccessor.isActivity(targetClass)) continue;

            // Filter by specific activity classes if provided
            if (this.options.activityClasses?.length) {
                if (!this.options.activityClasses.includes(targetClass)) continue;
            }

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
     * Process a single activity class
     */
    private async processActivityClass(
        instance: any,
        targetClass: any,
    ): Promise<ActivityInfo | null> {
        const className = targetClass.name;
        this.logger.debug(`Processing activity class: ${className}`);

        // Validate the activity class
        const validation = this.metadataAccessor.validateActivityClass(targetClass);
        if (!validation.isValid) {
            this.logger.warn(
                `Activity class ${className} has validation issues: ${validation.issues.join(', ')}`,
            );
            return null;
        }

        // Extract activity methods
        const activityMethods = this.metadataAccessor.extractActivityMethods(instance);
        const methodInfos: Array<{
            name: string;
            methodName: string;
            options: any;
        }> = [];

        // Register activity handlers
        for (const [activityName, handler] of activityMethods.entries()) {
            this.activityHandlers.set(activityName, handler as ActivityMethodHandler);

            // Find method info
            const methodName = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).find(
                (name) => instance[name] === handler,
            );

            if (methodName) {
                const method = Object.getPrototypeOf(instance)[methodName];
                methodInfos.push({
                    name: activityName,
                    methodName,
                    options: this.metadataAccessor.getActivityMethodOptions(method),
                });
            }

            this.logger.debug(`Registered activity: ${className}.${activityName}`);
        }

        return {
            className,
            instance,
            targetClass,
            methods: methodInfos,
            totalMethods: methodInfos.length,
        };
    }

    // ==========================================
    // Public API
    // ==========================================

    /**
     * Get all discovered activities
     */
    getDiscoveredActivities(): ActivityInfo[] {
        return Array.from(this.discoveredActivities.values());
    }

    /**
     * Get activity by class name
     */
    getActivityByClassName(className: string): ActivityInfo | undefined {
        return this.discoveredActivities.get(className);
    }

    /**
     * Get all activity handlers (for worker registration)
     */
    getActivityHandlers(): Record<string, ActivityMethodHandler> {
        return Object.fromEntries(this.activityHandlers.entries());
    }

    /**
     * Get activity handler by name
     */
    getActivityHandler(activityName: string): ActivityMethodHandler | undefined {
        return this.activityHandlers.get(activityName);
    }

    /**
     * Get all activity names
     */
    getActivityNames(): string[] {
        return Array.from(this.activityHandlers.keys());
    }

    /**
     * Check if activity exists
     */
    hasActivity(activityName: string): boolean {
        return this.activityHandlers.has(activityName);
    }

    /**
     * Get activity statistics
     */
    getActivityStats(): {
        totalClasses: number;
        totalMethods: number;
        classNames: string[];
        methodNames: string[];
    } {
        const activities = this.getDiscoveredActivities();
        const totalMethods = activities.reduce((sum, activity) => sum + activity.totalMethods, 0);

        return {
            totalClasses: activities.length,
            totalMethods,
            classNames: activities.map((a) => a.className),
            methodNames: this.getActivityNames(),
        };
    }

    /**
     * Validate activity configuration
     */
    validateConfiguration(): {
        isValid: boolean;
        issues: string[];
        warnings: string[];
    } {
        const issues: string[] = [];
        const warnings: string[] = [];

        // Check if any activities were discovered
        if (this.discoveredActivities.size === 0) {
            warnings.push(
                'No activities were discovered. Make sure classes are decorated with @Activity()',
            );
        }

        // Check for duplicate activity names
        const methodNames = this.getActivityNames();
        const duplicates = methodNames.filter((name, index) => methodNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            issues.push(`Duplicate activity names found: ${duplicates.join(', ')}`);
        }

        // Check if specified activity classes were found
        if (this.options.activityClasses?.length) {
            const foundClasses = this.getDiscoveredActivities().map((a) => a.targetClass);
            const missingClasses = this.options.activityClasses.filter(
                (cls) => !foundClasses.includes(cls),
            );
            if (missingClasses.length > 0) {
                warnings.push(
                    `Some specified activity classes were not found: ${missingClasses.map((c) => c.name).join(', ')}`,
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
     * Get health status
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

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Log activity discovery summary
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

        // Log validation results
        if (validation.warnings.length > 0) {
            validation.warnings.forEach((warning) => this.logger.warn(warning));
        }

        if (validation.issues.length > 0) {
            validation.issues.forEach((issue) => this.logger.error(issue));
        }
    }
}
