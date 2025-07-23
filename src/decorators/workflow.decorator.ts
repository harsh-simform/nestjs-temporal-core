import {
    TEMPORAL_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../constants';
import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { setHandler, defineSignal, defineQuery, startChild } from '@temporalio/workflow';

/**
 * Marks a class as a Temporal workflow controller.
 * This decorator registers the class for workflow discovery and enables
 * workflow execution through the Temporal engine.
 *
 * @param options Optional workflow configuration
 * @param options.name Custom workflow name (defaults to class name)
 * @param options.description Human-readable description of the workflow
 *
 * @example Basic Usage
 * ```typescript
 * @Workflow()
 * export class OrderWorkflow {
 *   @WorkflowRun()
 *   async execute(orderId: string): Promise<OrderResult> {
 *     // Workflow implementation
 *     return { orderId, status: 'completed' };
 *   }
 * }
 * ```
 *
 * @example With Custom Name and Description
 * ```typescript
 * @Workflow({
 *   name: 'order-processing-v2',
 *   description: 'Enhanced order processing with validation and notifications'
 * })
 * export class OrderWorkflow {
 *   @WorkflowRun()
 *   async execute(orderId: string): Promise<OrderResult> {
 *     // Implementation
 *   }
 * }
 * ```
 *
 * @see {@link WorkflowRun} for marking the workflow entry point
 * @see {@link SignalMethod} for handling signals
 * @see {@link QueryMethod} for handling queries
 */
export const Workflow = (options?: { name?: string; description?: string }): ClassDecorator => {
    return (target: unknown) => {
        const metadata = {
            ...options,
            className: (target as { name: string }).name,
        };
        Reflect.defineMetadata(TEMPORAL_WORKFLOW, metadata, target as object);
        return target as never;
    };
};

/**
 * Marks the main entry point method of a workflow.
 * This decorator identifies which method serves as the workflow's main execution function.
 * A workflow class must have exactly one method decorated with @WorkflowRun.
 *
 * @example
 * ```typescript
 * @Workflow({ name: 'user-registration' })
 * export class UserRegistrationWorkflow {
 *   @WorkflowRun()
 *   async execute(userData: UserData): Promise<RegistrationResult> {
 *     // Main workflow logic
 *     return { userId: '123', status: 'registered' };
 *   }
 *
 *   @SignalMethod('cancel')
 *   async handleCancel(): Promise<void> {
 *     // Signal handling logic
 *   }
 * }
 * ```
 *
 * @throws {Error} If multiple methods in a class are decorated with @WorkflowRun
 * @see {@link Workflow} for class-level workflow configuration
 */
export const WorkflowRun: () => MethodDecorator = () => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error(
                `@WorkflowRun can only be applied to methods, not ${typeof descriptor?.value}`,
            );
        }

        // Check if another WorkflowRun method already exists on this class
        const prototype = target.constructor.prototype;
        const existingMethods = Object.getOwnPropertyNames(prototype).filter((name) => {
            const desc = Object.getOwnPropertyDescriptor(prototype, name);
            return (
                desc?.value &&
                typeof desc.value === 'function' &&
                name !== propertyKey.toString() &&
                Reflect.getMetadata(TEMPORAL_WORKFLOW_RUN, desc.value)
            );
        });

        if (existingMethods.length > 0) {
            throw new Error(
                `Multiple @WorkflowRun methods found in class ${target.constructor.name}. ` +
                    `Only one method can be decorated with @WorkflowRun. ` +
                    `Existing: ${existingMethods.join(', ')}, Current: ${propertyKey.toString()}`,
            );
        }

        Reflect.defineMetadata(
            TEMPORAL_WORKFLOW_RUN,
            { methodName: propertyKey.toString() },
            descriptor.value,
        );
        return descriptor;
    };
};

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
 * @Workflow()
 * export class OrderWorkflow {
 *   private orderStatus = 'pending';
 *
 *   @SignalMethod('updateStatus')
 *   async handleStatusUpdate(newStatus: string): Promise<void> {
 *     this.orderStatus = newStatus;
 *     // Additional logic based on status change
 *   }
 *
 *   @SignalMethod() // Uses method name as signal name
 *   async cancel(): Promise<void> {
 *     this.orderStatus = 'cancelled';
 *   }
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
 * @see {@link Workflow} for class-level workflow configuration
 */
export const SignalMethod = (signalName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error(
                `@SignalMethod can only be applied to methods, not ${typeof descriptor?.value}`,
            );
        }

        // Validate signal name first if provided
        if (
            signalName !== undefined &&
            (signalName.length === 0 || signalName.trim().length === 0)
        ) {
            throw new Error('Signal name cannot be empty');
        }

        const finalSignalName = signalName || propertyKey.toString();

        if (
            finalSignalName.includes(' ') ||
            finalSignalName.includes('\n') ||
            finalSignalName.includes('\t')
        ) {
            throw new Error(
                `Invalid signal name: "${finalSignalName}". Signal names cannot contain whitespace.`,
            );
        }

        const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, target) || {};

        // Check for duplicate signal names
        if (signals[finalSignalName] && signals[finalSignalName] !== propertyKey) {
            throw new Error(
                `Duplicate signal name "${finalSignalName}" found in class ${target.constructor.name}. ` +
                    `Signal names must be unique within a workflow class.`,
            );
        }

        signals[finalSignalName] = propertyKey;
        Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, signals, target);

        // Store the original method for runtime registration
        const originalMethod = descriptor.value;

        // Replace descriptor value with a wrapper that can register the signal handler
        descriptor.value = function (this: unknown, ...args: unknown[]) {
            // In v8 context, register the signal handler using Temporal's setHandler
            if (typeof setHandler === 'function' && typeof defineSignal === 'function') {
                try {
                    const signalDef = defineSignal(finalSignalName);
                    setHandler(signalDef, originalMethod.bind(this));
                } catch {
                    // Handler might already be registered, which is fine
                }
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

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
 * @Workflow()
 * export class OrderWorkflow {
 *   private orderStatus = 'pending';
 *   private orderItems: OrderItem[] = [];
 *
 *   @QueryMethod('getStatus')
 *   getCurrentStatus(): string {
 *     return this.orderStatus;
 *   }
 *
 *   @QueryMethod() // Uses method name as query name
 *   getItems(): OrderItem[] {
 *     return [...this.orderItems]; // Return copy to prevent external modification
 *   }
 *
 *   @QueryMethod('getOrderSummary')
 *   getOrderSummary(): OrderSummary {
 *     return {
 *       status: this.orderStatus,
 *       itemCount: this.orderItems.length,
 *       total: this.calculateTotal()
 *     };
 *   }
 * }
 * ```
 *
 * @remarks
 * - Query methods must be synchronous and return immediately
 * - They should not modify workflow state or have side effects
 * - They can be called at any time during workflow execution
 *
 * @see {@link SignalMethod} for modifying workflow state
 * @see {@link Workflow} for class-level workflow configuration
 */
export const QueryMethod = (queryName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error(
                `@QueryMethod can only be applied to methods, not ${typeof descriptor?.value}`,
            );
        }

        // Validate query name first if provided
        if (queryName !== undefined && (queryName.length === 0 || queryName.trim().length === 0)) {
            throw new Error('Query name cannot be empty');
        }

        const finalQueryName = queryName || propertyKey.toString();

        if (
            finalQueryName.includes(' ') ||
            finalQueryName.includes('\n') ||
            finalQueryName.includes('\t')
        ) {
            throw new Error(
                `Invalid query name: "${finalQueryName}". Query names cannot contain whitespace.`,
            );
        }

        const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, target) || {};

        // Check for duplicate query names
        if (queries[finalQueryName] && queries[finalQueryName] !== propertyKey) {
            throw new Error(
                `Duplicate query name "${finalQueryName}" found in class ${target.constructor.name}. ` +
                    `Query names must be unique within a workflow class.`,
            );
        }

        queries[finalQueryName] = propertyKey;
        Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, queries, target);

        // Store the original method for runtime registration
        const originalMethod = descriptor.value;

        // Replace descriptor value with a wrapper that can register the query handler
        descriptor.value = function (this: unknown, ...args: unknown[]) {
            // In v8 context, register the query handler using Temporal's setHandler
            if (typeof setHandler === 'function' && typeof defineQuery === 'function') {
                try {
                    const queryDef = defineQuery(finalQueryName);
                    setHandler(queryDef, originalMethod.bind(this));
                } catch {
                    // Handler might already be registered, which is fine
                }
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

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
 * @Workflow()
 * export class OrderWorkflow {
 *   @ChildWorkflow(PaymentWorkflow)
 *   private paymentWorkflow: PaymentWorkflow;
 *
 *   @ChildWorkflow(InventoryWorkflow)
 *   private inventoryWorkflow: InventoryWorkflow;
 *
 *   @WorkflowRun()
 *   async execute(order: Order): Promise<OrderResult> {
 *     // Reserve inventory first - startChild is called automatically
 *     const reservation = await this.inventoryWorkflow.reserve(order.items);
 *
 *     // Process payment - each method call starts a new child workflow
 *     const payment = await this.paymentWorkflow.processPayment({
 *       amount: order.total,
 *       customerId: order.customerId
 *     });
 *
 *     return { orderId: order.id, paymentId: payment.id };
 *   }
 * }
 * ```
 *
 * @remarks
 * - Child workflows are independent and can outlive the parent workflow
 * - They provide better fault isolation
 * - Use child workflows for operations that should continue even if parent fails
 * - Configuration like task queues should be handled via module configuration, not decorator options
 * - Each method call on the proxy starts a new child workflow instance
 *
 * @see {@link Workflow} for class-level workflow configuration
 * @see {@link InjectActivity} for injecting activities instead of workflows
 */
export const ChildWorkflow = (workflowType: Type<unknown>): PropertyDecorator => {
    return (target, propertyKey) => {
        if (!workflowType) {
            throw new Error('Child workflow type is required');
        }

        // Validate that workflowType is actually a class constructor
        if (typeof workflowType !== 'function') {
            throw new Error('Child workflow type must be a class constructor');
        }

        // Get the workflow name from metadata or use class name
        let workflowName = workflowType.name;
        const workflowMetadata = Reflect.getMetadata(TEMPORAL_WORKFLOW, workflowType);
        if (workflowMetadata?.name) {
            workflowName = workflowMetadata.name;
        }

        // Create a proxy that uses Temporal's startChild API safely
        const proxy = new Proxy(
            {},
            {
                get(_, prop: string | symbol) {
                    if (typeof prop === 'string' && prop !== 'constructor' && prop !== 'toString') {
                        return async function (...args: unknown[]) {
                            // Lazy-load startChild to avoid import issues during testing
                            let startChildFn: typeof startChild;
                            try {
                                // Use the imported startChild function
                                startChildFn = startChild;
                            } catch (error) {
                                throw new Error(
                                    `Failed to access startChild: ${(error as Error)?.message}. ` +
                                        `Make sure this workflow is running in a Temporal workflow context.`,
                                );
                            }

                            // In v8 context, use Temporal's startChild API
                            try {
                                // Check if we're in a workflow context
                                if (typeof startChildFn === 'function') {
                                    // Start a child workflow with the method name as workflow name
                                    // or use the class-level workflow name
                                    const childWorkflowOptions = {
                                        workflowId: `${workflowName}-${prop}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                                        args: args,
                                        // Task queue and other options should come from the workflow context
                                        // not from static decorator configuration
                                    };

                                    return await startChildFn(workflowName, childWorkflowOptions);
                                } else {
                                    throw new Error(
                                        `Child workflow proxy not properly initialized. ` +
                                            `Make sure this workflow is running in a Temporal workflow context.`,
                                    );
                                }
                            } catch (error) {
                                throw new Error(
                                    `Failed to start child workflow ${workflowName}.${prop}: ${
                                        (error as Error)?.message || 'Unknown error'
                                    }`,
                                );
                            }
                        };
                    }
                    return undefined;
                },

                set() {
                    throw new Error('Child workflow proxy is read-only');
                },
            },
        );

        Reflect.defineMetadata(
            TEMPORAL_CHILD_WORKFLOW,
            { workflowType, workflowName },
            target,
            propertyKey,
        );

        Object.defineProperty(target, propertyKey, {
            value: proxy,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    };
};

/**
 * Property decorator to inject the WorkflowClient into a NestJS service.
 * Usage: @InjectWorkflowClient()
 */
export function InjectWorkflowClient(): PropertyDecorator {
    return (target: Object, propertyKey: string | symbol) => {
        function isGetWorkflowClientAvailable(
            obj: Record<string, unknown>,
        ): obj is Record<string, unknown> & { getWorkflowClient: () => unknown } {
            return typeof (obj as { getWorkflowClient?: unknown }).getWorkflowClient === 'function';
        }

        // Use lazy evaluation to avoid initialization order issues
        let cachedClient: unknown = null;
        let hasAttemptedLoad = false;

        const getWorkflowClient = () => {
            if (cachedClient !== null) {
                return cachedClient;
            }

            if (hasAttemptedLoad) {
                throw new Error(
                    'WorkflowClient failed to initialize. Check your Temporal configuration.',
                );
            }

            hasAttemptedLoad = true;

            if (isGetWorkflowClientAvailable(globalThis as Record<string, unknown>)) {
                try {
                    cachedClient = (
                        globalThis as unknown as Record<string, unknown> & {
                            getWorkflowClient: () => unknown;
                        }
                    ).getWorkflowClient();

                    if (!cachedClient) {
                        throw new Error('getWorkflowClient() returned null or undefined');
                    }

                    return cachedClient;
                } catch (error) {
                    throw new Error(
                        `Failed to get WorkflowClient: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    );
                }
            }

            throw new Error(
                'No WorkflowClient instance available. ' +
                    'Please ensure the TemporalModule is properly configured and imported.',
            );
        };

        Object.defineProperty(target, propertyKey, {
            get: getWorkflowClient,
            enumerable: false,
            configurable: false,
        });
    };
}
