/**
 * Constants used throughout the NestJS Temporal integration
 *
 * This file contains injection tokens, metadata keys, and default values
 * that are used consistently across the package.
 */

// ==========================================
// Module configuration and injection tokens
// ==========================================
export const TEMPORAL_MODULE_OPTIONS = 'TEMPORAL_MODULE_OPTIONS';
export const TEMPORAL_CLIENT_MODULE_OPTIONS = 'TEMPORAL_CLIENT_MODULE_OPTIONS';
export const TEMPORAL_WORKER_MODULE_OPTIONS = 'TEMPORAL_WORKER_MODULE_OPTIONS';
export const TEMPORAL_CLIENT = 'TEMPORAL_CLIENT';
export const TEMPORAL_CONNECTION = 'TEMPORAL_CONNECTION';

// ==========================================
// Activity-related metadata keys
// ==========================================
export const TEMPORAL_ACTIVITY = 'TEMPORAL_ACTIVITY';
export const TEMPORAL_ACTIVITY_METHOD = 'TEMPORAL_ACTIVITY_METHOD';
export const TEMPORAL_ACTIVITY_METHOD_NAME = 'TEMPORAL_ACTIVITY_METHOD_NAME';
export const TEMPORAL_ACTIVITY_METHOD_OPTIONS = 'TEMPORAL_ACTIVITY_METHOD_OPTIONS';

// ==========================================
// Workflow-related metadata keys
// ==========================================
export const TEMPORAL_WORKFLOW = 'TEMPORAL_WORKFLOW';
export const TEMPORAL_WORKFLOW_METHOD = 'TEMPORAL_WORKFLOW_METHOD';
export const TEMPORAL_WORKFLOW_METHOD_NAME = 'TEMPORAL_WORKFLOW_METHOD_NAME';
export const TEMPORAL_WORKFLOW_OPTIONS = 'TEMPORAL_WORKFLOW_OPTIONS';

// ==========================================
// Signal-related metadata keys
// ==========================================
export const TEMPORAL_SIGNAL_METHOD = 'TEMPORAL_SIGNAL_METHOD';
export const TEMPORAL_SIGNAL_NAME = 'TEMPORAL_SIGNAL_NAME';

// ==========================================
// Query-related metadata keys
// ==========================================
export const TEMPORAL_QUERY_METHOD = 'TEMPORAL_QUERY_METHOD';
export const TEMPORAL_QUERY_NAME = 'TEMPORAL_QUERY_NAME';

// ==========================================
// Default values
// ==========================================
export const DEFAULT_NAMESPACE = 'default';
export const DEFAULT_TASK_QUEUE = 'default-task-queue';
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

// ==========================================
// Error messages
// ==========================================
export const ERRORS = {
    CLIENT_INITIALIZATION: 'Failed to initialize Temporal client',
    WORKER_INITIALIZATION: 'Failed to initialize Temporal worker',
    CLIENT_NOT_INITIALIZED: 'Temporal client not initialized',
    WORKER_NOT_INITIALIZED: 'Temporal worker not initialized',
    INVALID_OPTIONS: 'Invalid Temporal module options',
    MISSING_TASK_QUEUE: 'Task queue is required',
    MISSING_WORKFLOW_TYPE: 'Workflow type is required',
    ACTIVITY_NOT_FOUND: 'Activity not found',
    WORKFLOW_NOT_FOUND: 'Workflow not found',
    SCHEDULE_CLIENT_NOT_INITIALIZED: 'Temporal schedule client not initialized',
};

// ==========================================
// Common policy types
// ==========================================

/**
 * WorkflowId reuse policy
 * Controls what happens when starting a workflow with an ID that was used before
 */
export const WorkflowIdReusePolicy = {
    /**
     * Allow starting the workflow if the previous run is completed
     * @default
     */
    ALLOW_DUPLICATE: 'ALLOW_DUPLICATE',

    /**
     * Allow starting the workflow if the previous run failed
     */
    ALLOW_DUPLICATE_FAILED_ONLY: 'ALLOW_DUPLICATE_FAILED_ONLY',

    /**
     * Do not allow reusing the same workflow ID
     */
    REJECT_DUPLICATE: 'REJECT_DUPLICATE',
} as const;
export type WorkflowIdReusePolicy =
    (typeof WorkflowIdReusePolicy)[keyof typeof WorkflowIdReusePolicy];

/**
 * WorkflowId conflict policy
 * Controls what happens when starting a workflow with an ID that's already running
 */
export const WorkflowIdConflictPolicy = {
    /**
     * Fail the operation with an error
     * @default
     */
    FAIL: 'FAIL',

    /**
     * Return handle to the existing workflow
     */
    USE_EXISTING: 'USE_EXISTING',

    /**
     * Terminate the existing workflow and start a new one
     */
    TERMINATE_EXISTING: 'TERMINATE_EXISTING',
} as const;
export type WorkflowIdConflictPolicy =
    (typeof WorkflowIdConflictPolicy)[keyof typeof WorkflowIdConflictPolicy];

/**
 * Schedule overlap policy
 * Controls what happens when a schedule triggers while a previous run is still active
 */
export const ScheduleOverlapPolicy = {
    /**
     * Allow all overlapping runs
     * @default
     */
    ALLOW_ALL: 'ALLOW_ALL',

    /**
     * Skip this run if a previous one is still running
     */
    SKIP: 'SKIP',

    /**
     * Buffer one run to execute after current one completes
     */
    BUFFER_ONE: 'BUFFER_ONE',

    /**
     * Buffer all runs to execute in sequence
     */
    BUFFER_ALL: 'BUFFER_ALL',

    /**
     * Cancel any previous run and start a new one
     */
    CANCEL_OTHER: 'CANCEL_OTHER',
} as const;
export type ScheduleOverlapPolicy =
    (typeof ScheduleOverlapPolicy)[keyof typeof ScheduleOverlapPolicy];
