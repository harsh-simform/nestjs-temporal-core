// ==========================================
// Injection Tokens
// ==========================================
export const ACTIVITY_MODULE_OPTIONS = 'ACTIVITY_MODULE_OPTIONS';
export const SCHEDULES_MODULE_OPTIONS = 'SCHEDULES_MODULE_OPTIONS';
export const TEMPORAL_CLIENT = 'TEMPORAL_CLIENT';
export const TEMPORAL_CONNECTION = 'TEMPORAL_CONNECTION';
export const TEMPORAL_MODULE_OPTIONS = 'TEMPORAL_MODULE_OPTIONS';
export const WORKER_MODULE_OPTIONS = 'WORKER_MODULE_OPTIONS';
export const TEMPORAL_WORKFLOW_METHOD = 'TEMPORAL_WORKFLOW_METHOD';

// ==========================================
// Metadata Keys
// ==========================================
export const RUN_ID_METADATA = 'workflow:runId';
export const TASK_QUEUE_METADATA = 'workflow:taskQueue';
export const TEMPORAL_ACTIVITY = 'TEMPORAL_ACTIVITY';
export const TEMPORAL_ACTIVITY_METHOD = 'TEMPORAL_ACTIVITY_METHOD';
export const TEMPORAL_QUERY_METHOD = 'TEMPORAL_QUERY_METHOD';
export const TEMPORAL_SCHEDULED_WORKFLOW = 'TEMPORAL_SCHEDULED_WORKFLOW';
export const TEMPORAL_SIGNAL_METHOD = 'TEMPORAL_SIGNAL_METHOD';
export const TEMPORAL_WORKFLOW = 'TEMPORAL_WORKFLOW';
export const TEMPORAL_WORKFLOW_RUN = 'TEMPORAL_WORKFLOW_RUN';
export const TEMPORAL_CHILD_WORKFLOW = 'TEMPORAL_CHILD_WORKFLOW';
export const WORKFLOW_CONTEXT_METADATA = 'workflow:context';
export const WORKFLOW_ID_METADATA = 'workflow:id';
export const WORKFLOW_PARAMS_METADATA = 'workflow:params';

// ==========================================
// Default Values
// ==========================================
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;
export const DEFAULT_NAMESPACE = 'default';
export const DEFAULT_TASK_QUEUE = 'default-task-queue';

// ==========================================
// Predefined Cron Expressions
// ==========================================
export const CRON_EXPRESSIONS = Object.freeze({
    EVERY_15_MINUTES: '*/15 * * * *',
    EVERY_2_HOURS: '0 */2 * * *',
    EVERY_30_MINUTES: '*/30 * * * *',
    EVERY_5_MINUTES: '*/5 * * * *',
    EVERY_6_HOURS: '0 */6 * * *',
    EVERY_12_HOURS: '0 */12 * * *',
    EVERY_HOUR: '0 * * * *',
    EVERY_MINUTE: '* * * * *',
    DAILY_6AM: '0 6 * * *',
    DAILY_6PM: '0 18 * * *',
    DAILY_8AM: '0 8 * * *',
    DAILY_MIDNIGHT: '0 0 * * *',
    DAILY_NOON: '0 12 * * *',
    MONTHLY_FIRST: '0 0 1 * *',
    MONTHLY_LAST: '0 0 28-31 * *',
    WEEKLY_FRIDAY_5PM: '0 17 * * 5',
    WEEKLY_MONDAY_9AM: '0 9 * * 1',
    WEEKLY_SUNDAY_MIDNIGHT: '0 0 * * 0',
    YEARLY: '0 0 1 1 *',
});

// ==========================================
// Predefined Interval Expressions
// ==========================================
export const INTERVAL_EXPRESSIONS = Object.freeze({
    DAILY: '24h',
    EVERY_10_SECONDS: '10s',
    EVERY_15_MINUTES: '15m',
    EVERY_2_DAYS: '48h',
    EVERY_2_HOURS: '2h',
    EVERY_30_MINUTES: '30m',
    EVERY_30_SECONDS: '30s',
    EVERY_5_MINUTES: '5m',
    EVERY_6_HOURS: '6h',
    EVERY_12_HOURS: '12h',
    EVERY_HOUR: '1h',
    EVERY_MINUTE: '1m',
    WEEKLY: '168h',
});

// ==========================================
// Predefined Timeout Values
// ==========================================
export const TIMEOUTS = Object.freeze({
    ACTIVITY_LONG: '30m',
    ACTIVITY_MEDIUM: '5m',
    ACTIVITY_SHORT: '1m',
    CONNECTION_TIMEOUT: '10s',
    HEARTBEAT: '30s',
    QUERY_TIMEOUT: '5s',
    SIGNAL_TIMEOUT: '10s',
    STARTUP_TIMEOUT: '30s',
    WORKFLOW_LONG: '7d',
    WORKFLOW_MEDIUM: '24h',
    WORKFLOW_SHORT: '1h',
});

// ==========================================
// Retry Policy Presets
// ==========================================
export const RETRY_POLICIES = Object.freeze({
    AGGRESSIVE: {
        maximumAttempts: 10,
        initialInterval: '1s',
        maximumInterval: '300s',
        backoffCoefficient: 1.5,
    },
    CONSERVATIVE: {
        maximumAttempts: 3,
        initialInterval: '30s',
        maximumInterval: '600s',
        backoffCoefficient: 3.0,
    },
    QUICK: {
        maximumAttempts: 3,
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2.0,
    },
    STANDARD: {
        maximumAttempts: 5,
        initialInterval: '5s',
        maximumInterval: '60s',
        backoffCoefficient: 2.0,
    },
});

// ==========================================
// Enums
// ==========================================
export enum ScheduleOverlapPolicy {
    ALLOW_ALL = 'ALLOW_ALL',
    SKIP = 'SKIP',
    BUFFER_ONE = 'BUFFER_ONE',
    BUFFER_ALL = 'BUFFER_ALL',
    CANCEL_OTHER = 'CANCEL_OTHER',
}

export enum WorkflowIdConflictPolicy {
    REJECT_DUPLICATE = 'REJECT_DUPLICATE',
    TERMINATE_IF_RUNNING = 'TERMINATE_IF_RUNNING',
    ALLOW_DUPLICATE = 'ALLOW_DUPLICATE',
}

export enum WorkflowIdReusePolicy {
    ALLOW_DUPLICATE = 0,
    ALLOW_DUPLICATE_FAILED_ONLY = 1,
    REJECT_DUPLICATE = 2,
    TERMINATE_IF_RUNNING = 3,
}
