/**
 * Re-export all interfaces for easier imports
 */

// Base connection interfaces
export * from './base.interface';

// Client module interfaces
export * from './client.interface';

// Worker module interfaces
export * from './worker.interface';

// Worker module interfaces
export * from './workflow.interface';

// Activity-related interfaces
export * from './activity.interface';

// Unified Temporal interfaces
export * from './temporal.interface';

// Re-export key types from Temporal SDK for convenience
export { RetryPolicy, Duration, SearchAttributes } from '@temporalio/common';

export { ScheduleOverlapPolicy, WorkflowHandle, Client } from '@temporalio/client';

export { Worker } from '@temporalio/worker';
