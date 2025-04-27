import { WorkflowIdReusePolicy, WorkflowIdConflictPolicy } from '../constants';

/**
 * Options for configuring Temporal Workflow classes
 */
export interface WorkflowOptions {
    /**
     * Workflow type name
     * If not provided, the class name will be used
     */
    name?: string;

    /**
     * Task queue for the workflow
     * Required
     */
    taskQueue: string;

    /**
     * Workflow timeout in milliseconds or formatted string (e.g. '30m')
     */
    timeout?: string | number;

    /**
     * Retry policy for workflow execution
     */
    retry?: {
        /**
         * Maximum number of retry attempts
         */
        maximumAttempts?: number;

        /**
         * Initial interval between retries
         */
        initialInterval?: string | number;
    };

    /**
     * Policy for workflow ID reuse
     */
    workflowIdReusePolicy?: WorkflowIdReusePolicy;

    /**
     * Policy for workflow ID conflicts
     */
    workflowIdConflictPolicy?: WorkflowIdConflictPolicy;
}

/**
 * Options for Workflow Method
 */
export interface WorkflowMethodOptions {
    /**
     * Name for the workflow method
     */
    name: string;
}
