import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WORKFLOW_PARAMS_METADATA } from '../constants';
import { WorkflowParameterMetadata } from '../interfaces';

/**
 * Extracts workflow parameters
 * Similar to @Param() in REST controllers
 *
 * @param index Optional parameter index to extract specific argument
 *
 * @example
 * ```typescript
 * @WorkflowController({ taskQueue: 'orders' })
 * export class OrderController {
 *   @WorkflowMethod()
 *   async processOrder(
 *     @WorkflowParam(0) orderId: string,
 *     @WorkflowParam(1) customerId: string
 *   ) {
 *     // orderId = args[0], customerId = args[1]
 *   }
 *
 *   @WorkflowMethod()
 *   async processMultipleOrders(@WorkflowParam() orderIds: string[]) {
 *     // orderIds = entire args array
 *   }
 *
 *   @Signal('addItem')
 *   async addItem(@WorkflowParam() item: any) {
 *     // item = signal argument
 *   }
 * }
 * ```
 */
export const WorkflowParam = createParamDecorator(
    (_index: number | undefined, _ctx: ExecutionContext) => {
        // In a real implementation, this would extract from the workflow execution context
        // For now, we store metadata about the parameter extraction requirements
        return undefined; // The actual parameter extraction would be implemented in runtime
    },
);

// Internal decorator implementation for metadata storage
export function WorkflowParamDecorator(index?: number): ParameterDecorator {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;

        const existingParams: WorkflowParameterMetadata[] =
            Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
        existingParams[parameterIndex] = {
            type: 'param',
            index: index !== undefined ? index : parameterIndex,
            extractAll: index === undefined,
        };
        Reflect.defineMetadata(WORKFLOW_PARAMS_METADATA, existingParams, target, propertyKey);
    };
}

/**
 * Extracts workflow execution context
 * Provides access to workflow metadata
 *
 * @example
 * ```typescript
 * @WorkflowController({ taskQueue: 'orders' })
 * export class OrderController {
 *   @WorkflowMethod()
 *   async processOrder(
 *     @WorkflowParam() orderId: string,
 *     @WorkflowContext() context: WorkflowExecutionContext
 *   ) {
 *     this.logger.log(`Workflow ID: ${context.workflowId}`);
 *     this.logger.log(`Task Queue: ${context.taskQueue}`);
 *   }
 *
 *   @Query()
 *   getWorkflowInfo(@WorkflowContext() context: WorkflowExecutionContext) {
 *     return {
 *       id: context.workflowId,
 *       type: context.workflowType
 *     };
 *   }
 * }
 * ```
 */
export const WorkflowContext = (): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;

        const existingParams =
            Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
        existingParams[parameterIndex] = {
            type: 'context',
        };
        Reflect.defineMetadata(WORKFLOW_PARAMS_METADATA, existingParams, target, propertyKey);
    };
};

/**
 * Extracts workflow ID from the execution context
 *
 * @example
 * ```typescript
 * @WorkflowController({ taskQueue: 'orders' })
 * export class OrderController {
 *   @WorkflowMethod()
 *   async processOrder(
 *     @WorkflowParam() orderId: string,
 *     @WorkflowId() workflowId: string
 *   ) {
 *     this.logger.log(`Processing order: ${orderId} in workflow: ${workflowId}`);
 *   }
 * }
 * ```
 */
export const WorkflowId = (): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;

        const existingParams =
            Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
        existingParams[parameterIndex] = {
            type: 'workflowId',
        };
        Reflect.defineMetadata(WORKFLOW_PARAMS_METADATA, existingParams, target, propertyKey);
    };
};

/**
 * Extracts run ID from the execution context
 *
 * @example
 * ```typescript
 * @WorkflowController({ taskQueue: 'orders' })
 * export class OrderController {
 *   @WorkflowMethod()
 *   async processOrder(
 *     @WorkflowParam() orderId: string,
 *     @RunId() runId: string
 *   ) {
 *     this.logger.log(`Processing order: ${orderId} in run: ${runId}`);
 *   }
 * }
 * ```
 */
export const RunId = (): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;

        const existingParams =
            Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
        existingParams[parameterIndex] = {
            type: 'runId',
        };
        Reflect.defineMetadata(WORKFLOW_PARAMS_METADATA, existingParams, target, propertyKey);
    };
};

/**
 * Extracts task queue from the execution context
 *
 * @example
 * ```typescript
 * @WorkflowController({ taskQueue: 'orders' })
 * export class OrderController {
 *   @WorkflowMethod()
 *   async processOrder(
 *     @WorkflowParam() orderId: string,
 *     @TaskQueue() taskQueue: string
 *   ) {
 *     this.logger.log(`Processing order: ${orderId} on queue: ${taskQueue}`);
 *   }
 * }
 * ```
 */
export const TaskQueue = (): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;

        const existingParams =
            Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
        existingParams[parameterIndex] = {
            type: 'taskQueue',
        };
        Reflect.defineMetadata(WORKFLOW_PARAMS_METADATA, existingParams, target, propertyKey);
    };
};

/**
 * Utility function to get parameter metadata for a method
 * Used internally by the framework to understand how to inject parameters
 */
export function getParameterMetadata(
    target: object,
    propertyKey: string | symbol,
): WorkflowParameterMetadata[] {
    return Reflect.getMetadata(WORKFLOW_PARAMS_METADATA, target, propertyKey) || [];
}
