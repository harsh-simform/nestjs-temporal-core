import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Unified configuration options for Temporal integration
 */
export interface TemporalOptions {
    /**
     * Connection configuration
     */
    connection: {
        /**
         * Temporal server address
         * @example "localhost:7233"
         */
        address: string;

        /**
         * Temporal namespace
         * @default "default"
         */
        namespace?: string;

        /**
         * TLS configuration
         */
        tls?:
            | boolean
            | {
                  serverName?: string;
                  clientCertPair?: {
                      crt: Buffer;
                      key: Buffer;
                      ca?: Buffer;
                  };
              };

        /**
         * API key for Temporal Cloud
         */
        apiKey?: string;
    };

    /**
     * Task queue for workflows and activities
     * @default "default-task-queue"
     */
    taskQueue?: string;

    /**
     * Worker configuration (optional)
     * If not provided, only client functionality will be available
     */
    worker?: {
        /**
         * Path to workflow modules
         */
        workflowsPath: string;

        /**
         * Activity classes to register
         */
        activityClasses?: Array<Type<any>>;

        /**
         * Auto-start worker
         * @default true
         */
        autoStart?: boolean;
    };

    /**
     * Whether to register the module as global
     * @default false
     */
    isGlobal?: boolean;
}

/**
 * Factory interface for creating Temporal options
 */
export interface TemporalOptionsFactory {
    /**
     * Method to create Temporal options
     */
    createTemporalOptions(): Promise<TemporalOptions> | TemporalOptions;
}

/**
 * Async configuration options for Temporal integration
 */
export interface TemporalAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * Existing provider to use
     */
    useExisting?: Type<TemporalOptionsFactory>;

    /**
     * Class to use as provider
     */
    useClass?: Type<TemporalOptionsFactory>;

    /**
     * Factory function to use
     */
    useFactory?: (...args: any[]) => Promise<TemporalOptions> | TemporalOptions;

    /**
     * Dependencies to inject into factory function
     */
    inject?: any[];

    /**
     * Whether to register the module as global
     * @default false
     */
    isGlobal?: boolean;
}
