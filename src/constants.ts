// ==========================================
// Module & Injection Tokens
// ==========================================
export const TEMPORAL_MODULE_OPTIONS = 'TEMPORAL_MODULE_OPTIONS';
export const TEMPORAL_CLIENT = 'TEMPORAL_CLIENT';
export const TEMPORAL_CONNECTION = 'TEMPORAL_CONNECTION';

// ==========================================
// Metadata Keys
// ==========================================
export const TEMPORAL_ACTIVITY = 'TEMPORAL_ACTIVITY';
export const TEMPORAL_ACTIVITY_METHOD = 'TEMPORAL_ACTIVITY_METHOD';
export const TEMPORAL_SIGNAL_METHOD = 'TEMPORAL_SIGNAL_METHOD';
export const TEMPORAL_QUERY_METHOD = 'TEMPORAL_QUERY_METHOD';
export const TEMPORAL_SCHEDULED_WORKFLOW = 'TEMPORAL_SCHEDULED_WORKFLOW';

// Parameter decorator metadata keys
export const WORKFLOW_PARAMS_METADATA = 'workflow:params';
export const WORKFLOW_CONTEXT_METADATA = 'workflow:context';
export const WORKFLOW_ID_METADATA = 'workflow:id';
export const RUN_ID_METADATA = 'workflow:runId';
export const TASK_QUEUE_METADATA = 'workflow:taskQueue';

// ==========================================
// Defaults
// ==========================================
export const DEFAULT_NAMESPACE = 'default';
export const DEFAULT_TASK_QUEUE = 'default-task-queue';
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

// ==========================================
// Common Cron Expressions
// ==========================================
export const CRON_EXPRESSIONS = {
    // Minutes
    EVERY_MINUTE: '* * * * *',
    EVERY_5_MINUTES: '*/5 * * * *',
    EVERY_15_MINUTES: '*/15 * * * *',
    EVERY_30_MINUTES: '*/30 * * * *',

    // Hours
    EVERY_HOUR: '0 * * * *',
    EVERY_2_HOURS: '0 */2 * * *',
    EVERY_6_HOURS: '0 */6 * * *',
    EVERY_12_HOURS: '0 */12 * * *',

    // Daily
    DAILY_MIDNIGHT: '0 0 * * *',
    DAILY_6AM: '0 6 * * *',
    DAILY_8AM: '0 8 * * *',
    DAILY_NOON: '0 12 * * *',
    DAILY_6PM: '0 18 * * *',

    // Weekly
    WEEKLY_SUNDAY_MIDNIGHT: '0 0 * * 0',
    WEEKLY_MONDAY_9AM: '0 9 * * 1',
    WEEKLY_FRIDAY_5PM: '0 17 * * 5',

    // Monthly & Yearly
    MONTHLY_FIRST: '0 0 1 * *',
    MONTHLY_LAST: '0 0 28-31 * *',
    YEARLY: '0 0 1 1 *',
} as const;

// ==========================================
// Common Interval Expressions
// ==========================================
export const INTERVAL_EXPRESSIONS = {
    // Seconds
    EVERY_10_SECONDS: '10s',
    EVERY_30_SECONDS: '30s',

    // Minutes
    EVERY_MINUTE: '1m',
    EVERY_5_MINUTES: '5m',
    EVERY_15_MINUTES: '15m',
    EVERY_30_MINUTES: '30m',

    // Hours
    EVERY_HOUR: '1h',
    EVERY_2_HOURS: '2h',
    EVERY_6_HOURS: '6h',
    EVERY_12_HOURS: '12h',

    // Days
    DAILY: '24h',
    EVERY_2_DAYS: '48h',
    WEEKLY: '168h',
} as const;

// ==========================================
// Common Timeout Values
// ==========================================
export const TIMEOUTS = {
    // Short operations
    HEARTBEAT: '30s',
    SIGNAL_TIMEOUT: '10s',
    QUERY_TIMEOUT: '5s',

    // Medium operations
    ACTIVITY_SHORT: '1m',
    ACTIVITY_MEDIUM: '5m',
    ACTIVITY_LONG: '30m',

    // Long operations
    WORKFLOW_SHORT: '1h',
    WORKFLOW_MEDIUM: '24h',
    WORKFLOW_LONG: '7d',

    // Connection timeouts
    CONNECTION_TIMEOUT: '10s',
    STARTUP_TIMEOUT: '30s',
} as const;

// ==========================================
// Retry Policy Presets
// ==========================================
export const RETRY_POLICIES = {
    // Quick retry for transient failures
    QUICK: {
        maximumAttempts: 3,
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2.0,
    },

    // Standard retry policy
    STANDARD: {
        maximumAttempts: 5,
        initialInterval: '5s',
        maximumInterval: '60s',
        backoffCoefficient: 2.0,
    },

    // Aggressive retry for critical operations
    AGGRESSIVE: {
        maximumAttempts: 10,
        initialInterval: '1s',
        maximumInterval: '300s',
        backoffCoefficient: 1.5,
    },

    // Conservative retry for expensive operations
    CONSERVATIVE: {
        maximumAttempts: 3,
        initialInterval: '30s',
        maximumInterval: '600s',
        backoffCoefficient: 3.0,
    },
} as const;

