// Re-exports from external packages
export { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';
export { ScheduleOverlapPolicy, WorkflowHandle, Client } from '@temporalio/client';
export { Worker } from '@temporalio/worker';

import { Type } from '@nestjs/common';

// ==========================================
// Core Configuration Interfaces
// ==========================================
export interface ClientConnectionOptions {
    address: string;
    tls?: unknown;
    metadata?: Record<string, string>;
    apiKey?: string;
    namespace?: string;
}

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

export interface RetryPolicyConfig {
    maximumAttempts: number;
    initialInterval: string;
    maximumInterval: string;
    backoffCoefficient: number;
}

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
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface GlobalLoggerConfig extends LoggerConfig {
    appName?: string;
    formatter?: (level: string, message: string, context: string, timestamp: string) => string;
    logToFile?: boolean;
    logFilePath?: string;
}

export interface LoggerConfig {
    enableLogger?: boolean;
    logLevel?: LogLevel;
}

// ==========================================
// Async Module Registration
// ==========================================
export interface TemporalOptionsFactory {
    createTemporalOptions(): Promise<TemporalOptions> | TemporalOptions;
}

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
export interface ActivityMethodMetadata {
    name: string;
    originalName: string;
    options?: Record<string, unknown>;
    handler: ActivityMethodHandler;
}

export interface ActivityMethodOptions {
    name?: string;
    timeout?: string | number;
    maxRetries?: number;
}

export interface ActivityMetadata {
    name?: string;
    options?: Record<string, unknown>;
}

export interface ActivityOptions {
    name?: string;
}

export interface CronOptions extends Omit<ScheduledOptions, 'cron' | 'interval'> {
    scheduleId: string;
}

export interface DiscoveryStats {
    controllers: number;
    methods: number;
    scheduled: number;
    signals: number;
    queries: number;
    workflows: number;
    childWorkflows: number;
}

export interface IntervalOptions extends Omit<ScheduledOptions, 'cron' | 'interval'> {
    scheduleId: string;
}

export interface QueryMethodInfo {
    methodName: string;
    queryName: string;
    options: QueryOptions;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

export interface QueryOptions {
    name?: string;
}

export interface ScheduledMethodInfo {
    methodName: string;
    workflowName: string;
    scheduleOptions: ScheduledOptions;
    workflowOptions: StartWorkflowOptions;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    controllerInfo: {
        name: string;
        instance: object;
    };
}

export interface ScheduledOptions {
    scheduleId: string;
    cron?: string;
    interval?: string;
    description?: string;
    taskQueue?: string;
    timezone?: string;
    overlapPolicy?: 'ALLOW_ALL' | 'SKIP' | 'BUFFER_ONE' | 'BUFFER_ALL' | 'CANCEL_OTHER';
    startPaused?: boolean;
    autoStart?: boolean;
}

export interface ScheduleInfo {
    scheduleId: string;
    workflowName: string;
    cronExpression?: string;
    intervalExpression?: string;
    description?: string;
    timezone: string;
    overlapPolicy: 'ALLOW_ALL' | 'SKIP' | 'BUFFER_ONE' | 'BUFFER_ALL' | 'CANCEL_OTHER';
    isActive: boolean;
    autoStart: boolean;
    taskQueue?: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    controllerInfo: {
        name: string;
        instance: object;
    };
    createdAt: Date;
    lastTriggered?: Date;
    lastModified?: Date;
    nextRun?: Date;
    triggerCount?: number;
    lastError?: string;
}

export interface ScheduleStatus {
    scheduleId: string;
    workflowName: string;
    isManaged: boolean;
    isActive: boolean;
    lastError?: string;
    createdAt: Date;
    lastUpdatedAt: Date;
}

export interface ScheduleStats {
    total: number;
    active: number;
    inactive: number;
    errors: number;
}

export interface SignalMethodInfo {
    methodName: string;
    signalName: string;
    options?: Record<string, unknown>;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

export interface SignalOptions {
    name?: string;
}

export interface StartWorkflowOptions {
    taskQueue: string;
    workflowId?: string;
    signal?: {
        name: string;
        args?: unknown[];
    };
    [key: string]: unknown;
}

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
    schedules: ScheduleStats;
}

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

export interface WorkflowOptions {
    name?: string;
    description?: string;
}

export interface WorkflowMetadata {
    name?: string;
    description?: string;
    className?: string;
}

export interface WorkflowRunMetadata {
    methodName: string;
}

export interface SignalMethodMetadata {
    signalName: string;
    methodName: string;
}

export interface QueryMethodMetadata {
    queryName: string;
    methodName: string;
}

export interface ChildWorkflowMetadata {
    workflowType: unknown;
    options?: Record<string, unknown>;
    propertyKey: string | symbol;
}

// ==========================================
// Handler Types
// ==========================================
export type ActivityMethodHandler = (...args: unknown[]) => unknown | Promise<unknown>;
export type QueryMethodHandler = (...args: unknown[]) => unknown;
export type SignalMethodHandler = (...args: unknown[]) => void | Promise<void>;

export interface ActivityModuleOptions extends LoggerConfig {
    activityClasses?: Array<Type<unknown>>;
    timeout?: string | number;
    global?: boolean;
}

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

export interface WorkflowRunInfo {
    className: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

export interface SignalMethodInfo {
    className: string;
    signalName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

export interface QueryMethodInfo {
    className: string;
    queryName: string;
    methodName: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
    instance: object;
}

export interface ChildWorkflowInfo {
    className: string;
    propertyKey: string | symbol;
    workflowType: Type<unknown>;
    options?: Record<string, unknown>;
    instance: object;
}
