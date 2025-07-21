import 'reflect-metadata';

/** Main Temporal module for unified integration */
export { TemporalModule } from './temporal.module';

/** Unified service providing all Temporal functionality */
export { TemporalService } from './services/temporal.service';

/** Service for Temporal client operations (start workflows, signals, queries) */
export { TemporalClientService } from './services/temporal-client.service';

/** Service for schedule operations */
export { TemporalScheduleService } from './services/temporal-schedule.service';

/** Service for worker lifecycle management */
export { TemporalWorkerManagerService } from './services/temporal-worker.service';

/** Service for activity operations */
export { TemporalActivityService } from './services/temporal-activity.service';

/** Service for workflow discovery and introspection */
export { TemporalDiscoveryService } from './services/temporal-discovery.service';

/** Service for activity metadata and validation */
export { TemporalMetadataAccessor } from './services/temporal-metadata.service';

/** All utility functions (validation, metadata, logging) */
export * from './utils';

/** Essential constants and predefined values */
export {
    DEFAULT_NAMESPACE,
    DEFAULT_TASK_QUEUE,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_SCHEDULED_WORKFLOW,
    WORKFLOW_PARAMS_METADATA,
    TEMPORAL_CLIENT,
    TEMPORAL_MODULE_OPTIONS,
    TEMPORAL_CONNECTION,
    CRON_EXPRESSIONS,
    INTERVAL_EXPRESSIONS,
    TIMEOUTS,
    RETRY_POLICIES,
} from './constants';

export * from './services/temporal.service';
