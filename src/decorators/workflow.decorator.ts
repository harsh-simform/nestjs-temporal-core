import {
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../constants';
import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { createLogger } from '../utils/logger';
import { validateSignalName, validateQueryName } from '../utils/validation';

const logger = createLogger('WorkflowDecorators');

/**
 * Marks a method as a signal handler for the workflow.
 * Signals are external events that can be sent to running workflows to change their state
 * or trigger specific behaviors. Signal methods can be asynchronous.
 *
 * This decorator works in v8 isolated environments by registering signal handlers at runtime
 * without relying on dependency injection or external services.
 *
 * @param signalName Optional custom signal name (defaults to method name)
 *
 * @example Basic Signal Handler
 * ```typescript
 * // In function-based workflow
 * const signals = wf.defineSignal<[string]>('updateStatus');
 * const cancelSignal = wf.defineSignal('cancel');
 *
 * export async function orderWorkflow(): Promise<void> {
 *   let orderStatus = 'pending';
 *
 *   wf.setHandler(signals, (newStatus) => {
 *     orderStatus = newStatus;
 *   });
 *
 *   wf.setHandler(cancelSignal, () => {
 *     orderStatus = 'cancelled';
 *   });
 * }
 * ```
 *
 * @example Signal with Complex Data
 * ```typescript
 * @SignalMethod('addItem')
 * async handleAddItem(item: OrderItem): Promise<void> {
 *   this.orderItems.push(item);
 *   this.recalculateTotal();
 * }
 * ```
 *
 * @see {@link QueryMethod} for querying workflow state
 */
export const SignalMethod = (signalName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        const className = target.constructor.name;
        const methodName = propertyKey.toString();
        const finalSignalName = signalName || methodName;

        logger.debug(`@SignalMethod decorator applied to method: ${className}.${methodName}`);
        logger.debug(
            `Signal name: ${finalSignalName} (provided: ${signalName || 'auto-generated'})`,
        );

        if (!descriptor || typeof descriptor.value !== 'function') {
            const error = `@SignalMethod can only be applied to methods, not ${typeof descriptor?.value}`;
            logger.error(
                `@SignalMethod validation failed for ${className}.${methodName}: ${error}`,
            );
            throw new Error(error);
        }

        // Validate signal name using centralized validation
        if (signalName !== undefined && signalName.length === 0) {
            const error = 'Signal name cannot be empty';
            logger.error(
                `@SignalMethod validation failed for ${className}.${methodName}: ${error}`,
            );
            throw new Error(error);
        }

        try {
            validateSignalName(finalSignalName);
        } catch (error) {
            logger.error(
                `@SignalMethod validation failed for ${className}.${methodName}: ${(error as Error).message}`,
            );
            throw error;
        }

        // Get existing signals from class prototype
        const signals =
            Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, target.constructor.prototype) || {};
        logger.debug(`Existing signals in ${className}: [${Object.keys(signals).join(', ')}]`);

        // Check for duplicate signal names
        if (signals[finalSignalName] && signals[finalSignalName] !== propertyKey) {
            const error =
                `Duplicate signal name "${finalSignalName}" found in class ${className}. ` +
                `Signal names must be unique within a workflow class.`;
            logger.error(`@SignalMethod validation failed: ${error}`);
            throw new Error(error);
        }

        logger.debug(
            `Registering signal "${finalSignalName}" for method ${className}.${methodName}`,
        );

        try {
            // Standardized metadata storage - only use Reflect.defineMetadata
            signals[finalSignalName] = propertyKey;
            Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, signals, target.constructor.prototype);
            logger.debug(`Stored signal metadata on class prototype: ${className}`);

            // Store individual signal metadata on the method
            const signalMetadata = {
                signalName: finalSignalName,
                methodName,
                className,
            };
            Reflect.defineMetadata(
                TEMPORAL_SIGNAL_METHOD + '_METHOD',
                signalMetadata,
                descriptor.value,
            );
            logger.debug(`Stored individual signal metadata on method: ${className}.${methodName}`);

            logger.debug(
                `@SignalMethod decorator successfully applied to ${className}.${methodName}`,
            );
        } catch (error) {
            logger.error(
                `Failed to store @SignalMethod metadata for ${className}.${methodName}:`,
                error,
            );
            throw error;
        }

        // Keep the original method without runtime modification
        // Runtime signal registration should be handled by the worker service
        // when setting up the workflow execution context

        return descriptor;
    };
};

