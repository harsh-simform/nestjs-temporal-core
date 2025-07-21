import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
    TEMPORAL_WORKFLOW_RUN,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../constants';
import {
    DiscoveryStats,
    QueryMethodInfo,
    SignalMethodInfo,
    WorkflowRunInfo,
    ChildWorkflowInfo,
    ScheduledMethodInfo,
    ScheduledOptions,
} from '../interfaces';
import { createLogger } from '../utils/logger';

/**
 * Discovers and manages Temporal workflow components in a NestJS application.
 *
 * This service automatically discovers methods decorated with @Scheduled, @Signal, and @Query
 * decorators across all providers and controllers in the application. It provides metadata
 * access and management for these components.
 *
 * Key features:
 * - Automatic discovery of scheduled workflows, signals, and queries
 * - Metadata extraction and management
 * - Component validation and health monitoring
 * - Statistics and monitoring capabilities
 * - Fast lookup and retrieval of component information
 *
 * @example
 * ```typescript
 * // Get all scheduled workflows
 * const workflows = discoveryService.getScheduledWorkflows();
 *
 * // Check if a schedule exists
 * const exists = discoveryService.hasSchedule('daily-report');
 *
 * // Get workflow names
 * const workflowNames = discoveryService.getWorkflowNames();
 *
 * // Get discovery statistics
 * const stats = discoveryService.getStats();
 * ```
 */
