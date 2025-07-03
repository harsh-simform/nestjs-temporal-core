import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TemporalMetadataAccessor } from './temporal-metadata.accessor';
import { ERRORS, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { TemporalAsyncOptions, TemporalOptions, TemporalOptionsFactory } from '../interfaces';
import { TemporalWorkerManagerService } from './temporal-worker-manager.service';

/**
 * Improved Temporal Worker Module (v2)
 * Addresses initialization issues and provides better error handling
 */
@Module({})
export class TemporalWorkerModuleV2 {
    // ==========================================
    // Synchronous Registration
    // ==========================================

    /**
     * Register the module with synchronous options
     */
    static register(options: TemporalOptions): DynamicModule {
        this.validateOptions(options);
        const providers = this.createProviders(options);

        return {
            module: TemporalWorkerModuleV2,
            global: options.isGlobal ?? true,
            providers,
            exports: [TemporalWorkerManagerService, TEMPORAL_MODULE_OPTIONS],
        };
    }

    /**
     * Register the module with asynchronous options
     */
    static registerAsync(options: TemporalAsyncOptions): DynamicModule {
        const providers = this.createAsyncProviders(options);

        return {
            module: TemporalWorkerModuleV2,
            global: options.isGlobal ?? true,
            imports: options.imports || [],
            providers,
            exports: [TemporalWorkerManagerService, TEMPORAL_MODULE_OPTIONS],
        };
    }

    /**
     * Register for worker-only usage with simplified configuration
     */
    static forWorker(options: {
        connection: TemporalOptions['connection'];
        taskQueue: string;
        workflowsPath?: string;
        workflowBundle?: any;
        activityClasses?: Array<Type<any>>;
        workerOptions?: any;
        autoStart?: boolean;
        allowWorkerFailure?: boolean;
        enableLogger?: boolean;
        logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
        isGlobal?: boolean;
    }): DynamicModule {
        return this.register({
            connection: options.connection,
            taskQueue: options.taskQueue,
            worker: {
                workflowsPath: options.workflowsPath,
                workflowBundle: options.workflowBundle,
                activityClasses: options.activityClasses,
                autoStart: options.autoStart,
                workerOptions: options.workerOptions,
            },
            allowConnectionFailure: options.allowWorkerFailure,
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
            isGlobal: options.isGlobal,
        });
    }

    // ==========================================
    // Provider Creation
    // ==========================================

    private static createProviders(options: TemporalOptions): Provider[] {
        const providers: Provider[] = [
            {
                provide: TEMPORAL_MODULE_OPTIONS,
                useValue: this.extractWorkerOptions(options),
            },
            TemporalMetadataAccessor,
            DiscoveryService,
            TemporalWorkerManagerService,
        ];

        // Add activity class providers if specified
        if (options.worker?.activityClasses) {
            providers.push(...this.createActivityProviders(options.worker.activityClasses));
        }

        return providers;
    }

    private static createAsyncProviders(options: TemporalAsyncOptions): Provider[] {
        const providers: Provider[] = [
            TemporalMetadataAccessor,
            DiscoveryService,
            TemporalWorkerManagerService,
        ];

        // Create the main options provider
        if (options.useFactory) {
            providers.push({
                provide: TEMPORAL_MODULE_OPTIONS,
                useFactory: async (...args: any[]) => {
                    const temporalOptions = await options.useFactory!(...args);
                    this.validateOptions(temporalOptions);
                    return this.extractWorkerOptions(temporalOptions);
                },
                inject: options.inject || [],
            });
        } else if (options.useClass) {
            providers.push(
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalOptionsFactory) => {
                        const temporalOptions = await optionsFactory.createTemporalOptions();
                        this.validateOptions(temporalOptions);
                        return this.extractWorkerOptions(temporalOptions);
                    },
                    inject: [options.useClass],
                },
            );
        } else if (options.useExisting) {
            providers.push({
                provide: TEMPORAL_MODULE_OPTIONS,
                useFactory: async (optionsFactory: TemporalOptionsFactory) => {
                    const temporalOptions = await optionsFactory.createTemporalOptions();
                    this.validateOptions(temporalOptions);
                    return this.extractWorkerOptions(temporalOptions);
                },
                inject: [options.useExisting],
            });
        } else {
            throw new Error(ERRORS.INVALID_OPTIONS);
        }

        return providers;
    }

    private static createActivityProviders(activityClasses: Array<Type<any>>): Provider[] {
        return activityClasses.map((ActivityClass) => ({
            provide: ActivityClass,
            useClass: ActivityClass,
        }));
    }

    // ==========================================
    // Validation & Configuration
    // ==========================================

    private static validateOptions(options: TemporalOptions): void {
        if (!options) {
            throw new Error('Temporal options are required');
        }

        if (!options.connection) {
            throw new Error('Connection configuration is required');
        }

        if (!options.connection.address) {
            throw new Error('Connection address is required');
        }

        if (!options.taskQueue) {
            throw new Error('Task queue is required');
        }

        // Validate worker configuration if provided
        if (options.worker) {
            const hasWorkflowsPath = Boolean(options.worker.workflowsPath);
            const hasWorkflowBundle = Boolean(options.worker.workflowBundle);

            if (hasWorkflowsPath && hasWorkflowBundle) {
                throw new Error('Cannot specify both workflowsPath and workflowBundle');
            }

            // At least one workflow source is required if worker config is provided
            if (!hasWorkflowsPath && !hasWorkflowBundle) {
                throw new Error(
                    'Either workflowsPath or workflowBundle must be provided when worker config is specified',
                );
            }
        }
    }

    private static extractWorkerOptions(options: TemporalOptions): any {
        return {
            // Connection configuration
            connection: {
                address: options.connection.address,
                namespace: options.connection.namespace,
                tls: options.connection.tls,
                apiKey: options.connection.apiKey,
                metadata: options.connection.metadata,
            },

            // Worker configuration
            taskQueue: options.taskQueue,
            workflowsPath: options.worker?.workflowsPath,
            workflowBundle: options.worker?.workflowBundle,
            activityClasses: options.worker?.activityClasses || [],

            // Execution options
            autoStart: options.worker?.autoStart !== false,
            allowWorkerFailure: options.allowConnectionFailure !== false,
            workerOptions: options.worker?.workerOptions || {},

            // Logging configuration
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        };
    }
}
