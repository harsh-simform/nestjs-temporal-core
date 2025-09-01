import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TEMPORAL_MODULE_OPTIONS } from '../constants';
import {
    TemporalOptions,
    DiscoveryStats,
    ExtendedSignalMethodInfo as SignalMethodInfo,
    ExtendedQueryMethodInfo as QueryMethodInfo,
    ChildWorkflowInfo,
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
    private readonly discoveredActivities = new Map<string, unknown>();
    private readonly discoveredSignals = new Map<string, SignalMethodInfo>();
    private readonly discoveredQueries = new Map<string, QueryMethodInfo>();
    private readonly discoveredChildWorkflows = new Map<string, ChildWorkflowInfo>();
    // Aliases for test cleanup compatibility
    private signals: Map<string, SignalMethodInfo>;
    private queries: Map<string, QueryMethodInfo>;
    private childWorkflows: Map<string, ChildWorkflowInfo>;
    private isDiscoveryComplete = false;
    private discoveryStartTime: Date | null = null;
    private lastDiscoveryTime: Date | null = null;

    constructor(
        private readonly discoveryService: DiscoveryService,
        @Optional()
        private readonly metadataAccessor: TemporalMetadataAccessor = new TemporalMetadataAccessor(),
        @Inject(TEMPORAL_MODULE_OPTIONS)
        private readonly options: TemporalOptions,
    ) {
        this.logger = createLogger(TemporalDiscoveryService.name, {
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        });
        // initialize alias maps
        this.signals = this.discoveredSignals;
        this.queries = this.discoveredQueries;
        this.childWorkflows = this.discoveredChildWorkflows as any;
    }

    async onModuleInit(): Promise<void> {
        try {
            this.logger.debug('Starting component discovery...');
            this.discoveryStartTime = new Date();
            await this.discoverComponents();
            this.isDiscoveryComplete = true;
            this.lastDiscoveryTime = new Date();
            this.logDiscoveryResults();
        } catch (error) {
            this.logger.error('Failed to complete component discovery', error);
            throw error;
        }
    }

    /**
     * Get comprehensive discovery statistics
     */
    getStats(): DiscoveryStats {
        return {
            controllers: this.getDiscoveredControllersCount(),
            methods: this.getDiscoveredMethodsCount(),
            signals: this.discoveredSignals.size,
            queries: this.discoveredQueries.size,
            workflows: this.getDiscoveredWorkflowsCount(),
            childWorkflows: this.discoveredChildWorkflows.size,
        };
    }

    /**
     * Get all discovered activities
     */
    getDiscoveredActivities(): Map<string, unknown> {
        return new Map(this.discoveredActivities);
    }

    /**
     * Get all discovered signals (as array for consumer friendliness)
     */
    getSignals(): Array<SignalMethodInfo> {
        return Array.from(this.discoveredSignals.values());
    }

    /**
     * Get a signal by name
     */
    getSignal(name: string): SignalMethodInfo | undefined {
        return this.discoveredSignals.get(name);
    }

    /**
     * Get all discovered queries (as array)
     */
    getQueries(): Array<QueryMethodInfo> {
        return Array.from(this.discoveredQueries.values());
    }

    /**
     * Get a query by name
     */
    getQuery(name: string): QueryMethodInfo | undefined {
        return this.discoveredQueries.get(name);
    }

    /**
     * Get all discovered child workflows (as array)
     */
    getChildWorkflows(): Array<ChildWorkflowInfo> {
        return Array.from(this.discoveredChildWorkflows.values());
    }

    /**
     * Get a specific child workflow by property key
     */
    getChildWorkflow(propertyKey: string): ChildWorkflowInfo | undefined {
        // propertyKey is unique per class; we stored map by workflow name, so search values
        return this.getChildWorkflows().find((cw) => cw.propertyKey === propertyKey);
    }

    /**
     * Get all workflow names
     */
    getWorkflowNames(): string[] {
        // For now, return empty array - can be enhanced when workflow discovery is added
        return [];
    }

    /**
     * Indicate if a workflow exists by name
     */
    hasWorkflow(_name: string): boolean {
        // For now, always return false - can be enhanced when workflow discovery is added
        return false;
    }

    /**
     * Get schedule IDs
     */
    getScheduleIds(): string[] {
        // Return empty array for now - schedules are handled by ScheduleService
        return [];
    }

    /**
     * Get workflow info by name
     */
    getWorkflowInfo(_workflowName: string): unknown {
        // Return null for now - can be enhanced when workflow discovery is added
        return null;
    }

    /**
     * Force re-discovery of components (useful for testing)
     */
    async rediscover(): Promise<void> {
        this.logger.info('Forcing component re-discovery...');
        this.clearDiscoveredComponents();
        await this.discoverComponents();
        this.lastDiscoveryTime = new Date();
        this.logDiscoveryResults();
    }

    /**
     * Get health status for monitoring
     */
    getHealthStatus() {
        const stats = this.getStats();
        const hasDiscoveredComponents = this.getTotalDiscovered() > 0;
        const discoveryDuration =
            this.discoveryStartTime && this.lastDiscoveryTime
                ? this.lastDiscoveryTime.getTime() - this.discoveryStartTime.getTime()
                : null;

        return {
            status: hasDiscoveredComponents ? 'healthy' : 'degraded',
            discoveredItems: stats,
            isComplete: this.isDiscoveryComplete,
            lastDiscovery: this.lastDiscoveryTime,
            discoveryDuration,
            totalComponents: this.getTotalDiscovered(),
        };
    }

    private async discoverComponents(): Promise<void> {
        const providers = this.discoveryService.getProviders();
        const controllers = this.discoveryService.getControllers();

        this.logger.debug(
            `Scanning ${providers.length} providers and ${controllers.length} controllers`,
        );

        const allWrappers = [...providers, ...controllers];

        for (const wrapper of allWrappers) {
            try {
                await this.processWrapper(wrapper);
            } catch (error) {
                this.logger.warn(
                    `Failed to process wrapper ${this.getWrapperName(wrapper)}`,
                    error,
                );
            }
        }
    }

    private async processWrapper(wrapper: unknown): Promise<void> {
        const instance = (wrapper as { instance?: unknown }).instance;
        const metatype = (wrapper as { metatype?: Function }).metatype;

        if (!instance || !metatype) {
            return;
        }

        const className = metatype.name;
        this.logger.debug(`Processing class: ${className}`);

        // Discover activities
        if (this.metadataAccessor.isActivity(metatype)) {
            await this.discoverActivitiesInClass(instance, className);
        }

        // Discover signals and queries in any class
        await this.discoverSignalsInClass(instance, className);
        await this.discoverQueriesInClass(instance, className);
        await this.discoverChildWorkflowsInClass(instance, className);
    }

    private async discoverActivitiesInClass(instance: unknown, className: string): Promise<void> {
        try {
            const activityMethods = this.metadataAccessor.extractActivityMethods(instance);

            for (const [activityName, method] of activityMethods.entries()) {
                this.discoveredActivities.set(activityName, {
                    name: activityName,
                    className,
                    method,
                    instance,
                });

                this.logger.debug(`Discovered activity: ${className}.${activityName}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to discover activities in ${className}`, error);
        }
    }

    private async discoverSignalsInClass(instance: unknown, className: string): Promise<void> {
        try {
            const constructor = (instance as { constructor: Function }).constructor;
            const signals = this.metadataAccessor.getSignalMethods(constructor.prototype);

            for (const [signalName, methodName] of Object.entries(signals)) {
                this.discoveredSignals.set(signalName, {
                    className,
                    signalName,
                    methodName,
                    handler: (instance as any)[methodName]?.bind(instance),
                    instance: instance as object,
                });

                this.logger.debug(`Discovered signal: ${className}.${methodName} -> ${signalName}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to discover signals in ${className}`, error);
        }
    }

    private async discoverQueriesInClass(instance: unknown, className: string): Promise<void> {
        try {
            const constructor = (instance as { constructor: Function }).constructor;
            const queries = this.metadataAccessor.getQueryMethods(constructor.prototype);

            for (const [queryName, methodName] of Object.entries(queries)) {
                this.discoveredQueries.set(queryName, {
                    className,
                    queryName,
                    methodName,
                    handler: (instance as any)[methodName]?.bind(instance),
                    instance: instance as object,
                    options: {},
                });

                this.logger.debug(`Discovered query: ${className}.${methodName} -> ${queryName}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to discover queries in ${className}`, error);
        }
    }

    private async discoverChildWorkflowsInClass(
        instance: unknown,
        className: string,
    ): Promise<void> {
        try {
            const constructor = (instance as { constructor: Function }).constructor;
            const childWorkflows = this.metadataAccessor.getChildWorkflows(constructor.prototype);

            for (const [propertyKey, metadata] of Object.entries(childWorkflows)) {
                const workflowType = (metadata as { workflowType: { name: string } })
                    .workflowType as any;
                const workflowName = workflowType?.name;
                this.discoveredChildWorkflows.set(workflowName, {
                    className,
                    propertyKey,
                    workflowType,
                    options: (metadata as any).options || {},
                    instance: instance as object,
                });

                this.logger.debug(
                    `Discovered child workflow: ${className}.${propertyKey} -> ${workflowName}`,
                );
            }
        } catch (error) {
            this.logger.warn(`Failed to discover child workflows in ${className}`, error);
        }
    }

    private clearDiscoveredComponents(): void {
        this.discoveredActivities.clear();
        this.discoveredSignals.clear();
        this.discoveredQueries.clear();
        this.discoveredChildWorkflows.clear();
        this.isDiscoveryComplete = false;
        this.discoveryStartTime = null;
        this.lastDiscoveryTime = null;
    }

    private getTotalDiscovered(): number {
        return (
            this.discoveredActivities.size +
            this.discoveredSignals.size +
            this.discoveredQueries.size +
            this.discoveredChildWorkflows.size
        );
    }

    private getDiscoveredControllersCount(): number {
        // For now, return 0 - can be enhanced when controller discovery is implemented
        return 0;
    }

    private getDiscoveredMethodsCount(): number {
        // For now, return 0 - can be enhanced when method counting is implemented
        return 0;
    }

    private getDiscoveredWorkflowsCount(): number {
        // For now, return 0 - can be enhanced when workflow discovery is implemented
        return 0;
    }

    private getWrapperName(wrapper: unknown): string {
        try {
            const metatype = (wrapper as { metatype?: Function }).metatype;
            return metatype?.name || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    private logDiscoveryResults(): void {
        const stats = this.getStats();
        const totalDiscovered = this.getTotalDiscovered();

        this.logger.info(
            `Discovery completed: ${this.discoveredActivities.size} activities, ${stats.signals} signals, ${stats.queries} queries, ${stats.childWorkflows} child workflows`,
        );

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

        if (this.discoveredSignals.size > 0) {
            const signals = Array.from(this.discoveredSignals.keys());
            this.logger.debug(`Discovered signals: [${signals.join(', ')}]`);
        }

        if (this.discoveredQueries.size > 0) {
            const queries = Array.from(this.discoveredQueries.keys());
            this.logger.debug(`Discovered queries: [${queries.join(', ')}]`);
        }

        if (this.discoveredChildWorkflows.size > 0) {
            const childWorkflows = Array.from(this.discoveredChildWorkflows.keys());
            this.logger.debug(`Discovered child workflows: [${childWorkflows.join(', ')}]`);
        }
    }
}
