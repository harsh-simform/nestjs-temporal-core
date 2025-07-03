import 'reflect-metadata';
/**
 * NestJS Temporal Core - Complete Temporal.io Integration for NestJS
 *
 * Streamlined and simplified Temporal integration with:
 * - Auto-discovery of activities and scheduled workflows
 * - Declarative scheduling with @Cron and @Interval decorators
 * - Comprehensive client and worker management
 * - Production-ready health monitoring and error handling
 */

// ==========================================
// Client Components
// ==========================================
export { TemporalClientModule, TemporalClientService, TemporalScheduleService } from './client';

// ==========================================
// Worker Components
// ==========================================
export {
    TemporalWorkerModule,
    TemporalWorkerManagerService,
    TemporalMetadataAccessor,
} from './worker';

// ==========================================
// Activity Components
// ==========================================
export { TemporalActivityModule, TemporalActivityService } from './activity';

// ==========================================
// Schedule Components
// ==========================================
export { TemporalSchedulesModule, TemporalSchedulesService } from './schedules';

// ==========================================
// Discovery Services
// ==========================================
export { TemporalDiscoveryService, TemporalScheduleManagerService } from './discovery';

// ==========================================
// Logging Utilities
// ==========================================
export * from './utils';

// ==========================================
// All Decorators
// ==========================================
export * from './decorators';

// ==========================================
// All Interfaces and Types
// ==========================================
export * from './interfaces';

// ==========================================
// Constants and Presets
// ==========================================
export {
    // Default values
    DEFAULT_NAMESPACE,
    DEFAULT_TASK_QUEUE,

    // Metadata keys
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_SCHEDULED_WORKFLOW,

    // Injection tokens
    TEMPORAL_CLIENT,
    TEMPORAL_MODULE_OPTIONS,

    // Presets and expressions
    CRON_EXPRESSIONS,
    INTERVAL_EXPRESSIONS,
    WORKER_PRESETS,
    RETRY_POLICIES,
    TIMEOUTS,

    // Error messages
    ERRORS,
} from './constants';

// ==========================================
// Core Temporal Service
// ==========================================
export * from './temporal.service';

// ==========================================
// Core Temporal Module
// ==========================================
export * from './temporal.module';

// ==========================================
// Re-export Temporal SDK Types for Convenience
// ==========================================
export type { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';

export type { ScheduleOverlapPolicy, WorkflowHandle, Client } from '@temporalio/client';

export type { Worker } from '@temporalio/worker';
