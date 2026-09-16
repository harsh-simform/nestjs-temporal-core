import { TEMPORAL_WORKER_CONTROLLER } from '../constants';
import { TemporalWorkerControllerOptions } from '../interfaces';
import { createLogger } from '../utils/logger';

const logger = createLogger('WorkerControllerDecorator');

/**
 * Declaratively registers a Temporal worker for a task queue, bound to the
 * decorated class the way `@Controller` binds a route group. The decorated
 * class must still be registered as a NestJS provider by the consumer —
 * `DiscoveryModule` only sees registered providers/controllers.
 *
 * @param options Worker configuration — same shape as one entry in
 * `TemporalOptions.workers`.
 *
 * @example
 * ```typescript
 * @TemporalWorkerController({
 *   taskQueue: 'orders',
 *   workflowsPath: './dist/workflows/orders',
 *   activityClasses: [OrderActivities],
 * })
 * export class OrdersWorker {}
 * ```
 */
export const TemporalWorkerController = (
    options: TemporalWorkerControllerOptions,
): ClassDecorator => {
    return (target: unknown) => {
        const targetClass = target as Function;

        if (!options?.taskQueue || options.taskQueue.trim().length === 0) {
            const error = `@TemporalWorkerController on ${targetClass.name} requires a non-empty taskQueue`;
            logger.error(error);
            throw new Error(error);
        }

        logger.debug(`@TemporalWorkerController decorator applied to class: ${targetClass.name}`);
        logger.debug(`Worker controller task queue: ${options.taskQueue}`);

        const metadata = {
            options,
            className: targetClass.name,
        };

        try {
            // Standardized metadata storage - only use Reflect.defineMetadata
            Reflect.defineMetadata(TEMPORAL_WORKER_CONTROLLER, metadata, targetClass);
            logger.debug(
                `Stored worker controller metadata on class constructor: ${targetClass.name}`,
            );

            // Store on prototype for discovery service compatibility
            Reflect.defineMetadata(TEMPORAL_WORKER_CONTROLLER, metadata, targetClass.prototype);
            logger.debug(
                `Stored worker controller metadata on class prototype: ${targetClass.name}`,
            );

            logger.debug(
                `@TemporalWorkerController decorator successfully applied to ${targetClass.name}`,
            );
        } catch (error) {
            logger.error(
                `Failed to apply @TemporalWorkerController decorator to ${targetClass.name}:`,
                error,
            );
            throw error;
        }

        return target as never;
    };
};
