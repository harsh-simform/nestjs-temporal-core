import { ModuleMetadata, Type } from '@nestjs/common';
import { ConnectionOptions } from './base.interface';

/**
 * Worker module configuration options
 */
export interface TemporalWorkerOptions {
    /**
     * Connection configuration for Temporal server
     * If not provided, will use the same connection as the client
     */
    connection?: ConnectionOptions;

    /**
     * Temporal namespace
     * @default "default"
     */
    namespace?: string;

    /**
     * Task queue to poll for workflow and activity tasks
     */
    taskQueue: string;

    /**
     * Path to the workflow modules
     * This should be the path to the compiled JavaScript files
     * @example "./dist/workflows"
     */
    workflowsPath: string;

    /**
     * Array of activity classes to register with the worker
     * These classes should be decorated with @Activity()
     * If not provided, will auto-discover activities
     */
    activityClasses?: Array<Type<any>>;

    /**
     * Whether to automatically start the worker on application bootstrap
     * @default true
     */
    autoStart?: boolean;

    /**
     * Whether to allow the application to start even if
     * the worker initialization fails
     * @default true
     */
    allowWorkerFailure?: boolean;
}

/**
 * Factory interface for creating worker options
 */
export interface TemporalWorkerOptionsFactory {
    /**
     * Method to create worker options
     */
    createWorkerOptions(): Promise<TemporalWorkerOptions> | TemporalWorkerOptions;
}

/**
 * Async worker module configuration options
 */
export interface TemporalWorkerAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * Existing provider to use
     */
    useExisting?: Type<TemporalWorkerOptionsFactory>;

    /**
     * Class to use as provider
     */
    useClass?: Type<TemporalWorkerOptionsFactory>;

    /**
     * Factory function to use
     */
    useFactory?: (...args: any[]) => Promise<TemporalWorkerOptions> | TemporalWorkerOptions;

    /**
     * Dependencies to inject into factory function
     */
    inject?: any[];
}
