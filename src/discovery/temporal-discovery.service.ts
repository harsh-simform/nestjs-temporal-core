import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_SCHEDULED_WORKFLOW,
    TEMPORAL_SIGNAL_METHOD,
} from '../constants';
import {
    DiscoveryStats,
    QueryMethodHandler,
    QueryMethodInfo,
    ScheduledMethodInfo,
    ScheduledOptions,
    SignalMethodHandler,
    SignalMethodInfo,
} from '../interfaces';
import { createLogger } from '../utils/logger';

/**
 * Streamlined Discovery Service
 * Auto-discovers scheduled workflows, signals, and queries using decorators
 */
@Injectable()
export class TemporalDiscoveryService implements OnModuleInit {
    private readonly logger = createLogger(TemporalDiscoveryService.name);

    // Efficient storage for discovered components
    private readonly scheduledWorkflows = new Map<string, ScheduledMethodInfo>();
    private readonly signals = new Map<string, SignalMethodInfo>();
    private readonly queries = new Map<string, QueryMethodInfo>();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly metadataScanner: MetadataScanner,
    ) {}

    async onModuleInit() {
        await this.discoverComponents();
    }

    // ==========================================
    // Discovery Process
    // ==========================================

    /**
     * Main discovery process - finds all scheduled workflows, signals, and queries
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
     * Process a single wrapper to check for scheduled methods, signals, and queries
     */
    private async processWrapper(wrapper: InstanceWrapper): Promise<void> {
        const { instance, metatype } = wrapper;

        if (!instance || !metatype) {
            return;
        }

        this.logger.debug(`Processing wrapper: ${metatype.name}`);

        // Discover all methods in the class
        await this.discoverMethods(instance);
    }

    /**
     * Discover all methods within a class
     */
    private async discoverMethods(instance: object): Promise<void> {
        const prototype = Object.getPrototypeOf(instance);

        // Get all method names
        const methodNames = this.metadataScanner
            .scanFromPrototype(instance, prototype, (methodName) =>
                methodName !== 'constructor' ? methodName : null,
            )
            .filter((methodName): methodName is string => Boolean(methodName));

        // Process each method
        for (const methodName of methodNames) {
            const method = prototype[methodName];
            if (!method || typeof method !== 'function') {
                continue;
            }

            this.categorizeMethod(instance, methodName, method);
        }
    }

    /**
     * Categorize a method based on its decorators
     */
    private categorizeMethod(instance: object, methodName: string, method: Function): void {
        const boundMethod = method.bind(instance);

        // Check for scheduled workflows
        const scheduleMetadata = Reflect.getMetadata(TEMPORAL_SCHEDULED_WORKFLOW, method);
        if (scheduleMetadata) {
            const scheduledInfo = this.createScheduledMethodInfo(
                methodName,
                scheduleMetadata,
                boundMethod,
                instance,
            );
            this.scheduledWorkflows.set(scheduleMetadata.scheduleId, scheduledInfo);
        }

        // Check for signal methods
        const signalMetadata = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, method);
        if (signalMetadata) {
            const signalInfo = this.createSignalMethodInfo(methodName, signalMetadata, boundMethod);
            this.signals.set(signalMetadata.name || methodName, signalInfo);
        }

        // Check for query methods
        const queryMetadata = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, method);
        if (queryMetadata) {
            const queryInfo = this.createQueryMethodInfo(methodName, queryMetadata, boundMethod);
            this.queries.set(queryMetadata.name || methodName, queryInfo);
        }
    }

    // ==========================================
    // Method Info Creation
    // ==========================================

    /**
     * Create scheduled method info object
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
     * Create signal method info object
     */
    private createSignalMethodInfo(
        methodName: string,
        metadata: unknown,
        boundMethod: SignalMethodHandler,
    ): SignalMethodInfo {
        const signalMetadata = metadata as Record<string, unknown>;
        return {
            methodName,
            signalName: (signalMetadata.name as string) || methodName,
            options: signalMetadata,
            handler: boundMethod,
        };
    }

    /**
     * Create query method info object
     */
    private createQueryMethodInfo(
        methodName: string,
        metadata: unknown,
        boundMethod: QueryMethodHandler,
    ): QueryMethodInfo {
        const queryMetadata = metadata as Record<string, unknown>;
        return {
            methodName,
            queryName: (queryMetadata.name as string) || methodName,
            options: queryMetadata,
            handler: boundMethod,
        };
    }

    // ==========================================
    // Public API Methods
    // ==========================================

    /**
     * Get all discovered scheduled workflows
     */
    getScheduledWorkflows(): ScheduledMethodInfo[] {
        return Array.from(this.scheduledWorkflows.values());
    }

    /**
     * Get scheduled workflow by schedule ID
     */
    getScheduledWorkflow(scheduleId: string): ScheduledMethodInfo | undefined {
        return this.scheduledWorkflows.get(scheduleId);
    }

    /**
     * Get all schedule IDs
     */
    getScheduleIds(): string[] {
        return Array.from(this.scheduledWorkflows.keys());
    }

    /**
     * Check if a schedule exists
     */
    hasSchedule(scheduleId: string): boolean {
        return this.scheduledWorkflows.has(scheduleId);
    }

    /**
     * Get all signals
     */
    getSignals(): SignalMethodInfo[] {
        return Array.from(this.signals.values());
    }

    /**
     * Get signal by name
     */
    getSignal(signalName: string): SignalMethodInfo | undefined {
        return this.signals.get(signalName);
    }

    /**
     * Get all queries
     */
    getQueries(): QueryMethodInfo[] {
        return Array.from(this.queries.values());
    }

    /**
     * Get query by name
     */
    getQuery(queryName: string): QueryMethodInfo | undefined {
        return this.queries.get(queryName);
    }

    /**
     * Get discovery statistics
     */
    getStats(): DiscoveryStats {
        return {
            controllers: 0, // No longer tracking workflow controllers
            methods: 0, // No longer tracking workflow methods
            scheduled: this.scheduledWorkflows.size,
            signals: this.signals.size,
            queries: this.queries.size,
        };
    }

    /**
     * Get health status for monitoring
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded';
        discoveredItems: DiscoveryStats;
        lastDiscovery: Date | null;
    } {
        const stats = this.getStats();
        const status =
            stats.scheduled > 0 || stats.signals > 0 || stats.queries > 0 ? 'healthy' : 'degraded';

        return {
            status,
            discoveredItems: stats,
            lastDiscovery: new Date(), // In a real implementation, track when discovery was last run
        };
    }

    // ==========================================
    // Placeholder methods for backward compatibility
    // ==========================================

    /**
     * @deprecated Workflow controllers are no longer supported
     */
    getWorkflowControllers(): object[] {
        this.logger.warn(
            'getWorkflowControllers() is deprecated - workflow controllers are no longer supported',
        );
        return [];
    }

    /**
     * @deprecated Workflow methods are no longer supported
     */
    getWorkflowMethod(_workflowName: string): unknown {
        this.logger.warn(
            'getWorkflowMethod() is deprecated - workflow methods are no longer supported',
        );
        return undefined;
    }

    /**
     * @deprecated Workflow names are no longer supported
     */
    getWorkflowNames(): string[] {
        this.logger.warn(
            'getWorkflowNames() is deprecated - workflow names are no longer supported',
        );
        return [];
    }

    /**
     * @deprecated Workflow existence check is no longer supported
     */
    hasWorkflow(_workflowName: string): boolean {
        this.logger.warn(
            'hasWorkflow() is deprecated - workflow existence check is no longer supported',
        );
        return false;
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Log discovery results with summary
     */
    private logDiscoveryResults(): void {
        const stats = this.getStats();

        this.logger.log(
            `Discovery completed: ${stats.scheduled} scheduled workflows, ${stats.signals} signals, ${stats.queries} queries`,
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
    }
}
