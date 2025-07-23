// Re-exports from external packages
export { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';
export { WorkflowHandle, Client } from '@temporalio/client';
export { Worker } from '@temporalio/worker';

import { Type } from '@nestjs/common';

// ==========================================
// Core Configuration Interfaces
// ==========================================

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
export interface ClientConnectionOptions {
    address: string;
    tls?: unknown;
    metadata?: Record<string, string>;
    apiKey?: string;
    namespace?: string;
}

/**
 * Enhanced connection options with TLS support for Temporal server.
 * Supports both simple boolean TLS and advanced certificate configuration.
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
export interface ConnectionOptions {
    address: string;
    tls?:
        | boolean
        | {
              serverName?: string;
              clientCertPair?: {
                  crt: Buffer;
                  key: Buffer;
                  ca?: Buffer;
              };
          };
    apiKey?: string;
    metadata?: Record<string, string>;
}

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
 * Main configuration options for Temporal module initialization.
 * Supports both client-only and worker configurations.
 *
 * @example Basic Setup
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
 *     autoStart: true
 *   }
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
    connection: {
        address: string;
        namespace?: string;
        tls?: ConnectionOptions['tls'];
        apiKey?: string;
        metadata?: Record<string, string>;
    };
    taskQueue?: string;
    worker?: {
        workflowsPath?: string;
        workflowBundle?: unknown;
        activityClasses?: Array<Type<unknown>>;
        autoStart?: boolean;
        workerOptions?: WorkerCreateOptions;
    };
    isGlobal?: boolean;
    allowConnectionFailure?: boolean;
}

/**
 * Advanced configuration options for Temporal Worker creation.
 * Controls worker behavior, concurrency, and performance settings.
 *
 * @example Production Configuration
 * ```typescript
 * const workerOptions: WorkerCreateOptions = {
 *   maxConcurrentActivityTaskExecutions: 100,
 *   maxConcurrentWorkflowTaskExecutions: 50,
 *   maxActivitiesPerSecond: 200,
 *   enableLoggingInReplay: false,
 *   identity: 'production-worker-1'
 * };
 * ```
 */
export interface WorkerCreateOptions {
    maxConcurrentActivityTaskExecutions?: number;
    maxConcurrentWorkflowTaskExecutions?: number;
    maxConcurrentLocalActivityExecutions?: number;
    maxActivitiesPerSecond?: number;
    reuseV8Context?: boolean;
    identity?: string;
    buildId?: string;
    maxCachedWorkflows?: number;
    maxConcurrentWorkflowTaskPolls?: number;
    maxConcurrentActivityTaskPolls?: number;
    enableLoggingInReplay?: boolean;
}

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
    workflowBundle?: unknown;
    activityClasses?: Array<unknown>;
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
    inject?: unknown[];
    imports?: unknown[];
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
    options?: Record<string, unknown>;
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
    options?: Record<string, unknown>;
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
export interface ScheduleStats {
    total: number;
    active: number;
    inactive: number;
    errors: number;
}

/**
 * Information about signal methods discovered in workflow classes.
 * Contains method details and handler function.
 */
export interface SignalMethodInfo {
    methodName: string;
    signalName: string;
    options?: Record<string, unknown>;
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
    workflowSource: 'bundle' | 'filesystem' | 'none';
    activitiesCount: number;
    lastError?: string;
    startedAt?: Date;
    uptime?: number;
}

/**
 * Options for configuring workflow classes via @Workflow decorator.
 *
 * @example
 * ```typescript
 * @Workflow({
 *   name: 'order-processing',
 *   description: 'Handles complete order lifecycle'
 * })
 * export class OrderWorkflow {
 *   // Workflow implementation
 * }
 * ```
 */
export interface WorkflowOptions {
    name?: string;
    description?: string;
}

/**
 * Metadata for workflow classes discovered through @Workflow decorator.
 */
export interface WorkflowMetadata {
    name?: string;
    description?: string;
    className?: string;
}

/**
 * Metadata for workflow run methods marked with @WorkflowRun decorator.
 */
export interface WorkflowRunMetadata {
    methodName: string;
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
    workflowType: unknown;
    options?: Record<string, unknown>;
    propertyKey: string | symbol;
}

// ==========================================
// Handler Types
// ==========================================

/**
 * Function signature for activity method handlers.
 * Can be synchronous or asynchronous.
 */
export type ActivityMethodHandler = (...args: unknown[]) => unknown | Promise<unknown>;

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
    instance: object;
    targetClass: Type<unknown>;
    methods: Array<{
        name: string;
        methodName: string;
        options: ActivityMethodOptions;
    }>;
    totalMethods: number;
}

/**
 * Information about workflow run methods discovered in workflow classes.
 */
export interface WorkflowRunInfo {
    className: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

/**
 * Extended information about signal methods with class context.
 * Used internally for signal method management.
 */
export interface SignalMethodInfo {
    className: string;
    signalName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

/**
 * Extended information about query methods with class context.
 * Used internally for query method management.
 */
export interface QueryMethodInfo {
    className: string;
    queryName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

/**
 * Information about child workflows injected into parent workflows.
 * Contains metadata for @ChildWorkflow decorated properties.
 */
export interface ChildWorkflowInfo {
    className: string;
    propertyKey: string | symbol;
    workflowType: Type<unknown>;
    options?: Record<string, unknown>;
    instance: object;
}
