/**
 * Main entry point for nestjs-temporal-core
 * This file re-exports all public APIs from the package
 */

// Export module components and core services
export * from './client/temporal-client.module';
export * from './client/temporal-client.service';
export * from './worker/temporal-worker.module';
export * from './worker/worker-manager.service';
export * from './worker/temporal-metadata.accessor';
export * from './client/temporal-schedule.service';

// Export decorators explicitly
export * from './decorators';

// Export interface types
// Note: We're selectively re-exporting from interfaces to avoid collisions
// with constants that have the same name
export {
    // Base interfaces
    ConnectionOptions,
    ClientCertPair,
    TlsOptions,
    // Client interfaces
    TemporalClientOptions,
    TemporalClientAsyncOptions,
    TemporalClientOptionsFactory,
    StartWorkflowOptions,
    // Worker interfaces
    TemporalWorkerOptions,
    TemporalWorkerAsyncOptions,
    TemporalWorkerOptionsFactory,
    // Activity interfaces
    ActivityOptions,
    ActivityMethodOptions,
    // Workflow interfaces
    WorkflowOptions,
    WorkflowMethodOptions,
    QueryMethodOptions,
    SignalMethodOptions,
    UpdateMethodOptions,
} from './interfaces';

// Export constants without re-exporting types that would conflict with interfaces
export {
    // Module tokens
    TEMPORAL_MODULE_OPTIONS,
    TEMPORAL_CLIENT_MODULE_OPTIONS,
    TEMPORAL_WORKER_MODULE_OPTIONS,
    TEMPORAL_SCHEDULE_MODULE_OPTIONS,
    TEMPORAL_CLIENT,
    TEMPORAL_CONNECTION,
    TEMPORAL_SCHEDULE_CLIENT,
    // Activity metadata keys
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_ACTIVITY_METHOD_NAME,
    TEMPORAL_ACTIVITY_METHOD_OPTIONS,
    // Workflow metadata keys
    TEMPORAL_WORKFLOW,
    TEMPORAL_WORKFLOW_METHOD,
    TEMPORAL_WORKFLOW_METHOD_NAME,
    TEMPORAL_WORKFLOW_OPTIONS,
    // Signal metadata keys
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_SIGNAL_NAME,
    // Query metadata keys
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_QUERY_NAME,
    // Update metadata keys
    TEMPORAL_UPDATE_METHOD,
    TEMPORAL_UPDATE_NAME,
    TEMPORAL_UPDATE_VALIDATOR,
    // Default values
    DEFAULT_NAMESPACE,
    DEFAULT_TASK_QUEUE,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    // Error messages
    ERRORS,
} from './constants';

// We need to deliberately choose which version of these constants to export
// to avoid the multiple exports error. We're using the ones from constants.ts
export {
    ActivityCancellationType,
    WorkflowIdReusePolicy,
    WorkflowIdConflictPolicy,
    ChildWorkflowCancellationType,
    ParentClosePolicy,
    ScheduleOverlapPolicy,
    VersioningIntent,
} from './constants';
