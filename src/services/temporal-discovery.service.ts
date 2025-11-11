import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TEMPORAL_MODULE_OPTIONS, ACTIVITY_MODULE_OPTIONS } from '../constants';
import {
    TemporalOptions,
    ActivityModuleOptions,
    ActivityMethodHandler,
    DiscoveredActivity,
    NestJSWrapper,
    DiscoveryServiceStats,
    DiscoveryHealthStatus,
    ActivityExecutionResult,
    ComponentDiscoveryResult,
    WrapperProcessingResult,
} from '../interfaces';
import { createLogger, TemporalLogger } from '../utils/logger';
import { TemporalMetadataAccessor } from './temporal-metadata.service';

/**
 * Temporal Discovery Service
 *
 * Automatically discovers and manages Temporal components including:
 * - Activities with @Activity decorator
 * - Signals with @SignalMethod decorator
 * - Queries with @QueryMethod decorator
 * - Child workflows with @ChildWorkflow decorator
 *
 * Provides introspection and statistics about discovered components.
 */
@Injectable()
export class TemporalDiscoveryService implements OnModuleInit {
    private readonly logger: TemporalLogger;
    private readonly discoveredActivities = new Map<string, DiscoveredActivity>();
    private isDiscoveryComplete = false;
    private discoveryStartTime: Date | null = null;
    private lastDiscoveryTime: Date | null = null;

    /* istanbul ignore next */
    constructor(
        private readonly discoveryService: DiscoveryService,
        @Optional()
        private readonly metadataAccessor: TemporalMetadataAccessor = new TemporalMetadataAccessor(),
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
        @Inject(ACTIVITY_MODULE_OPTIONS)
        private readonly activityModuleOptions: ActivityModuleOptions = { activityClasses: [] },
    ) {
        /* istanbul ignore next */
        this.logger = createLogger(TemporalDiscoveryService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            this.logger.debug('Starting component discovery...');
            this.discoveryStartTime = new Date();
            const result = await this.discoverComponents();
            this.isDiscoveryComplete = true;
            this.lastDiscoveryTime = new Date();
            this.logDiscoveryResults(result);
        } catch (error) {
            this.logger.error('Failed to complete component discovery', error);
            throw error;
        }
    }

    /**
     * Get all discovered activities
     */
    getDiscoveredActivities(): Map<string, DiscoveredActivity> {
        return new Map(this.discoveredActivities);
    }

    /**
     * Get activity by name
     */
    getActivity(name: string): ActivityMethodHandler | undefined {
        const activityInfo = this.discoveredActivities.get(name);
        if (!activityInfo) return undefined;

        const info = activityInfo as { handler?: ActivityMethodHandler };
        return info.handler || (typeof info === 'function' ? info : undefined);
    }

    /**
     * Get all registered activities as handlers map
     */
    getAllActivities(): Record<string, ActivityMethodHandler> {
        const allActivities: Record<string, ActivityMethodHandler> = {};
        for (const [name, activityInfo] of this.discoveredActivities) {
            const handler =
                (activityInfo as { handler?: ActivityMethodHandler }).handler || activityInfo;
            if (typeof handler === 'function') {
                allActivities[name] = handler;
            }
        }
        return allActivities;
    }

    /**
     * Check if an activity exists
     */
    hasActivity(name: string): boolean {
        return this.discoveredActivities.has(name);
    }

    /**
     * Get activity names
     */
    getActivityNames(): string[] {
        return Array.from(this.discoveredActivities.keys());
    }