/**
 * Marks a method as a query handler for the workflow.
 * Queries allow external clients to retrieve the current state of a running workflow
 * without affecting its execution. Query methods should be synchronous and side-effect free.
 *
 * This decorator works in v8 isolated environments by registering query handlers at runtime
 * without relying on dependency injection or external services.
 *
 * @param queryName Optional custom query name (defaults to method name)
 *
 * @example Basic Query Handler
 * ```typescript
 * // In function-based workflow
 * const getStatusQuery = wf.defineQuery<string>('getStatus');
 * const getItemsQuery = wf.defineQuery<OrderItem[]>('getItems');
 *
 * export async function orderWorkflow(): Promise<void> {
 *   let orderStatus = 'pending';
 *   let orderItems: OrderItem[] = [];
 *
 *   wf.setHandler(getStatusQuery, () => orderStatus);
 *   wf.setHandler(getItemsQuery, () => [...orderItems]);
 * }
 * ```
 *
 * @remarks
 * - Query methods must be synchronous and return immediately
 * - They should not modify workflow state or have side effects
 * - They can be called at any time during workflow execution
 *
 * @see {@link SignalMethod} for modifying workflow state
 */
export const QueryMethod = (queryName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        const className = target.constructor.name;
        const methodName = propertyKey.toString();
        const finalQueryName = queryName || methodName;

        logger.debug(`@QueryMethod decorator applied to method: ${className}.${methodName}`);
        logger.debug(`Query name: ${finalQueryName} (provided: ${queryName || 'auto-generated'})`);

        if (!descriptor || typeof descriptor.value !== 'function') {
            const error = `@QueryMethod can only be applied to methods, not ${typeof descriptor?.value}`;
            logger.error(`@QueryMethod validation failed for ${className}.${methodName}: ${error}`);
            throw new Error(error);
        }

        // Validate query name using centralized validation
        if (queryName !== undefined && queryName.length === 0) {
            const error = 'Query name cannot be empty';
            logger.error(`@QueryMethod validation failed for ${className}.${methodName}: ${error}`);
            throw new Error(error);
        }

        try {
            validateQueryName(finalQueryName);
        } catch (error) {
            logger.error(
                `@QueryMethod validation failed for ${className}.${methodName}: ${(error as Error).message}`,
            );
            throw error;
        }

        // Get existing queries from class prototype
        const queries =
            Reflect.getMetadata(TEMPORAL_QUERY_METHOD, target.constructor.prototype) || {};
        logger.debug(`Existing queries in ${className}: [${Object.keys(queries).join(', ')}]`);

        // Check for duplicate query names
        if (queries[finalQueryName] && queries[finalQueryName] !== propertyKey) {
            const error =
                `Duplicate query name "${finalQueryName}" found in class ${className}. ` +
                `Query names must be unique within a workflow class.`;
            logger.error(`@QueryMethod validation failed: ${error}`);
            throw new Error(error);
        }

        logger.debug(`Registering query "${finalQueryName}" for method ${className}.${methodName}`);

        try {
            // Standardized metadata storage - only use Reflect.defineMetadata
            queries[finalQueryName] = propertyKey;
            Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, queries, target.constructor.prototype);
            logger.debug(`Stored query metadata on class prototype: ${className}`);

            // Store individual query metadata on the method
            const queryMetadata = {
                queryName: finalQueryName,
                methodName,
                className,
            };
            Reflect.defineMetadata(
                TEMPORAL_QUERY_METHOD + '_METHOD',
                queryMetadata,
                descriptor.value,
            );
            logger.debug(`Stored individual query metadata on method: ${className}.${methodName}`);

            logger.debug(
                `@QueryMethod decorator successfully applied to ${className}.${methodName}`,
            );
        } catch (error) {
            logger.error(
                `Failed to store @QueryMethod metadata for ${className}.${methodName}:`,
                error,
            );
            throw error;
        }

        // Keep the original method without runtime modification
        // Runtime query registration should be handled by the worker service
        // when setting up the workflow execution context

        return descriptor;
    };
};

