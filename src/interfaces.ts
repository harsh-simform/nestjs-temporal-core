import { ModuleMetadata, Type } from '@nestjs/common';

// ==========================================
// Re-export Temporal SDK Types
// ==========================================
export { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';
export { ScheduleOverlapPolicy, WorkflowHandle, Client } from '@temporalio/client';
export { Worker } from '@temporalio/worker';

// ==========================================
// Core Connection & Configuration
// ==========================================

export interface ConnectionOptions {
    /** Temporal server address (e.g., "localhost:7233") */
    address: string;
    /** TLS configuration */
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
    /** API key for Temporal Cloud */
    apiKey?: string;
    /** Additional HTTP headers */
    metadata?: Record<string, string>;
}

export interface TemporalOptions {
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
        workflowBundle?: any;
        activityClasses?: Array<Type<any>>;
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
    [key: string]: any;
}

// ==========================================
// Async Configuration
// ==========================================

export interface TemporalOptionsFactory {
    createTemporalOptions(): Promise<TemporalOptions> | TemporalOptions;
}

export interface TemporalAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<TemporalOptionsFactory>;
    useClass?: Type<TemporalOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<TemporalOptions> | TemporalOptions;
    inject?: any[];
    isGlobal?: boolean;
}

// ==========================================
// Signal and Query Related
// ==========================================

export interface SignalOptions {
    name?: string;
}

export interface QueryOptions {
    name?: string;
}

export interface StartWorkflowOptions {
    taskQueue: string;
    workflowId?: string;
    signal?: {
        name: string;
        args?: any[];
    };
    retry?: {
        maximumAttempts?: number;
        initialInterval?: string | number;
    };
    searchAttributes?: Record<string, unknown>;
    [key: string]: any;
}

export interface WorkflowExecutionContext {
    workflowId: string;
    runId: string;
    workflowType: string;
    taskQueue: string;
    namespace: string;
}

// ==========================================
// Activity Related
// ==========================================

export interface ActivityOptions {
    name?: string;
}

export interface ActivityMethodOptions {
    name?: string;
    timeout?: string | number;
    maxRetries?: number;
}

export interface ActivityMetadata {
    name?: string;
    options?: Record<string, any>;
}

// ==========================================
// Scheduling
// ==========================================

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

export interface CronOptions extends Omit<ScheduledOptions, 'cron' | 'interval'> {
    scheduleId: string;
}

export interface IntervalOptions extends Omit<ScheduledOptions, 'cron' | 'interval'> {
    scheduleId: string;
}

// ==========================================
// Discovery & Method Handlers
// ==========================================

export type SignalMethodHandler = (...args: any[]) => void | Promise<void>;
export type QueryMethodHandler = (...args: any[]) => any;
export type ActivityMethodHandler = (...args: any[]) => any | Promise<any>;

export interface SignalMethodInfo {
    methodName: string;
    signalName: string;
    options: any;
    handler: SignalMethodHandler;
}

export interface QueryMethodInfo {
    methodName: string;
    queryName: string;
    options: any;
    handler: QueryMethodHandler;
}

export interface ScheduledMethodInfo {
    methodName: string;
    workflowName: string;
    scheduleOptions: any;
    workflowOptions: any;
    handler: any;
    controllerInfo: any;
}

export interface ActivityMethodMetadata {
    name: string;
    originalName: string;
    options?: Record<string, any>;
    handler: ActivityMethodHandler;
}

// ==========================================
// Statistics & Status
// ==========================================

export interface DiscoveryStats {
    controllers: number;
    methods: number;
    scheduled: number;
    signals: number;
    queries: number;
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

export interface WorkflowParameterMetadata {
    type: 'param' | 'context' | 'workflowId' | 'runId' | 'taskQueue';
    index?: number;
    extractAll?: boolean;
}
