export { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';
export {
    WorkflowHandle,
    Client,
    ConnectionOptions as TemporalConnectionOptions,
    WorkflowIdReusePolicy,
} from '@temporalio/client';
export { Worker } from '@temporalio/worker';
export type { Workflow, WorkflowResultType } from '@temporalio/workflow';

import { Type } from '@nestjs/common';
import {
    ScheduleClient,
    ScheduleHandle,
    WorkflowHandle,
    WorkflowIdReusePolicy,
    ScheduleOptions as SdkScheduleOptions,
    ScheduleSpec as SdkScheduleSpec,
    ScheduleOptionsAction,
    ScheduleOptionsStartWorkflowAction,
    ScheduleDescription as SdkScheduleDescription,
} from '@temporalio/client';
import { NativeConnection, Worker, WorkerOptions, WorkflowBundleOption } from '@temporalio/worker';
import { Duration, RetryPolicy, TypedSearchAttributes } from '@temporalio/common';
import { TLSConfig } from '@temporalio/common/lib/internal-non-workflow';
import type { Workflow } from '@temporalio/workflow';

/**
 * Configuration options for Temporal client connection.
 * Used for establishing connection to Temporal server.
 *
 * @example
 * ```typescript
 * const clientOptions: ClientConnectionOptions = {
 *   address: 'localhost:7233',
 *   namespace: 'default',
 *   tls: false,
 *   metadata: { 'client-version': '1.0.0' }
 * };
 * ```
 */
/**
 * Configuration for a typed workflow proxy created by `WorkflowProxyFactory`.
 *
 * @example
 * ```typescript
 * const config: WorkflowProxyConfig = {
 *   workflowType: 'orderWorkflow',
 *   taskQueue: 'orders',
 * };
 * ```
 */
export interface WorkflowProxyConfig {
    /** Temporal workflow type name (must match the registered workflow function name). */
    workflowType: string;
    /** Optional task queue override. Falls back to the module-level default when omitted. */
    taskQueue?: string;
}

export interface ClientConnectionOptions {
    address: string;
    tls?: boolean | TLSConfig;
    metadata?: Record<string, string>;
    apiKey?: string;
    namespace?: string;
}

/**
 * Connection options with TLS support for Temporal server.
 * Extends the official Temporal ConnectionOptions with additional convenience properties.
 *
 * @example Simple TLS
 * ```typescript
 * const options: ConnectionOptions = {
 *   address: 'temporal.example.com:7233',
 *   tls: true
 * };
 * ```
 *
 * @example Advanced TLS with certificates
 * ```typescript
 * const options: ConnectionOptions = {
 *   address: 'temporal.example.com:7233',
 *   tls: {
 *     serverName: 'temporal.example.com',
 *     clientCertPair: {
 *       crt: fs.readFileSync('client.crt'),
 *       key: fs.readFileSync('client.key'),
 *       ca: fs.readFileSync('ca.crt')
 *     }
 *   }
 * };
 * ```
 */
export type ConnectionOptions = import('@temporalio/client').ConnectionOptions;

/**
 * Configuration for retry policies in Temporal activities and workflows.
 * Defines how many times and with what intervals to retry failed operations.
 *
 * @example
 * ```typescript
 * const retryPolicy: RetryPolicyConfig = {
 *   maximumAttempts: 3,
 *   initialInterval: '1s',
 *   maximumInterval: '10s',
 *   backoffCoefficient: 2.0
 * };
 * ```
 */
export interface RetryPolicyConfig {
    maximumAttempts: number;
    initialInterval: string;
    maximumInterval: string;
    backoffCoefficient: number;
}

/**
 * Configuration for a single worker instance.
 * Allows defining multiple workers with different task queues.
 *
 * @example
 * ```typescript
 * const workerDef: WorkerDefinition = {
 *   taskQueue: 'payments-queue',
 *   workflowsPath: './dist/workflows/payments',
 *   activityClasses: [PaymentActivity],
 *   autoStart: true,
 *   autoRestart: true,
 *   maxRestarts: 5,
 *   workerOptions: {
 *     maxConcurrentActivityTaskExecutions: 100
 *   }
 * };
 * ```
 */
export interface WorkerDefinition {
    taskQueue: string;
    workflowsPath?: string;
    /**
     * Workflow bundle. Prefer Temporal SDK's `WorkflowBundleOption`
     * (`{ code }` or `{ codePath }`). Loose shape accepted for backward
     * compatibility.
     */
    workflowBundle?: WorkflowBundleOption | Record<string, unknown>;
    activityClasses?: Array<Type<object>>;
    autoStart?: boolean;
    /** Enable auto-restart on worker failure (default: inherits from global autoRestart) */
    autoRestart?: boolean;
    /** Maximum restart attempts before giving up (default: 3) */
    maxRestarts?: number;
    workerOptions?: WorkerCreateOptions;
}

/**
 * Main configuration options for Temporal module initialization.
 * Supports both client-only and worker configurations.
 * Now supports multiple workers via the `workers` array property.
 *
 * @example Basic Setup with Single Worker (Legacy)
 * ```typescript
 * const options: TemporalOptions = {
 *   connection: {
 *     address: 'localhost:7233',
 *     namespace: 'default'
 *   },
 *   taskQueue: 'my-task-queue',
 *   worker: {
 *     workflowsPath: './dist/workflows',
 *     activityClasses: [MyActivityClass],
 *     autoStart: true,
 *     autoRestart: true,
 *     maxRestarts: 5
 *   }
 * };
 * ```
 *
 * @example Multiple Workers Setup
 * ```typescript
 * const options: TemporalOptions = {
 *   connection: {
 *     address: 'localhost:7233',
 *     namespace: 'default'
 *   },
 *   autoRestart: true,  // Global default for all workers
 *   maxRestarts: 3,     // Global default for all workers
 *   workers: [
 *     {
 *       taskQueue: 'payments-queue',
 *       workflowsPath: './dist/workflows/payments',
 *       activityClasses: [PaymentActivity],
 *       maxRestarts: 5  // Override for this worker
 *     },
 *     {
 *       taskQueue: 'notifications-queue',
 *       workflowsPath: './dist/workflows/notifications',
 *       activityClasses: [EmailActivity]
 *     }
 *   ]
 * };
 * ```
 *
 * @example Client-only Setup
 * ```typescript
 * const clientOptions: TemporalOptions = {
 *   connection: {
 *     address: 'localhost:7233',
 *     namespace: 'default'
 *   },
 *   // Omit worker configuration for client-only mode
 *   isGlobal: true
 * };
 * ```
 */
export interface TemporalOptions extends LoggerConfig {
    connection?: {
        address: string;
        namespace?: string;
        tls?: boolean | TLSConfig;
        apiKey?: string;
        metadata?: Record<string, string>;
    };
    taskQueue?: string;
    worker?: {
        workflowsPath?: string;
        /**
         * Workflow bundle. Prefer Temporal SDK's `WorkflowBundleOption`
         * (`{ code }` or `{ codePath }`). Loose shape accepted for backward
         * compatibility.
         */
        workflowBundle?: WorkflowBundleOption | Record<string, unknown>;
        activityClasses?: Array<Type<object>>;
        autoStart?: boolean;
        /** Enable auto-restart on worker failure (default: inherits from global autoRestart) */
        autoRestart?: boolean;
        /** Maximum restart attempts before giving up (default: 3) */
        maxRestarts?: number;
        workerOptions?: WorkerCreateOptions;
    };
    workers?: WorkerDefinition[];
    /** Enable auto-restart on worker failure for all workers (default: true) */
    autoRestart?: boolean;
    /** Maximum restart attempts before giving up for all workers (default: 3) */
    maxRestarts?: number;
    isGlobal?: boolean;
    allowConnectionFailure?: boolean;
    /**
     * Enable NestJS shutdown hooks to properly handle SIGTERM/SIGINT signals.
     * When enabled, the module will register shutdown hooks to ensure graceful worker termination.
     * @default true
     */
    enableShutdownHooks?: boolean;
    /**
     * Maximum time in milliseconds to wait for graceful worker shutdown.
     * After this timeout, the shutdown process will complete anyway to prevent hanging.
     * @default 30000 (30 seconds)
     */
    shutdownTimeout?: number;
}

/**
 * Advanced configuration options for Temporal Worker creation.
 * Controls worker behavior, concurrency, and performance settings.
 *
 * This is a direct subset of Temporal SDK's `WorkerOptions` from `@temporalio/worker`,
 * omitting fields that are managed by the framework (`connection`, `taskQueue`,
 * `activities`, `workflowsPath`, `workflowBundle`, `namespace`).
 *
 * For complete documentation of each option, see:
 * https://typescript.temporal.io/api/interfaces/worker.WorkerOptions
 *
 * @example Production Configuration
 * ```typescript
 * const workerOptions: WorkerCreateOptions = {
 *   maxConcurrentActivityTaskExecutions: 100,
 *   maxConcurrentWorkflowTaskExecutions: 50,
 *   maxActivitiesPerSecond: 200,
 *   shutdownGraceTime: '30s',
 *   shutdownForceTime: '60s',
 *   enableLoggingInReplay: false,
 *   identity: 'production-worker-1'
 * };
 * ```
 */
export type WorkerCreateOptions = Omit<
    WorkerOptions,
    'connection' | 'taskQueue' | 'activities' | 'workflowsPath' | 'workflowBundle' | 'namespace'
> & {
    /**
     * @deprecated Not forwarded to Temporal SDK — there is no matching SDK
     * option. Kept for backward compatibility; value is ignored at runtime.
     */
    enableSDKTracing?: boolean;
    /**
     * @deprecated Not forwarded to Temporal SDK — there is no matching SDK
     * option. Kept for backward compatibility; value is ignored at runtime.
     */
    enableOpenTelemetry?: boolean;
};

/**
 * Legacy worker module options interface.
 *
 * @deprecated Use TemporalOptions instead for new implementations.
 * @see {@link TemporalOptions}
 */
export interface WorkerModuleOptions {
    connection?: {
        address?: string;
        namespace?: string;
        tls?: boolean | object;
        apiKey?: string;
        metadata?: Record<string, string>;
    };
    taskQueue?: string;
    workflowsPath?: string;
    workflowBundle?: Record<string, unknown>;
    activityClasses?: Array<Type<object>>;
    autoStart?: boolean;
    autoRestart?: boolean;
    allowWorkerFailure?: boolean;
    workerOptions?: WorkerCreateOptions;
    enableLogger?: boolean;
    logLevel?: LogLevel;
}

// ==========================================
// Logger Interfaces
// ==========================================

/**
 * Supported log levels for Temporal integration logging.
 * Ordered from least to most verbose.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Global logger configuration with advanced formatting and file output options.
 * Extends basic LoggerConfig with application-specific settings.
 *
 * @example
 * ```typescript
 * const loggerConfig: GlobalLoggerConfig = {
 *   enableLogger: true,
 *   logLevel: 'info',
 *   appName: 'my-temporal-app',
 *   logToFile: true,
 *   logFilePath: './logs/temporal.log',
 *   formatter: (level, message, context, timestamp) =>
 *     `[${timestamp}] ${level.toUpperCase()} [${context}]: ${message}`
 * };
 * ```
 */
export interface GlobalLoggerConfig extends LoggerConfig {
    appName?: string;
    formatter?: (level: string, message: string, context: string, timestamp: string) => string;
    logToFile?: boolean;
    logFilePath?: string;
}

/**
 * Basic logger configuration for Temporal integration.
 * Controls whether logging is enabled and at what level.
 *
 * @example
 * ```typescript
 * const config: LoggerConfig = {
 *   enableLogger: true,
 *   logLevel: 'info'
 * };
 * ```
 */
export interface LoggerConfig {
    enableLogger?: boolean;
    logLevel?: LogLevel;
}

// ==========================================
// Async Module Registration
// ==========================================

/**
 * Factory interface for creating TemporalOptions asynchronously.
 * Used with TemporalModule.registerAsync() for dynamic configuration.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class TemporalConfigFactory implements TemporalOptionsFactory {
 *   constructor(private configService: ConfigService) {}
 *
 *   createTemporalOptions(): TemporalOptions {
 *     return {
 *       connection: {
 *         address: this.configService.get('TEMPORAL_ADDRESS'),
 *         namespace: this.configService.get('TEMPORAL_NAMESPACE')
 *       },
 *       taskQueue: this.configService.get('TEMPORAL_TASK_QUEUE')
 *     };
 *   }
 * }
 * ```
 */
export interface TemporalOptionsFactory {
    createTemporalOptions(): Promise<TemporalOptions> | TemporalOptions;
}

/**
 * Options for asynchronous Temporal module registration.
 * Supports factory functions, classes, and dependency injection.
 *
 * @example Using Factory Function
 * ```typescript
 * TemporalModule.registerAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     connection: {
 *       address: configService.get('TEMPORAL_ADDRESS'),
 *       namespace: configService.get('TEMPORAL_NAMESPACE')
 *     }
 *   }),
 *   inject: [ConfigService]
 * });
 * ```
 *
 * @example Using Factory Class
 * ```typescript
 * TemporalModule.registerAsync({
 *   useClass: TemporalConfigFactory,
 *   imports: [ConfigModule]
 * });
 * ```
 */
export interface TemporalAsyncOptions {
    useExisting?: Type<TemporalOptionsFactory>;
    useClass?: Type<TemporalOptionsFactory>;
    useFactory?: (...args: unknown[]) => Promise<TemporalOptions> | TemporalOptions;
    inject?: Array<string | symbol | Type<unknown>>;
    imports?: Array<Type<unknown>>;
    isGlobal?: boolean;
}

// ==========================================
// Signal, Query, Workflow, Activity, Schedule, etc.
// ==========================================

/**
 * Metadata for activity methods discovered through decorators.
 * Contains method information and handler functions.
 */
export interface ActivityMethodMetadata {
    name: string;
    originalName: string;
    options?: Record<string, string | number | boolean | object>;
    handler: ActivityMethodHandler;
}

/**
 * Options for configuring activity methods via @ActivityMethod decorator.
 *
 * @example
 * ```typescript
 * @ActivityMethod({
 *   name: 'processPayment',
 *   timeout: '30s',
 *   maxRetries: 3
 * })
 * async processPayment(amount: number): Promise<void> {
 *   // Implementation
 * }
 * ```
 */
export interface ActivityMethodOptions {
    name?: string;
    timeout?: string | number;
    maxRetries?: number;
}

/**
 * Metadata for activity classes discovered through @Activity decorator.
 */
export interface ActivityMetadata {
    name?: string;
    options?: Record<string, string | number | boolean | object>;
}

/**
 * Options for configuring activity classes via @Activity decorator.
 *
 * @example
 * ```typescript
 * @Activity({ name: 'payment-activities' })
 * export class PaymentActivities {
 *   // Activity methods
 * }
 * ```
 */
export interface ActivityOptions {
    name?: string;
}

/**
 * Statistics about discovered Temporal components.
 * Provides insight into the number of workflows, activities, and other components found.
 *
 * @example Usage
 * ```typescript
 * const stats = discoveryService.getStats();
 * console.log(`Found ${stats.workflows} workflows and ${stats.signals} signals`);
 * ```
 */
export interface DiscoveryStats {
    controllers: number;
    methods: number;
    signals: number;
    queries: number;
    workflows: number;
    childWorkflows: number;
}

/**
 * Information about query methods discovered in workflow classes.
 * Contains method details and handler function.
 */
export interface QueryMethodInfo {
    methodName: string;
    queryName: string;
    options: QueryOptions;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

/**
 * Options for configuring query methods via @QueryMethod decorator.
 *
 * @example
 * ```typescript
 * @QueryMethod('getOrderStatus')
 * getStatus(): string {
 *   return this.currentStatus;
 * }
 * ```
 */
export interface QueryOptions {
    name?: string;
}

/**
 * Configuration options for scheduled workflows using @Scheduled decorator.
 * Supports both cron and interval-based scheduling with advanced features.
 *
 * @example Cron-based Schedule
 * ```typescript
 * @Scheduled({
 *   scheduleId: 'daily-report',
 *   cron: '0 8 * * *',
 *   description: 'Daily sales report',
 *   timezone: 'America/New_York',
 *   overlapPolicy: 'SKIP'
 * })
 * async generateReport(): Promise<void> {
 *   // Implementation
 * }
 * ```
 *
 * @example Interval-based Schedule
 * ```typescript
 * @Scheduled({
 *   scheduleId: 'health-check',
 *   interval: '5m',
 *   description: 'Health check every 5 minutes',
 *   autoStart: true
 * })
 * async performHealthCheck(): Promise<void> {
 *   // Implementation
 * }
 * ```
 */

/**
 * Information about signal methods discovered in workflow classes.
 * Contains method details and handler function.
 */
export interface SignalMethodInfo {
    methodName: string;
    signalName: string;
    options?: Record<string, string | number | boolean | object>;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

/**
 * Options for configuring signal methods via @SignalMethod decorator.
 *
 * @example
 * ```typescript
 * @SignalMethod('updateStatus')
 * async handleStatusUpdate(newStatus: string): Promise<void> {
 *   this.currentStatus = newStatus;
 * }
 * ```
 */
export interface SignalOptions {
    name?: string;
}

/**
 * Options for starting Temporal workflows.
 * Extends base workflow start options with custom properties.
 *
 * @example
 * ```typescript
 * const options: StartWorkflowOptions = {
 *   taskQueue: 'orders',
 *   workflowId: `order-${orderId}`,
 *   signal: {
 *     name: 'start',
 *     args: [initialData]
 *   }
 * };
 * ```
 */
export interface StartWorkflowOptions {
    taskQueue: string;
    workflowId?: string;
    signal?: {
        name: string;
        args?: unknown[];
    };
    [key: string]: unknown;
}

/**
 * Comprehensive system status including all Temporal components.
 * Used for health monitoring and system diagnostics.
 *
 * @example
 * ```typescript
 * const status = await temporalService.getSystemStatus();
 * if (!status.client.healthy || !status.worker.available) {
 *   console.warn('Temporal system is not fully operational');
 * }
 * ```
 */
export interface SystemStatus {
    client: {
        available: boolean;
        healthy: boolean;
    };
    worker: {
        available: boolean;
        status?: WorkerStatus;
        health?: string;
    };
    discovery: DiscoveryStats;
}

/**
 * Detailed status information about the Temporal worker.
 * Provides runtime metrics and health indicators.
 *
 * @example
 * ```typescript
 * const workerStatus = temporalService.getWorkerStatus();
 * if (!workerStatus.isHealthy) {
 *   console.error(`Worker error: ${workerStatus.lastError}`);
 *   await temporalService.restartWorker();
 * }
 * ```
 */
export interface WorkerStatus {
    isInitialized: boolean;
    isRunning: boolean;
    isHealthy: boolean;
    taskQueue: string;
    namespace: string;
    workflowSource: 'bundle' | 'filesystem' | 'registered' | 'none';
    activitiesCount: number;
    workflowsCount?: number;
    lastError?: string;
    startedAt?: Date;
    uptime?: number;
}

/**
 * Information about multiple workers in the system.
 * Used when managing multiple task queues.
 *
 * @example
 * ```typescript
 * const workers = temporalService.getAllWorkers();
 * workers.forEach(worker => {
 *   console.log(`Worker ${worker.taskQueue}: ${worker.status.isRunning ? 'running' : 'stopped'}`);
 * });
 * ```
 */
export interface MultipleWorkersInfo {
    workers: Map<string, WorkerStatus>;
    totalWorkers: number;
    runningWorkers: number;
    healthyWorkers: number;
}

/**
 * Result of creating a new worker dynamically.
 *
 * @example
 * ```typescript
 * const result = await temporalService.createWorker({
 *   taskQueue: 'new-queue',
 *   workflowsPath: './dist/workflows',
 *   autoStart: true
 * });
 * if (result.success) {
 *   console.log(`Worker created for queue: ${result.taskQueue}`);
 * }
 * ```
 */
export interface CreateWorkerResult {
    success: boolean;
    taskQueue: string;
    error?: Error;
    worker?: Worker;
}

/**
 * Individual worker instance with metadata
 * Internal structure used by TemporalWorkerManagerService
 */
export interface WorkerInstance {
    worker: Worker;
    taskQueue: string;
    namespace: string;
    isRunning: boolean;
    isInitialized: boolean;
    lastError: string | null;
    startedAt: Date | null;
    restartCount: number;
    activities: Map<string, Function>;
    workflowSource: 'bundle' | 'filesystem' | 'registered' | 'none';
}

/**
 * Metadata for signal methods discovered through @SignalMethod decorator.
 */
export interface SignalMethodMetadata {
    signalName: string;
    methodName: string;
}

/**
 * Metadata for query methods discovered through @QueryMethod decorator.
 */
export interface QueryMethodMetadata {
    queryName: string;
    methodName: string;
}

/**
 * Metadata for child workflows injected through @ChildWorkflow decorator.
 */
export interface ChildWorkflowMetadata {
    workflowType: string | Type<unknown>;
    options?: Record<string, string | number | boolean | object>;
    propertyKey: string | symbol;
}

/**
 * Function signature for activity method handlers.
 * Can be synchronous or asynchronous.
 */
export type ActivityMethodHandler = (...args: unknown[]) => Promise<unknown> | unknown;

/**
 * Function signature for query method handlers.
 * Must be synchronous and return immediately.
 */
export type QueryMethodHandler = (...args: unknown[]) => unknown;

/**
 * Function signature for signal method handlers.
 * Can be synchronous or asynchronous but returns void.
 */
export type SignalMethodHandler = (...args: unknown[]) => void | Promise<void>;

/**
 * Configuration options for activity module initialization.
 * Extends LoggerConfig with activity-specific settings.
 */
export interface ActivityModuleOptions extends LoggerConfig {
    activityClasses?: Array<Type<unknown>>;
    timeout?: string | number;
    global?: boolean;
}

/**
 * Comprehensive information about discovered activity classes.
 * Contains class metadata and all associated methods.
 *
 * @example
 * ```typescript
 * const activityInfo = activityService.getActivityInfo('EmailActivities');
 * console.log(`${activityInfo.className} has ${activityInfo.totalMethods} methods`);
 * ```
 */
export interface ActivityInfo {
    className: string;
    instance: Record<string, unknown>;
    targetClass: Type<unknown>;
    methods: Array<{
        name: string;
        methodName: string;
        options: ActivityMethodOptions;
    }>;
    totalMethods: number;
}

/**
 * Extended information about signal methods with class context.
 * Used internally for signal method management.
 */
export interface ExtendedSignalMethodInfo {
    className: string;
    signalName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: Record<string, unknown>;
}

/**
 * Extended information about query methods with class context.
 * Used internally for query method management.
 */
export interface ExtendedQueryMethodInfo {
    className: string;
    queryName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: Record<string, unknown>;
    options?: Record<string, string | number | boolean | object>;
}

/**
 * Information about child workflows injected into parent workflows.
 * Contains metadata for @ChildWorkflow decorated properties.
 */
export interface ChildWorkflowInfo {
    className: string;
    propertyKey: string | symbol;
    workflowType: Type<unknown>;
    options?: Record<string, string | number | boolean | object>;
    instance: Record<string, unknown>;
}

/**
 * Generic function type for activity methods
 */
export type ActivityFunction = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Activity method metadata with proper typing
 */
export interface ActivityMethodInfo {
    methodName: string;
    name: string;
    metadata: ActivityMethodOptions;
}

/**
 * Activity context for execution
 */
export interface ActivityContext {
    activityType: string;
    className?: string;
    methodName?: string;
    executionId?: string;
    timestamp?: Date;
}

/**
 * Schedule specification — extends Temporal SDK's `ScheduleSpec` from
 * `@temporalio/client`. Defines when actions should be taken (calendars,
 * intervals, cron expressions, timezone, jitter, etc.).
 *
 * `intervals[].every`, `intervals[].offset`, and `jitter` are typed loosely
 * as `Duration | string | number` so prior user code using plain strings still
 * compiles. `timezones?: string[]` is retained as a deprecated alias for
 * `timezone`.
 */
export type ScheduleSpec = Omit<SdkScheduleSpec, 'intervals' | 'jitter'> & {
    /** Interval-based specifications of times. */
    intervals?: Array<{ every: Duration | string | number; offset?: Duration | string | number }>;
    /**
     * All times will be incremented by a random value from 0 to this amount of jitter.
     * @format Duration (ms-formatted string or number of milliseconds)
     */
    jitter?: Duration | string | number;
    /**
     * @deprecated Use `timezone` (singular) from the SDK. Kept for backward
     * compatibility; at runtime the first entry is used as `timezone`.
     */
    timezones?: string[];
};

/**
 * Schedule action — Temporal SDK's `ScheduleOptionsAction` from `@temporalio/client`
 * extended with the back-compat `retryPolicy` alias. Currently only `startWorkflow`
 * actions are supported (matches the SDK).
 */
export type ScheduleAction = ScheduleOptionsAction & {
    /**
     * @deprecated Use `retry`. Kept for backward compatibility; forwarded to
     * `retry` at runtime. Typed loosely so prior `Record<string, unknown>`
     * usages still compile.
     */
    retryPolicy?: RetryPolicy | Record<string, unknown>;
};

/**
 * Workflow start options aligned with Temporal's official SDK types.
 *
 * `taskQueue` is optional here because the module-level default is applied by
 * `TemporalClientService` when omitted. All other fields map 1:1 to Temporal's
 * `WorkflowStartOptions` from `@temporalio/client`.
 */
export interface WorkflowStartOptions {
    workflowId?: string;
    taskQueue?: string;
    /** Typed search attributes — maps to `typedSearchAttributes` in Temporal's SDK. */
    searchAttributes?: TypedSearchAttributes;
    /** Freeform workflow annotations. Temporal accepts `Record<string, unknown>`. */
    memo?: Record<string, unknown>;
    /** Use `WorkflowIdReusePolicy` enum from `@temporalio/client`. */
    workflowIdReusePolicy?: WorkflowIdReusePolicy;
    workflowExecutionTimeout?: Duration;
    workflowRunTimeout?: Duration;
    workflowTaskTimeout?: Duration;
    /** Retry policy for the workflow execution. */
    retryPolicy?: RetryPolicy;
}

/**
 * Health status types
 */
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

/**
 * Service health information
 */
export interface ServiceHealth {
    status: HealthStatus;
    details?: Record<string, string | number | boolean | object>;
    timestamp?: Date;
}

/**
 * Statistics information
 */
export interface ServiceStats {
    activities: {
        classes: number;
        methods: number;
        total: number;
    };
    schedules: number;
    discoveries: DiscoveryStats;
    worker: WorkerStatus;
    client: ServiceHealth;
}

/**
 * Overlap policy for schedules
 */
export type OverlapPolicy =
    | 'skip'
    | 'buffer_one'
    | 'buffer_all'
    | 'cancel_other'
    | 'terminate_other'
    | 'allow_all';

/**
 * Temporal overlap policy (uppercase format)
 */
export type TemporalOverlapPolicy =
    | 'SKIP'
    | 'BUFFER_ONE'
    | 'BUFFER_ALL'
    | 'CANCEL_OTHER'
    | 'TERMINATE_OTHER'
    | 'ALLOW_ALL';

/**
 * Generic metadata type for reflection
 */
export interface MetadataInfo {
    [key: string]: string | number | boolean | object | null;
}

/**
 * Activity wrapper function type
 */
export type ActivityWrapper = (...args: unknown[]) => Promise<unknown>;

/**
 * Instance type for NestJS providers
 */
export interface ProviderInstance {
    [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * NestJS wrapper interface for discovery service
 */
export interface NestJSWrapper {
    instance?: Record<string, unknown>;
    metatype?: new (...args: unknown[]) => Record<string, unknown>;
}

/**
 * Instance with constructor interface for activity discovery
 */
export interface InstanceWithConstructor {
    constructor: new (...args: unknown[]) => Record<string, unknown>;
}

/**
 * Discovered activity information for discovery service
 */
export interface DiscoveredActivity {
    name: string;
    className: string;
    method: ActivityMethodInfo | ActivityMethodHandler;
    instance: Record<string, unknown>;
    handler: ActivityMethodHandler;
}

/**
 * Signal configuration for workflow start options
 */
export interface WorkflowSignalConfig {
    name: string;
    args?: unknown[];
}

/**
 * Workflow handle with additional metadata, generic on the workflow function type `T`.
 *
 * When `T` is known (e.g. inside `IWorkflowProxy<T>`), `result()` returns
 * `Promise<WorkflowResultType<T>>` and signal/query methods are fully typed.
 * Defaults to the base `Workflow` type for untyped call sites (e.g. `TemporalClientService`).
 */
export type WorkflowHandleWithMetadata<T extends Workflow = Workflow> = WorkflowHandle<T> & {
    handle: WorkflowHandle<T>;
};

/**
 * Client service status information
 */
export interface ClientServiceStatus {
    available: boolean;
    healthy: boolean;
    initialized: boolean;
    lastHealthCheck: Date | null;
    namespace: string;
}

/**
 * Client health status
 */
export interface ClientHealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
}

/**
 * Generic client type for dependency injection
 */
export interface GenericClient {
    workflow: {
        start: (
            type: string,
            options: Record<string, string | number | boolean | object>,
        ) => Promise<import('@temporalio/client').WorkflowHandle>;
        getHandle: (id: string, runId?: string) => import('@temporalio/client').WorkflowHandle;
    };
}

/**
 * Schedule description — re-exports Temporal SDK's `ScheduleDescription` from
 * `@temporalio/client`. Returned by `ScheduleHandle.describe()`.
 */
export type ScheduleDescription = SdkScheduleDescription;

// ==========================================
// Discovery Service Interfaces
// ==========================================

/**
 * Discovery service statistics
 */
export interface DiscoveryServiceStats {
    methods: number;
    activities: number;
    totalComponents: number;
}

/**
 * Discovery service health status
 */
export interface DiscoveryHealthStatus {
    isComplete: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    discoveredItems?: {
        activities: number;
    };
    lastDiscovery?: Date | null;
    discoveryDuration?: number | null;
    totalComponents?: number;
}

/**
 * Discovery service configuration
 */
export interface DiscoveryServiceConfig {
    enableLogging: boolean;
    logLevel: LogLevel;
    activityClasses: Array<Type<unknown>>;
}

/**
 * Component discovery result
 */
export interface ComponentDiscoveryResult {
    success: boolean;
    discoveredCount: number;
    errors: Array<{
        component: string;
        error: string;
    }>;
    duration: number;
}

/**
 * Activity method validation result
 */
export interface ActivityMethodValidationResult {
    isValid: boolean;
    issues: string[];
    warnings?: string[];
}

/**
 * Discovery service options
 */
export interface DiscoveryServiceOptions {
    enableLogger?: boolean;
    logLevel?: LogLevel;
    activityClasses?: Array<Type<unknown>>;
    validateOnDiscovery?: boolean;
    cacheResults?: boolean;
}

/**
 * Wrapper processing result
 */
export interface WrapperProcessingResult {
    success: boolean;
    processedCount: number;
    errors: Array<{
        component: string;
        error: string;
    }>;
}

/**
 * Activity discovery context
 */
export interface ActivityDiscoveryContext {
    className: string;
    instance: Record<string, unknown>;
    metatype: Type<unknown>;
    validationResult?: ActivityMethodValidationResult;
}

// ==========================================
// Metadata Service Interfaces
// ==========================================

/**
 * Activity method metadata result
 */
export interface ActivityMethodMetadataResult {
    name: string;
    originalName: string;
    methodName: string;
    className: string;
    options?: Record<string, unknown>;
    handler?: Function;
}

/**
 * Activity metadata extraction result
 */
export interface ActivityMetadataExtractionResult {
    success: boolean;
    methods: Map<string, ActivityMethodMetadataResult>;
    errors: Array<{
        method: string;
        error: string;
    }>;
    extractedCount: number;
}

/**
 * Activity class validation result
 */
export interface ActivityClassValidationResult {
    isValid: boolean;
    issues: string[];
    warnings?: string[];
    className?: string;
    methodCount?: number;
}

/**
 * Metadata validation result
 */
export interface MetadataValidationResult {
    isValid: boolean;
    missing: string[];
    present: string[];
    target: string;
}

/**
 * Activity info result
 */
export interface ActivityInfoResult {
    className: string;
    isActivity: boolean;
    activityName: string | null;
    methodNames: string[];
    metadata: unknown;
    activityOptions: unknown;
    methodCount: number;
}

/**
 * Cache statistics result
 */
export interface CacheStatsResult {
    size: number;
    entries: string[];
    message?: string;
    note?: string;
    hitRate?: number;
    missRate?: number;
}

/**
 * Signal method extraction result
 */
export interface SignalMethodExtractionResult {
    success: boolean;
    methods: Record<string, string>;
    errors: Array<{
        method: string;
        error: string;
    }>;
}

/**
 * Query method extraction result
 */
export interface QueryMethodExtractionResult {
    success: boolean;
    methods: Record<string, string>;
    errors: Array<{
        method: string;
        error: string;
    }>;
}

/**
 * Child workflow extraction result
 */
export interface ChildWorkflowExtractionResult {
    success: boolean;
    workflows: Record<string, unknown>;
    errors: Array<{
        workflow: string;
        error: string;
    }>;
}

/**
 * Metadata extraction options
 */
export interface MetadataExtractionOptions {
    includeOptions?: boolean;
    validateMethods?: boolean;
    cacheResults?: boolean;
    strictMode?: boolean;
}

/**
 * Activity method extraction context
 */
export interface ActivityMethodExtractionContext {
    instance: unknown;
    className: string;
    methodName: string;
    prototype: object;
    metadata: unknown;
}

// ==========================================
// Schedule Service Interfaces
// ==========================================

/**
 * Schedule creation options — user-facing input for `TemporalScheduleService.createSchedule`.
 * `spec` and `action` are typed against the Temporal SDK directly. `searchAttributes`
 * and `catchupWindow` are intentionally loose for backward compatibility.
 */
export interface ScheduleCreationOptions {
    scheduleId: string;
    spec: ScheduleSpec;
    action: ScheduleAction;
    memo?: Record<string, unknown>;
    /**
     * Search attributes. Values are arrays of string/number/Date/boolean
     * (matches Temporal's legacy `SearchAttributes` shape). Typed loosely
     * here for backward compatibility.
     */
    searchAttributes?: Record<string, unknown>;
    paused?: boolean;
    overlapPolicy?:
        | 'skip'
        | 'buffer_one'
        | 'buffer_all'
        | 'cancel_other'
        | 'terminate_other'
        | 'allow_all';
    catchupWindow?: string | number;
    pauseOnFailure?: boolean;
    /** Informative message — forwarded to Temporal's `state.note`. */
    description?: string;
    /**
     * Limit on number of actions. @deprecated Was not applied in prior releases;
     * continues to be a no-op for backward compatibility. Set
     * `state.remainingActions` via the SDK directly if you need this behavior.
     */
    limitedActions?: number;
}

/**
 * Schedule creation result
 */
export interface ScheduleCreationResult {
    success: boolean;
    scheduleId?: string;
    handle?: ScheduleHandle;
    error?: Error;
}

/**
 * Schedule retrieval result
 */
export interface ScheduleRetrievalResult {
    success: boolean;
    handle?: ScheduleHandle;
    error?: Error;
}

/**
 * Schedule service status
 */
export interface ScheduleServiceStatus {
    available: boolean;
    healthy: boolean;
    schedulesSupported: boolean;
    initialized: boolean;
}

/**
 * Schedule service health
 */
export interface ScheduleServiceHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    schedulesCount: number;
    isInitialized: boolean;
    details: Record<string, unknown>;
    lastError?: string;
}

/**
 * Aggregate statistics about all managed schedules.
 *
 * @example
 * ```typescript
 * const stats = scheduleService.getScheduleStats();
 * console.log(`Active schedules: ${stats.active}/${stats.total}`);
 * if (stats.errors > 0) {
 *   console.warn(`${stats.errors} schedules have errors`);
 * }
 * ```
 */
export interface ScheduleServiceStats {
    total: number;
    active: number;
    inactive: number;
    errors: number;
    lastUpdated?: Date;
}

/**
 * Schedule discovery result
 */
export interface ScheduleDiscoveryResult {
    success: boolean;
    discoveredCount: number;
    errors: Array<{
        schedule: string;
        error: string;
    }>;
    duration: number;
}

/**
 * Schedule registration result
 */
export interface ScheduleRegistrationResult {
    success: boolean;
    scheduleId: string;
    handle?: ScheduleHandle;
    error?: Error;
}

/**
 * Schedule metadata validation result
 */
export interface ScheduleMetadataValidationResult {
    isValid: boolean;
    issues: string[];
    warnings?: string[];
    scheduleId?: string;
}

/**
 * Schedule client initialization result
 */
export interface ScheduleClientInitResult {
    success: boolean;
    client?: ScheduleClient;
    error?: Error;
    source: 'existing' | 'new' | 'none';
}

/**
 * Schedule workflow options. `retryPolicy` is loosely typed for backward
 * compatibility; prefer the SDK's `RetryPolicy` shape.
 */
export interface ScheduleWorkflowOptions {
    taskQueue?: string;
    workflowId?: string;
    workflowExecutionTimeout?: Duration;
    workflowRunTimeout?: Duration;
    workflowTaskTimeout?: Duration;
    retryPolicy?: RetryPolicy | Record<string, unknown>;
    args?: unknown[];
}

/**
 * Schedule specification builder result
 */
export interface ScheduleSpecBuilderResult {
    success: boolean;
    spec?: Partial<ScheduleSpec>;
    error?: Error;
}

/**
 * Schedule interval parsing result — a single entry shaped like Temporal SDK's `IntervalSpec`.
 */
export interface ScheduleIntervalParseResult {
    success: boolean;
    interval?: { every: Duration };
    error?: Error;
}

/**
 * Temporal connection interface for schedule client
 */
export interface TemporalConnection {
    address: string;
    namespace?: string;
    tls?: boolean | object;
    metadata?: Record<string, string>;
}

/**
 * Schedule workflow action — Temporal SDK's `ScheduleOptionsStartWorkflowAction<Workflow>`
 * extended with a back-compat `retryPolicy` alias.
 *
 * Prefer SDK's `retry` field. The legacy `retryPolicy` field is accepted and
 * forwarded to `retry` at runtime.
 */
export type ScheduleWorkflowAction = ScheduleOptionsStartWorkflowAction<Workflow> & {
    /**
     * @deprecated Use `retry` (maps to Temporal's `RetryPolicy`). Kept for
     * backward compatibility; at runtime this is forwarded to `retry`. Typed
     * loosely so prior `Record<string, unknown>` usages still compile.
     */
    retryPolicy?: RetryPolicy | Record<string, unknown>;
};

/**
 * Schedule options — re-exports Temporal SDK's `ScheduleOptions` from
 * `@temporalio/client`. This is the exact shape consumed by `ScheduleClient.create()`.
 */
export type ScheduleOptions = SdkScheduleOptions;

/**
 * Worker connection options interface
 */
export interface WorkerConnectionOptions {
    address: string;
    tls?: boolean | object;
    metadata?: Record<string, string>;
    apiKey?: string;
    namespace?: string;
}

/**
 * Worker configuration — Temporal SDK's `WorkerOptions` from `@temporalio/worker`
 * with `namespace`, `connection`, and `activities` required (as they were in
 * prior versions of this package).
 */
export type WorkerConfig = WorkerOptions & {
    namespace: string;
    connection: NativeConnection;
    activities: Record<string, Function>;
};

/**
 * Worker initialization result
 */
export interface WorkerInitResult {
    success: boolean;
    worker?: Worker;
    error?: Error;
    activitiesCount: number;
    taskQueue: string;
    namespace: string;
}

/**
 * Worker restart result
 */
export interface WorkerRestartResult {
    success: boolean;
    error?: Error;
    restartCount: number;
    maxRestarts: number;
}

/**
 * Worker shutdown result
 */
export interface WorkerShutdownResult {
    success: boolean;
    error?: Error;
    shutdownTime: number;
}

/**
 * Worker health status
 */
export interface WorkerHealthStatus {
    isHealthy: boolean;
    isRunning: boolean;
    isInitialized: boolean;
    lastError?: string;
    uptime?: number;
    activitiesCount: number;
    restartCount: number;
    maxRestarts: number;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
    isInitialized: boolean;
    isRunning: boolean;
    activitiesCount: number;
    restartCount: number;
    maxRestarts: number;
    uptime?: number;
    startedAt?: Date;
    lastError?: string;
    taskQueue: string;
    namespace: string;
    workflowSource: 'bundle' | 'filesystem' | 'registered' | 'none';
}

/**
 * Activity registration result
 */
export interface ActivityRegistrationResult {
    success: boolean;
    registeredCount: number;
    errors: Array<{ activityName: string; error: string }>;
}

/**
 * Worker discovery result
 */
export interface WorkerDiscoveryResult {
    success: boolean;
    discoveredActivities: number;
    loadedActivities: number;
    errors: Array<{ name: string; error: string }>;
    duration: number;
}

/**
 * Temporal service initialization result
 */
export interface TemporalServiceInitResult {
    success: boolean;
    error?: Error;
    servicesInitialized: {
        client: boolean;
        worker: boolean;
        schedule: boolean;
        discovery: boolean;
        metadata: boolean;
    };
    initializationTime: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: Error;
    workflowId?: string;
    runId?: string;
    executionTime?: number;
}

/**
 * Workflow signal result
 */
export interface WorkflowSignalResult {
    success: boolean;
    error?: Error;
    workflowId: string;
    signalName: string;
}

/**
 * Workflow query result
 */
export interface WorkflowQueryResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: Error;
    workflowId: string;
    queryName: string;
}

/**
 * Workflow termination result
 */
export interface WorkflowTerminationResult {
    success: boolean;
    error?: Error;
    workflowId: string;
    reason?: string;
}

/**
 * Workflow cancellation result
 */
export interface WorkflowCancellationResult {
    success: boolean;
    error?: Error;
    workflowId: string;
}

/**
 * Activity execution result (enhanced)
 */
export interface ActivityExecutionResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: Error;
    activityName: string;
    executionTime?: number;
    args?: unknown[];
}

/**
 * Service health status (enhanced)
 */
export interface ServiceHealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    isInitialized: boolean;
    lastError?: string;
    uptime?: number;
    details?: Record<string, unknown>;
}