/**
 * Property decorator to inject a child workflow proxy into a parent workflow.
 * Child workflows are independent workflow executions that are started and managed
 * by a parent workflow. This decorator creates a proxy that allows easy invocation
 * of child workflows with proper typing.
 *
 * This decorator works in v8 isolated environments by using Temporal's startChild API
 * without relying on dependency injection or external services. Configuration is handled
 * dynamically at runtime through the workflow execution context.
 *
 * @param workflowType The workflow class/type to create a proxy for
 *
 * @example Basic Child Workflow
 * ```typescript
 * // In function-based workflow
 * export async function orderWorkflow(order: Order): Promise<OrderResult> {
 *   // Start child workflows using startChild from @temporalio/workflow
 *   const reservationHandle = await wf.startChild(inventoryWorkflow, {
 *     args: [order.items],
 *     workflowId: `inventory-${order.id}`
 *   });
 *   const reservation = await reservationHandle.result();
 *
 *   const paymentHandle = await wf.startChild(paymentWorkflow, {
 *     args: [{ amount: order.total, customerId: order.customerId }],
 *     workflowId: `payment-${order.id}`
 *   });
 *   const payment = await paymentHandle.result();
 *
 *   return { orderId: order.id, paymentId: payment.id };
 * }
 * ```
 *
 * @remarks
 * - Child workflows are independent and can outlive the parent workflow
 * - They provide better fault isolation
 * - Use child workflows for operations that should continue even if parent fails
 * - Configuration like task queues should be handled via module configuration, not decorator options
 * - Each method call on the proxy starts a new child workflow instance
 */
export const ChildWorkflow = (
    workflowType: Type<unknown>,
    options?: { taskQueue?: string },
): PropertyDecorator => {
    return (target, propertyKey) => {
        const className = target.constructor.name;
        const propertyName = propertyKey.toString();

        logger.debug(`@ChildWorkflow decorator applied to property: ${className}.${propertyName}`);
        logger.debug(`Child workflow type: ${workflowType?.name}`);
        logger.debug(`Child workflow options: ${JSON.stringify(options)}`);

        if (!workflowType) {
            const error = 'Child workflow type is required';
            logger.error(
                `@ChildWorkflow validation failed for ${className}.${propertyName}: ${error}`,
            );
            throw new Error(error);
        }

        // Validate that workflowType is actually a class constructor
        if (typeof workflowType !== 'function') {
            const error = 'Child workflow type must be a class constructor';
            logger.error(
                `@ChildWorkflow validation failed for ${className}.${propertyName}: ${error}`,
            );
            throw new Error(error);
        }

        // Use class name as workflow name for function-based workflows
        const workflowName = workflowType.name;
        logger.debug(`Using class name as workflow name: ${workflowName}`);

        // Store metadata for discovery service
        const childWorkflowMetadata = {
            workflowType,
            workflowName,
            propertyKey: propertyName,
            className,
            options: options || {},
        };

        logger.debug(
            `Storing @ChildWorkflow metadata for ${className}.${propertyName}: ${JSON.stringify(childWorkflowMetadata)}`,
        );

        try {
            Reflect.defineMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                childWorkflowMetadata,
                target,
                propertyKey,
            );
            logger.debug(`Stored @ChildWorkflow metadata for ${className}.${propertyName}`);

            // Store a simple placeholder that can be replaced at runtime by the worker
            // The actual proxy creation should happen when the workflow is instantiated
            Object.defineProperty(target, propertyKey, {
                get() {
                    // This will be replaced by the worker service with the actual child workflow proxy
                    const error = `Child workflow ${workflowName} not initialized. This should be set up by the worker service.`;
                    logger.warn(
                        `Child workflow proxy not initialized: ${className}.${propertyName} -> ${workflowName}`,
                    );
                    throw new Error(error);
                },
                set() {
                    const error = 'Child workflow proxy is read-only';
                    logger.warn(
                        `Attempted to set child workflow proxy: ${className}.${propertyName}`,
                    );
                    throw new Error(error);
                },
                enumerable: false,
                configurable: true, // Allow the worker to replace this
            });
            logger.debug(
                `Created property descriptor for child workflow: ${className}.${propertyName}`,
            );

            logger.debug(
                `@ChildWorkflow decorator successfully applied to ${className}.${propertyName}`,
            );
        } catch (error) {
            logger.error(
                `Failed to apply @ChildWorkflow decorator to ${className}.${propertyName}:`,
                error,
            );
            throw error;
        }
    };
};
