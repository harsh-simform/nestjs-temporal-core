import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_WORKFLOW, TEMPORAL_WORKFLOW_OPTIONS } from '../constants';
import { WorkflowOptions } from 'src/interfaces';

/**
 * Decorator that marks a class as a Temporal Workflow
 *
 * Workflows are durable functions that coordinate activities and manage
 * state in a fault-tolerant way.
 *
 * Note: This decorator is used primarily for static analysis and code organization.
 * Actual workflow implementations are in separate files that are loaded by the worker.
 *
 * @param options Workflow configuration
 *
 * @example
 * ```typescript
 * @Workflow({
 *   name: 'OrderWorkflow',
 *   taskQueue: 'order-queue'
 * })
 * export class OrderWorkflow {
 *   // Workflow methods
 * }
 * ```
 */
export const Workflow = (options: WorkflowOptions): ClassDecorator => {
    return (target: any) => {
        Reflect.defineMetadata(TEMPORAL_WORKFLOW, true, target);
        Reflect.defineMetadata(TEMPORAL_WORKFLOW_OPTIONS, options, target);
        SetMetadata(TEMPORAL_WORKFLOW, true)(target);
        SetMetadata(TEMPORAL_WORKFLOW_OPTIONS, options)(target);
        return target;
    };
};