// ==========================================
// Worker Configuration Presets
// ==========================================
export const WORKER_PRESETS = {
    // Development environment
    DEVELOPMENT: {
        maxConcurrentActivityTaskExecutions: 10,
        maxConcurrentWorkflowTaskExecutions: 5,
        maxConcurrentLocalActivityExecutions: 10,
        reuseV8Context: false, // Better for debugging
    },

    // Production environment - balanced
    PRODUCTION_BALANCED: {
        maxConcurrentActivityTaskExecutions: 100,
        maxConcurrentWorkflowTaskExecutions: 40,
        maxConcurrentLocalActivityExecutions: 100,
        reuseV8Context: true,
    },

    // Production environment - high throughput
    PRODUCTION_HIGH_THROUGHPUT: {
        maxConcurrentActivityTaskExecutions: 200,
        maxConcurrentWorkflowTaskExecutions: 80,
        maxConcurrentLocalActivityExecutions: 200,
        reuseV8Context: true,
        maxActivitiesPerSecond: 1000,
    },

    // Production environment - resource constrained
    PRODUCTION_MINIMAL: {
        maxConcurrentActivityTaskExecutions: 20,
        maxConcurrentWorkflowTaskExecutions: 10,
        maxConcurrentLocalActivityExecutions: 20,
        reuseV8Context: true,
    },
} as const;

// ==========================================
// Error Messages
// ==========================================
export const ERRORS = {
    // Client Errors
    CLIENT_INITIALIZATION: 'Failed to initialize Temporal client',
    CLIENT_NOT_INITIALIZED: 'Temporal client not initialized',

    // Worker Errors
    WORKER_INITIALIZATION: 'Failed to initialize Temporal worker',
    WORKER_NOT_INITIALIZED: 'Temporal worker not initialized',

    // Configuration Errors
    INVALID_OPTIONS: 'Invalid Temporal module options',
    MISSING_TASK_QUEUE: 'Task queue is required',
    MISSING_WORKFLOW_TYPE: 'Workflow type is required',
    MISSING_SCHEDULE_ID: 'Schedule ID is required',

    // Discovery Errors
    ACTIVITY_NOT_FOUND: 'Activity not found',
    WORKFLOW_NOT_FOUND: 'Workflow not found',
    DUPLICATE_WORKFLOW_NAME: 'Duplicate workflow name found',

    // Schedule Errors
    SCHEDULE_CLIENT_NOT_INITIALIZED: 'Temporal schedule client not initialized',
    INVALID_SCHEDULE_OPTIONS: 'Invalid schedule options',
    INVALID_CRON_EXPRESSION: 'Invalid cron expression',
    SCHEDULE_ALREADY_EXISTS: 'Schedule already exists',
    SCHEDULE_NOT_FOUND: 'Schedule not found',

    // Workflow Execution Errors
    WORKFLOW_EXECUTION_FAILED: 'Workflow execution failed',
    SIGNAL_DELIVERY_FAILED: 'Signal delivery failed',
    QUERY_EXECUTION_FAILED: 'Query execution failed',

    // Activity Execution Errors
    ACTIVITY_EXECUTION_FAILED: 'Activity execution failed',
    ACTIVITY_TIMEOUT: 'Activity execution timeout',
    ACTIVITY_RETRY_EXHAUSTED: 'Activity retry attempts exhausted',
} as const;

// ==========================================
// Workflow Policies
// ==========================================
export enum WorkflowIdReusePolicy {
    ALLOW_DUPLICATE = 0,
    ALLOW_DUPLICATE_FAILED_ONLY = 1,
    REJECT_DUPLICATE = 2,
    TERMINATE_IF_RUNNING = 3,
}

export enum WorkflowIdConflictPolicy {
    REJECT_DUPLICATE = 'REJECT_DUPLICATE',
    TERMINATE_IF_RUNNING = 'TERMINATE_IF_RUNNING',
    ALLOW_DUPLICATE = 'ALLOW_DUPLICATE',
}

export enum ScheduleOverlapPolicy {
    ALLOW_ALL = 'ALLOW_ALL',
    SKIP = 'SKIP',
    BUFFER_ONE = 'BUFFER_ONE',
    BUFFER_ALL = 'BUFFER_ALL',
    CANCEL_OTHER = 'CANCEL_OTHER',
}

// ==========================================
// Logging Categories
// ==========================================
export const LOG_CATEGORIES = {
    CLIENT: 'TemporalClient',
    WORKER: 'TemporalWorker',
    DISCOVERY: 'WorkflowDiscovery',
    SCHEDULE: 'ScheduleManager',
    ACTIVITY: 'ActivityExecution',
    WORKFLOW: 'WorkflowExecution',
} as const;