    /**
     * Execute an activity by name
     */
    async executeActivity(name: string, ...args: unknown[]): Promise<ActivityExecutionResult> {
        const activity = this.getActivity(name);
        if (!activity) {
            return {
                success: false,
                error: new Error(`Activity '${name}' not found`),
                activityName: name,
            };
        }

        const startTime = Date.now();
        try {
            this.logger.debug(`Executing activity: ${name}`);
            const result = await activity(...args);
            const executionTime = Date.now() - startTime;
            this.logger.debug(`Activity completed: ${name}`);
            return {
                success: true,
                result,
                executionTime,
                activityName: name,
                args,
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to execute activity ${name}: ${errorMessage}`, error);
            return {
                success: false,
                error: error instanceof Error ? error : new Error(errorMessage),
                executionTime,
                activityName: name,
                args,
            };
        }
    }

    /**
     * Refresh/rediscover components
     */
    async rediscover(): Promise<ComponentDiscoveryResult> {
        this.logger.info('Refreshing component discovery...');
        this.clearDiscoveredComponents();
        const result = await this.discoverComponents();
        this.isDiscoveryComplete = true;
        this.lastDiscoveryTime = new Date();
        this.logger.info('Component discovery refresh completed');
        return result;
    }

    /**
     * Get discovery statistics
     */
    getStats(): DiscoveryServiceStats {
        return {
            methods: this.discoveredActivities.size,
            activities: this.discoveredActivities.size,
            totalComponents: this.discoveredActivities.size,
        };
    }

    /**
     * Get health status for monitoring
     */
    getHealthStatus(): DiscoveryHealthStatus {
        const hasDiscoveredComponents = this.getTotalDiscovered() > 0;
        const discoveryDuration =
            this.discoveryStartTime && this.lastDiscoveryTime
                ? this.lastDiscoveryTime.getTime() - this.discoveryStartTime.getTime()
                : null;

        return {
            status: hasDiscoveredComponents ? 'healthy' : 'degraded',
            discoveredItems: {
                activities: this.discoveredActivities.size,
            },
            isComplete: this.isDiscoveryComplete,
            lastDiscovery: this.lastDiscoveryTime,
            discoveryDuration,
            totalComponents: this.getTotalDiscovered(),
        };
    }

    private async discoverComponents(): Promise<ComponentDiscoveryResult> {
        const startTime = Date.now();
        const errors: Array<{ component: string; error: string }> = [];
        let discoveredCount = 0;

        const providers = this.discoveryService.getProviders();
        const controllers = this.discoveryService.getControllers();

        this.logger.debug(
            `Scanning ${providers.length} providers and ${controllers.length} controllers`,
        );

        const allWrappers = [...providers, ...controllers];

        for (const wrapper of allWrappers) {
            try {
                const result = await this.processWrapper(wrapper as NestJSWrapper);
                if (result.success) {
                    discoveredCount += result.processedCount;
                }
                errors.push(...result.errors);
            } catch (error) {
                const wrapperName = this.getWrapperName(wrapper as NestJSWrapper);
                /* istanbul ignore next */
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ component: wrapperName, error: errorMessage });
                this.logger.warn(`Failed to process wrapper ${wrapperName}`, error);
            }
        }

        const duration = Date.now() - startTime;
        return {
            success: errors.length === 0,
            discoveredCount,
            errors,
            duration,
        };
    }

    private async processWrapper(wrapper: NestJSWrapper): Promise<WrapperProcessingResult> {
        const errors: Array<{ component: string; error: string }> = [];
        let processedCount = 0;

        try {
            const instance = wrapper.instance;
            const metatype = wrapper.metatype;

            if (!instance || !metatype) {
                return {
                    success: true,
                    processedCount: 0,
                    errors: [],
                };
            }

            const className = metatype.name;
            this.logger.debug(`Processing class: ${className}`);

            // Discover activities
            if (this.metadataAccessor.isActivity(metatype)) {
                const result = await this.discoverActivitiesInClass(
                    instance as Record<string, unknown>,
                    className,
                );
                if (result.success) {
                    processedCount += result.discoveredCount;
                }
                errors.push(...result.errors);
            }

            return {
                success: errors.length === 0,
                processedCount,
                errors,
            };
        } catch (error) {
            const wrapperName = this.getWrapperName(wrapper);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ component: wrapperName, error: errorMessage });
            return {
                success: false,
                processedCount: 0,
                errors,
            };
        }
    }

    private async discoverActivitiesInClass(
        instance: Record<string, unknown>,
        className: string,
    ): Promise<{
        success: boolean;
        discoveredCount: number;
        errors: Array<{ component: string; error: string }>;
    }> {
        const errors: Array<{ component: string; error: string }> = [];
        let discoveredCount = 0;

        try {
            // Check if this class should be included based on activity module options
            const filterClasses = this.activityModuleOptions?.activityClasses || [];
            const metatype = (
                instance as { constructor: new (...args: unknown[]) => Record<string, unknown> }
            ).constructor;

            if (filterClasses.length > 0 && !filterClasses.includes(metatype)) {
                return {
                    success: true,
                    discoveredCount: 0,
                    errors: [],
                };
            }

            // Check if it's an activity class
            if (!this.metadataAccessor.isActivity(metatype)) {
                return {
                    success: true,
                    discoveredCount: 0,
                    errors: [],
                };
            }

            // Validate the activity class
            const validation = this.metadataAccessor.validateActivityClass(metatype);
            if (!validation.isValid) {
                const errorMessage = `Activity class ${className} has validation issues: ${validation.issues.join(', ')}`;
                this.logger.warn(errorMessage);
                errors.push({ component: className, error: errorMessage });
                return {
                    success: false,
                    discoveredCount: 0,
                    errors,
                };
            }

            const activityMethodsResult = this.metadataAccessor.extractActivityMethods(instance);

            for (const [activityName, methodInfo] of activityMethodsResult.methods.entries()) {
                try {
                    // Handle both object format (with handler property) and direct function format
                    const handler =
                        typeof methodInfo === 'function'
                            ? methodInfo
                            : (methodInfo as { handler?: unknown }).handler;
                    if (typeof handler === 'function') {
                        this.discoveredActivities.set(activityName, {
                            name: activityName,
                            className,
                            method: methodInfo as unknown as ActivityMethodHandler,
                            instance,
                            handler: handler as ActivityMethodHandler,
                        });

                        discoveredCount++;
                        this.logger.debug(`Discovered activity: ${className}.${activityName}`);
                    } else {
                        const errorMessage = `Invalid activity method for ${activityName}: not a function`;
                        this.logger.warn(errorMessage);
                        errors.push({
                            component: `${className}.${activityName}`,
                            error: errorMessage,
                        });
                    }
                } catch (methodError) {
                    const errorMessage =
                        methodError instanceof Error ? methodError.message : 'Unknown error';
                    errors.push({
                        component: `${className}.${activityName}`,
                        error: errorMessage,
                    });
                }
            }

            return {
                success: errors.length === 0,
                discoveredCount,
                errors,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to discover activities in ${className}`, error);
            errors.push({ component: className, error: errorMessage });
            return {
                success: false,
                discoveredCount,
                errors,
            };
        }
    }

