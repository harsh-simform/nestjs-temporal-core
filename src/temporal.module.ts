import { DynamicModule, Module, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TemporalService } from './temporal.service';
import { TemporalAsyncOptions, TemporalOptions, TemporalOptionsFactory } from './interfaces';
import { ERRORS, TEMPORAL_MODULE_OPTIONS } from './constants';
import { TemporalClientModule } from './client';
import { TemporalWorkerModule } from './worker';
import { TemporalDiscoveryService, TemporalScheduleManagerService } from './discovery';

@Module({})
export class TemporalModule {
    static register(options: TemporalOptions): DynamicModule {
        this.validateOptions(options);

        const imports: DynamicModule[] = [];
        const providers: Provider[] = [];

        // Always include client module
        imports.push(TemporalClientModule.register(options));

        // Include worker module only if worker configuration is provided
        if (options.worker && (options.worker.workflowsPath || options.worker.workflowBundle)) {
            imports.push(TemporalWorkerModule.register(options));
        }

        // Core providers
        providers.push(
            {
                provide: TEMPORAL_MODULE_OPTIONS,
                useValue: options,
            },
            TemporalDiscoveryService,
            TemporalScheduleManagerService,
            TemporalService,
        );

        return {
            module: TemporalModule,
            imports: [DiscoveryModule, ...imports],
            providers,
            exports: [TemporalService, TEMPORAL_MODULE_OPTIONS],
            global: options.isGlobal,
        };
    }

    static registerAsync(options: TemporalAsyncOptions): DynamicModule {
        this.validateAsyncOptions(options);

        const imports: (DynamicModule | typeof DiscoveryModule)[] = [DiscoveryModule];
        const providers: Provider[] = [];

        // Create async options provider
        if (options.useFactory) {
            providers.push({
                provide: TEMPORAL_MODULE_OPTIONS,
                useFactory: options.useFactory,
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
                    useFactory: async (optionsFactory: TemporalOptionsFactory) =>
                        optionsFactory.createTemporalOptions(),
                    inject: [options.useClass],
                },
            );
        } else if (options.useExisting) {
            providers.push({
                provide: TEMPORAL_MODULE_OPTIONS,
                useFactory: async (optionsFactory: TemporalOptionsFactory) =>
                    optionsFactory.createTemporalOptions(),
                inject: [options.useExisting],
            });
        }

        // Client module (always required)
        imports.push(
            TemporalClientModule.registerAsync({
                imports: options.imports,
                useFactory: async (...args: unknown[]) => {
                    const temporalOptions = await this.createOptionsFromFactory(options, args);
                    return temporalOptions;
                },
                inject: options.inject,
            }),
        );

        // Worker module (conditional)
        imports.push(
            TemporalWorkerModule.registerAsync({
                imports: options.imports,
                useFactory: async (...args: unknown[]): Promise<TemporalOptions> => {
                    const temporalOptions = await this.createOptionsFromFactory(options, args);

                    // Only include worker if configuration is provided
                    if (
                        !temporalOptions.worker ||
                        (!temporalOptions.worker.workflowsPath &&
                            !temporalOptions.worker.workflowBundle)
                    ) {
                        // Return a modified options without worker configuration
                        const { worker: _worker, ...optionsWithoutWorker } = temporalOptions;
                        return optionsWithoutWorker;
                    }

                    return temporalOptions;
                },
                inject: options.inject,
            }),
        );

        // Add remaining providers
        providers.push(TemporalDiscoveryService, TemporalScheduleManagerService, TemporalService);

        return {
            module: TemporalModule,
            imports: [...(options.imports || []), ...imports],
            providers,
            exports: [TemporalService, TEMPORAL_MODULE_OPTIONS],
            global: options.isGlobal,
        };
    }

    static forClient(options: {
        connection: TemporalOptions['connection'];
        enableLogger?: boolean;
        logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
        isGlobal?: boolean;
    }): DynamicModule {
        return this.register({
            connection: options.connection,
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
            isGlobal: options.isGlobal,
            allowConnectionFailure: true,
        });
    }

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

        // Validate worker configuration if provided
        if (options.worker) {
            const hasWorkflowsPath = Boolean(options.worker.workflowsPath);
            const hasWorkflowBundle = Boolean(options.worker.workflowBundle);

            if (hasWorkflowsPath && hasWorkflowBundle) {
                throw new Error('Worker cannot have both workflowsPath and workflowBundle');
            }
        }
    }

    private static validateAsyncOptions(options: TemporalAsyncOptions): void {
        const hasFactory = Boolean(options.useFactory);
        const hasClass = Boolean(options.useClass);
        const hasExisting = Boolean(options.useExisting);

        const configMethods = [hasFactory, hasClass, hasExisting].filter(Boolean).length;

        if (configMethods === 0) {
            throw new Error(
                `${ERRORS.INVALID_OPTIONS}: Must provide useFactory, useClass, or useExisting`,
            );
        }

        if (configMethods > 1) {
            throw new Error(
                `${ERRORS.INVALID_OPTIONS}: Cannot provide multiple configuration methods`,
            );
        }
    }

    private static async createOptionsFromFactory(
        options: TemporalAsyncOptions,
        args: unknown[],
    ): Promise<TemporalOptions> {
        if (options.useFactory) {
            return await options.useFactory(...args);
        }

        if (options.useClass) {
            const optionsFactory = new options.useClass() as TemporalOptionsFactory;
            return await optionsFactory.createTemporalOptions();
        }

        if (options.useExisting) {
            throw new Error('useExisting should be handled by dependency injection');
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }
}
