import {
    TEMPORAL_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../constants';
import 'reflect-metadata';
import { Type } from '@nestjs/common';

/**
 * Marks a class as a Temporal workflow.
 * @param options Optional workflow metadata (name, description)
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
 * Marks the entrypoint method of a workflow.
 */
export const WorkflowRun: () => MethodDecorator = () => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
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
 * @param signalName Optional custom signal name
 */
export const SignalMethod = (signalName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, target) || {};
        signals[signalName || propertyKey.toString()] = propertyKey;
        Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, signals, target);
        return descriptor;
    };
};

/**
 * Marks a method as a query handler for the workflow.
 * @param queryName Optional custom query name
 */
export const QueryMethod = (queryName?: string): MethodDecorator => {
    return (target, propertyKey, descriptor: PropertyDescriptor) => {
        const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, target) || {};
        queries[queryName || propertyKey.toString()] = propertyKey;
        Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, queries, target);
        return descriptor;
    };
};

/**
 * Property decorator to inject a child workflow proxy.
 * @param workflowType The workflow class/type to proxy
 * @param options Optional proxy options
 */
export const ChildWorkflow = (
    workflowType: Type<unknown>,
    options: Record<string, unknown> = {},
): PropertyDecorator => {
    return (target, propertyKey) => {
        const proxy = {};
        Reflect.defineMetadata(
            TEMPORAL_CHILD_WORKFLOW,
            { workflowType, options },
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
