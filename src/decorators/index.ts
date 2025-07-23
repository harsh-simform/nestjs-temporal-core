/**
 * NestJS Temporal Core - All Decorators
 *
 * Consolidated export of all Temporal decorators organized by domain:
 * - Activity decorators: @Activity, @ActivityMethod, @InjectActivity, @InjectWorkflowClient
 * - Workflow decorators: @Workflow, @WorkflowRun, @SignalMethod, @QueryMethod, @ChildWorkflow
 *
 * Note: Static configuration decorators like @Scheduled, @Cron, @Interval have been removed
 * to avoid static configuration that should be dynamic (e.g., from environment variables).
 */
// Activity decorators
export { Activity, ActivityMethod, InjectActivity } from './activity.decorator';

// Workflow decorators
export {
    Workflow,
    WorkflowRun,
    SignalMethod,
    QueryMethod,
    ChildWorkflow,
    InjectWorkflowClient,
} from './workflow.decorator';
