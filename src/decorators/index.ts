/**
 * NestJS Temporal Core - All Decorators
 *
 * Consolidated export of all Temporal decorators organized by domain:
 * - Activity decorators: @Activity, @ActivityMethod
 * - Signal and Query decorators: @Signal, @Query
 * - Scheduling decorators: @Scheduled, @Cron, @Interval
 * - Parameter decorators: @WorkflowParam, @WorkflowContext, @WorkflowId, @RunId, @TaskQueue
 */

// ==========================================
// Activity Decorators
// ==========================================
export { Activity, ActivityMethod } from './activity.decorator';

// ==========================================
// Signal and Query Decorators
// ==========================================
export { Signal, Query } from './workflow.decorator';

// ==========================================
// Scheduling Decorators
// ==========================================
export { Scheduled, Cron, Interval } from './scheduling.decorator';

// ==========================================
// Parameter Decorators
// ==========================================
export {
    WorkflowParam,
    WorkflowContext,
    WorkflowId,
    RunId,
    TaskQueue,
} from './parameter.decorator';