    private clearDiscoveredComponents(): void {
        this.discoveredActivities.clear();
        this.isDiscoveryComplete = false;
        this.discoveryStartTime = null;
        this.lastDiscoveryTime = null;
    }

    private getTotalDiscovered(): number {
        return this.discoveredActivities.size;
    }

    private getWrapperName(wrapper: NestJSWrapper): string {
        try {
            const metatype = wrapper.metatype;
            return metatype?.name || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    private logDiscoveryResults(result?: ComponentDiscoveryResult): void {
        const totalDiscovered = this.getTotalDiscovered();

        this.logger.info(`Discovery completed: ${this.discoveredActivities.size} activities`);

        if (result) {
            this.logger.info(`Discovery took ${result.duration}ms`);
            if (result.errors.length > 0) {
                this.logger.warn(`Discovery completed with ${result.errors.length} errors`);
                result.errors.forEach(({ component, error }) => {
                    this.logger.warn(`Error in ${component}: ${error}`);
                });
            }
        }

        if (totalDiscovered === 0) {
            this.logger.warn(
                'No Temporal components discovered. Ensure decorators are properly applied.',
            );
        }

        // Log discovered components at debug level
        this.logDiscoveredComponents();
    }

    private logDiscoveredComponents(): void {
        if (this.discoveredActivities.size > 0) {
            const activities = Array.from(this.discoveredActivities.keys());
            this.logger.debug(`Discovered activities: [${activities.join(', ')}]`);
        }
    }
}
