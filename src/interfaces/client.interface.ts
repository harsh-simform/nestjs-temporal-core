import { ModuleMetadata, Type } from '@nestjs/common';
import { ConnectionOptions } from './base.interface';

/**
 * Client module configuration options
 */
export interface TemporalClientOptions {
    /**
     * Connection configuration for Temporal server
     */
    connection: ConnectionOptions;

    /**
     * Temporal namespace
     * @default "default"
     */
    namespace?: string;

    /**
     * Whether to allow the application to start even if
     * the Temporal connection fails
     * @default true
     */
    allowConnectionFailure?: boolean;
}

/**
 * Factory interface for creating client options
 */
export interface TemporalClientOptionsFactory {
    /**
     * Method to create client options
     */
    createClientOptions(): Promise<TemporalClientOptions> | TemporalClientOptions;
}

/**
 * Async client module configuration options
 */
export interface TemporalClientAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * Existing provider to use
     */
    useExisting?: Type<TemporalClientOptionsFactory>;

    /**
     * Class to use as provider
     */
    useClass?: Type<TemporalClientOptionsFactory>;

    /**
     * Factory function to use
     */
    useFactory?: (...args: any[]) => Promise<TemporalClientOptions> | TemporalClientOptions;

    /**
     * Dependencies to inject into factory function
     */
    inject?: any[];
}

/**
 * Options for starting a workflow
 */
export interface StartWorkflowOptions {
    /**
     * Task queue to use for this workflow
     */
    taskQueue: string;

    /**
     * Custom workflow ID (optional)
     * A unique ID will be generated if not provided
     */
    workflowId?: string;

    /**
     * Signal to send to the workflow upon start (optional)
     */
    signal?: {
        /**
         * Name of the signal to send
         */
        name: string;

        /**
         * Arguments to pass to the signal
         */
        args?: any[];
    };

    /**
     * Retry policy for failed workflows
     */
    retry?: {
        /**
         * Maximum number of retry attempts
         */
        maximumAttempts?: number;

        /**
         * Initial interval between retries in ms or formatted string (e.g. '1s')
         */
        initialInterval?: string | number;
    };

    /**
     * Search attributes for the workflow
     */
    searchAttributes?: Record<string, unknown>;

    /**
     * Additional workflow options passed directly to Temporal SDK
     */
    [key: string]: any;
}