/**
 * Component health status
 */
export interface ComponentHealthStatus {
    client: ServiceHealthStatus;
    worker: ServiceHealthStatus;
    schedule: ServiceHealthStatus;
    activity: ServiceHealthStatus;
    discovery: ServiceHealthStatus;
}

/**
 * Overall health status
 */
export interface OverallHealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    components: ComponentHealthStatus;
    isInitialized: boolean;
    namespace: string;
    summary: {
        totalActivities: number;
        totalSchedules: number;
        workerRunning: boolean;
        clientConnected: boolean;
    };
    timestamp: Date;
}

/**
 * Service statistics (enhanced)
 */
export interface ServiceStatistics {
    activities: {
        classes: number;
        methods: number;
        total: number;
        registered: number;
        available: number;
    };
    schedules: {
        total: number;
        active: number;
        paused: number;
    };
    worker: {
        isRunning: boolean;
        isHealthy: boolean;
        activitiesCount: number;
        uptime?: number;
    };
    client: {
        isConnected: boolean;
        isHealthy: boolean;
        namespace: string;
    };
    discovery: {
        isComplete: boolean;
        discoveredCount: number;
        errors: number;
    };
}

/**
 * Service initialization options
 */
export interface ServiceInitOptions {
    waitForServices?: boolean;
    maxWaitTime?: number;
    retryAttempts?: number;
    retryDelay?: number;
}

/**
 * Service shutdown options
 */
export interface ServiceShutdownOptions {
    graceful?: boolean;
    timeout?: number;
    stopWorker?: boolean;
}

/**
 * Service shutdown result
 */
export interface ServiceShutdownResult {
    success: boolean;
    error?: Error;
    shutdownTime: number;
    servicesShutdown: {
        worker: boolean;
        client: boolean;
        schedule: boolean;
    };
}

/**
 * Health response interface for the health controller
 */
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    client: {
        available: boolean;
        healthy: boolean;
        connected: boolean;
    };
    worker: {
        available: boolean;
        running: boolean;
        healthy: boolean;
        activitiesCount: number;
    };
    discovery: {
        activities: number;
        complete: boolean;
        discoveredCount: number;
    };
    schedules: {
        total: number;
        active: number;
        paused: number;
    };
    metadata: {
        classes: number;
        methods: number;
        total: number;
    };
    summary: {
        totalComponents: number;
        healthyComponents: number;
        degradedComponents: number;
        unhealthyComponents: number;
    };
}