@Injectable()
export class TemporalDiscoveryService implements OnModuleInit {
    private readonly logger = createLogger(TemporalDiscoveryService.name);
    private readonly scheduledWorkflows = new Map<string, ScheduledMethodInfo>();
    private readonly signals = new Map<string, SignalMethodInfo>();
    private readonly queries = new Map<string, QueryMethodInfo>();
    private readonly workflows = new Map<string, WorkflowRunInfo>();
    private readonly childWorkflows = new Map<string | symbol, ChildWorkflowInfo>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
    ) {}

    /**
     * Initializes the discovery service during module initialization.
     * Discovers all components and logs the results.
     */
    async onModuleInit() {
        await this.discoverComponents();
    }

    /**
     * Discovers all scheduled workflows, signals, and queries in the application.
     * Scans all providers and controllers for decorated methods.
     */
    private async discoverComponents(): Promise<void> {
        const allWrappers = [
            ...this.discoveryService.getProviders(),
            ...this.discoveryService.getControllers(),
        ];
        for (const wrapper of allWrappers) {
            await this.processWrapper(wrapper);
        }
        this.logDiscoveryResults();
    }

    /**
     * Processes a single instance wrapper to discover its methods.
     *
     * @param wrapper - The instance wrapper to process
     */
    private async processWrapper(wrapper: InstanceWrapper): Promise<void> {
        const { instance, metatype } = wrapper;
        if (!instance || !metatype) return;
        this.logger.debug(`Processing wrapper: ${metatype.name}`);
        await this.discoverMethods(instance);
    }

    /**
     * Discovers all decorated methods in a class instance.
     *
     * @param instance - The class instance to scan
     */
    private async discoverMethods(instance: object): Promise<void> {
        try {
            const prototype = Object.getPrototypeOf(instance);
            const methodNames = this.metadataScanner
                .scanFromPrototype(instance, prototype, (methodName) =>
                    methodName !== 'constructor' ? methodName : null,
                )
                .filter((methodName): methodName is string => Boolean(methodName));
            for (const methodName of methodNames) {
                const method = prototype[methodName];
                if (!method || typeof method !== 'function') continue;
                this.categorizeMethod(instance, methodName, method);
            }

            // Child workflows - discover properties with child workflow metadata
            const className = instance.constructor.name;
            const propertyNames = Object.getOwnPropertyNames(instance);
            for (const propertyKey of propertyNames) {
                const childMeta = Reflect.getMetadata(
                    TEMPORAL_CHILD_WORKFLOW,
                    instance,
                    propertyKey,
                );
                if (childMeta) {
                    this.childWorkflows.set(propertyKey, {
                        className,
                        propertyKey,
                        workflowType: childMeta.workflowType,
                        options: childMeta.options,
                        instance,
                    });
                }
            }
        } catch (error) {
            this.logger.warn(`Error during method discovery: ${error.message}`);
        }
    }

    /**
     * Categorizes a method based on its decorators and stores the metadata.
     *
     * @param instance - The class instance containing the method
     * @param methodName - The name of the method
     * @param method - The method function
     */
    private categorizeMethod(instance: object, methodName: string, method: Function): void {
        const className = instance.constructor.name;
        const boundMethod = method.bind(instance);
        const proto = Object.getPrototypeOf(instance);
        // Workflow run
        const workflowRunMeta = Reflect.getMetadata(TEMPORAL_WORKFLOW_RUN, method);
        if (workflowRunMeta) {
            this.workflows.set(methodName, {
                className,
                methodName,
                handler: boundMethod,
                instance,
            });
        }
        // Scheduled workflows
        const scheduleMeta = Reflect.getMetadata('TEMPORAL_SCHEDULED_WORKFLOW', method);
        if (scheduleMeta && scheduleMeta.scheduleId) {
            const scheduledInfo = this.createScheduledMethodInfo(
                methodName,
                scheduleMeta,
                boundMethod,
                instance,
            );
            this.scheduledWorkflows.set(scheduleMeta.scheduleId, scheduledInfo);
        }
        // Signals
        const signalMetadata = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, proto) || {};
        Object.entries(signalMetadata).forEach(([signalName, propKey]) => {
            if (propKey === methodName) {
                this.signals.set(signalName, {
                    className,
                    signalName,
                    methodName,
                    handler: boundMethod,
                    instance,
                    options: {},
                });
            }
        });
        // Queries
        const queryMetadata = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, proto) || {};
        Object.entries(queryMetadata).forEach(([queryName, propKey]) => {
            if (propKey === methodName) {
                this.queries.set(queryName, {
                    className,
                    queryName,
                    methodName,
                    handler: boundMethod,
                    instance,
                    options: {},
                });
            }
        });
    }

    /**
     * Creates metadata information for a scheduled method.
     *
     * @param methodName - The name of the method
     * @param scheduleMetadata - The schedule metadata from the decorator
     * @param boundMethod - The bound method function
     * @param instance - The class instance
     * @returns Scheduled method information object
     */
    private createScheduledMethodInfo(
        methodName: string,
        scheduleMetadata: unknown,
        boundMethod: Function,
        instance: object,
    ): ScheduledMethodInfo {
        const metadata = scheduleMetadata as Record<string, unknown>;
        return {
            methodName,
            workflowName: (metadata.workflowName as string) || methodName,
            scheduleOptions: metadata as unknown as ScheduledOptions,
            workflowOptions: {
                taskQueue: (metadata.taskQueue as string) || 'default',
            },
            handler: boundMethod as (...args: unknown[]) => unknown,
            controllerInfo: {
                name: instance.constructor.name,
                instance,
            },
        };
    }

    /**
     * Returns all discovered scheduled workflows.
     *
     * @returns Array of scheduled workflow metadata
     */
    getScheduledWorkflows(): ScheduledMethodInfo[] {
        return Array.from(this.scheduledWorkflows.values());
    }

    /**
     * Returns scheduled workflow metadata by schedule ID.
     *
     * @param scheduleId - The ID of the schedule to retrieve
     * @returns Scheduled workflow metadata or undefined if not found
     */
    getScheduledWorkflow(scheduleId: string): ScheduledMethodInfo | undefined {
        return this.scheduledWorkflows.get(scheduleId);
    }

    /**
     * Returns all schedule IDs.
     *
     * @returns Array of schedule IDs
     */
    getScheduleIds(): string[] {
        return Array.from(this.scheduledWorkflows.keys());
    }

    /**
     * Checks if a schedule exists by ID.
     *
     * @param scheduleId - The ID of the schedule to check
     * @returns True if the schedule exists
     */
    hasSchedule(scheduleId: string): boolean {
        return this.scheduledWorkflows.has(scheduleId);
    }

    /**
     * Returns all discovered signals.
     *
     * @returns Array of signal method metadata
     */
    getSignals(): SignalMethodInfo[] {
        return Array.from(this.signals.values());
    }

    /**
     * Returns signal metadata by name.
     *
     * @param signalName - The name of the signal to retrieve
     * @returns Signal metadata or undefined if not found
     */
    getSignal(signalName: string): SignalMethodInfo | undefined {
        return this.signals.get(signalName);
    }

    /**
     * Returns all discovered queries.
     *
     * @returns Array of query method metadata
     */
    getQueries(): QueryMethodInfo[] {
        return Array.from(this.queries.values());
    }

    /**
     * Returns query metadata by name.
     *
     * @param queryName - The name of the query to retrieve
     * @returns Query metadata or undefined if not found
     */
    getQuery(queryName: string): QueryMethodInfo | undefined {
        return this.queries.get(queryName);
    }

    /**
     * Returns all discovered workflows.
     *
     * @returns Array of workflow run metadata
     */
    getWorkflows(): WorkflowRunInfo[] {
        return Array.from(this.workflows.values());
    }

    /**
     * Returns workflow run metadata by workflow name.
     *
     * @param workflowName - The name of the workflow to retrieve
     * @returns Workflow run metadata or undefined if not found
     */
    getWorkflow(workflowName: string): WorkflowRunInfo | undefined {
        return this.workflows.get(workflowName);
    }

    /**
     * Returns all discovered child workflows.
     *
     * @returns Array of child workflow metadata
     */
    getChildWorkflows(): ChildWorkflowInfo[] {
        return Array.from(this.childWorkflows.values());
    }

    /**
     * Returns child workflow metadata by property key.
     *
     * @param propertyKey - The property key of the child workflow
     * @returns Child workflow metadata or undefined if not found
     */
    getChildWorkflow(propertyKey: string | symbol): ChildWorkflowInfo | undefined {
        return this.childWorkflows.get(propertyKey);
    }

    /**
     * Returns discovery statistics for monitoring.
     *
     * @returns Object containing discovery statistics
     */
    getStats(): DiscoveryStats {
        return {
            controllers: 0,
            methods: 0,
            scheduled: this.scheduledWorkflows.size,
            signals: this.signals.size,
            queries: this.queries.size,
            workflows: this.workflows.size,
            childWorkflows: this.childWorkflows.size,
        };
    }

    /**
     * Returns health status for monitoring.
     *
     * @returns Object containing health status and discovery information
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded';
        discoveredItems: DiscoveryStats;
        lastDiscovery: Date | null;
    } {
        const stats = this.getStats();
        const status =
            stats.scheduled > 0 ||
            stats.signals > 0 ||
            stats.queries > 0 ||
            stats.workflows > 0 ||
            stats.childWorkflows > 0
                ? 'healthy'
                : 'degraded';
        return {
            status,
            discoveredItems: stats,
            lastDiscovery: new Date(),
        };
    }

    /**
     * Returns all unique workflow names from scheduled workflows.
     *
     * @returns Array of unique workflow names
     */
    getWorkflowNames(): string[] {
        const names = new Set<string>();
        for (const info of this.scheduledWorkflows.values()) {
            if (info.workflowName && info.workflowName.trim()) {
                names.add(info.workflowName);
            }
        }
        return Array.from(names);
    }

    /**
     * Checks if a workflow exists by workflow name.
     *
     * @param workflowName - The name of the workflow to check
     * @returns True if the workflow exists
     */
    hasWorkflow(workflowName: string): boolean {
        for (const info of this.scheduledWorkflows.values()) {
            if (info.workflowName === workflowName) {
                return true;
            }
        }
        return false;
    }

    /**
     * Logs the results of the discovery process.
     * Provides a summary of discovered components and their details.
     */
    private logDiscoveryResults(): void {
        const stats = this.getStats();
        this.logger.log(
            `Discovery completed: ${stats.scheduled} scheduled workflows, ${stats.signals} signals, ${stats.queries} queries, ${stats.workflows} workflows, ${stats.childWorkflows} child workflows`,
        );
        if (stats.scheduled > 0) {
            this.logger.debug(
                `Discovered scheduled workflows: ${Array.from(this.scheduledWorkflows.keys()).join(', ')}`,
            );
        }
        if (stats.signals > 0) {
            this.logger.debug(`Discovered signals: ${Array.from(this.signals.keys()).join(', ')}`);
        }
        if (stats.queries > 0) {
            this.logger.debug(`Discovered queries: ${Array.from(this.queries.keys()).join(', ')}`);
        }
        if (stats.workflows > 0) {
            this.logger.debug(
                `Discovered workflows: ${Array.from(this.workflows.keys()).join(', ')}`,
            );
        }
        if (stats.childWorkflows > 0) {
            this.logger.debug(
                `Discovered child workflows: ${Array.from(this.childWorkflows.keys()).join(', ')}`,
            );
        }
    }
}
