import { DynamicModule, Module, Provider, Type, ForwardReference } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TemporalService } from './services/temporal.service';
import { ACTIVITY_MODULE_OPTIONS, TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from './constants';
import { TemporalDiscoveryService } from './services/temporal-discovery.service';
import { TemporalClientService } from './services/temporal-client.service';
import { TemporalScheduleService } from './services/temporal-schedule.service';
import { TemporalWorkerManagerService } from './services/temporal-worker.service';
import { TemporalActivityService } from './services/temporal-activity.service';
import { TemporalMetadataAccessor } from './services/temporal-metadata.service';
import { TemporalLoggerManager } from './utils/logger';
import { TemporalOptions } from './interfaces';
import { TemporalAsyncOptions, TemporalOptionsFactory } from './interfaces';

/**
 * Main Temporal module for NestJS applications.
 *
 * This module provides:
 * - Temporal client connection management
 * - Worker creation and lifecycle management
 * - Activity and workflow discovery
 * - Schedule management
 * - Comprehensive logging and error handling
 *
 * @example
 * ```typescript
 * // Basic usage
 * @Module({
 *   imports: [
 *     TemporalModule.register({
 *       connection: {
 *         address: 'localhost:7233',
 *         namespace: 'default'
 *       },
 *       taskQueue: 'my-task-queue'
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // Async configuration
 * @Module({
 *   imports: [
 *     TemporalModule.registerAsync({
 *       useFactory: async (configService: ConfigService) => ({
 *         connection: {
 *           address: configService.get('TEMPORAL_ADDRESS'),
 *           namespace: configService.get('TEMPORAL_NAMESPACE')
 *         }
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TemporalModule {
    static register(options: TemporalOptions): DynamicModule {
        this.validateOptions(options);

        const imports: DynamicModule[] = [];
        const providers: Provider[] = [];

        // Note: Client and worker functionality is now integrated into the main module

        // Core providers
        providers.push(
            {
                provide: TEMPORAL_MODULE_OPTIONS,
                useValue: options,
            },
            {
                provide: TEMPORAL_CLIENT,
                useValue: null, // For testing purposes, we'll provide null and let services handle it
            },
            {
                provide: ACTIVITY_MODULE_OPTIONS,
                useValue: {
                    activityClasses: options.worker?.activityClasses || [],
                },
            },
            {
                provide: TemporalLoggerManager,
                useFactory: () => {
                    const manager = TemporalLoggerManager.getInstance();
                    manager.configure({
                        enableLogger: options.enableLogger,
                        logLevel: options.logLevel,
                        appName: 'NestJS-Temporal-Core',
                    });
                    return manager;
                },
            },
            TemporalClientService,
            TemporalScheduleService,
            TemporalDiscoveryService,
            TemporalWorkerManagerService,
            TemporalActivityService,
            TemporalMetadataAccessor,
            TemporalService,
        );

        return {
            module: TemporalModule,
            imports: [DiscoveryModule, ...imports],
            providers,
            exports: [TemporalService, TemporalLoggerManager, TEMPORAL_MODULE_OPTIONS],
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
                inject:
                    (options.inject as (
                        | import('@nestjs/common').InjectionToken
                        | import('@nestjs/common').OptionalFactoryDependency
                    )[]) || [],
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

        // Note: Client and worker functionality is now integrated into the main module

        // Add remaining providers
        providers.push(
            {
                provide: TEMPORAL_CLIENT,
                useValue: null, // For testing purposes, we'll provide null and let services handle it
            },
            {
                provide: ACTIVITY_MODULE_OPTIONS,
                useFactory: async (temporalOptions: TemporalOptions) => {
                    return {
                        activityClasses: temporalOptions.worker?.activityClasses || [],
                    };
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            {
                provide: TemporalLoggerManager,
                useFactory: async (temporalOptions: TemporalOptions) => {
                    const manager = TemporalLoggerManager.getInstance();
                    manager.configure({
                        enableLogger: temporalOptions.enableLogger,
                        logLevel: temporalOptions.logLevel,
                        appName: 'NestJS-Temporal-Core',
                    });
                    return manager;
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            TemporalClientService,
            TemporalScheduleService,
            TemporalDiscoveryService,
            TemporalWorkerManagerService,
            TemporalActivityService,
            TemporalMetadataAccessor,
            TemporalService,
        );

        return {
            module: TemporalModule,
            imports: [
                ...((options.imports as (
                    | DynamicModule
                    | Type<unknown>
                    | Promise<DynamicModule>
                    | ForwardReference<unknown>
                )[]) || []),
                ...imports,
            ],
            providers,
            exports: [TemporalService, TemporalLoggerManager, TEMPORAL_MODULE_OPTIONS],
            global: options.isGlobal,
        };
    }

    /**
     * Validate synchronous options
     */
    private static validateOptions(options: TemporalOptions): void {
        if (!options) {
            throw new Error('Temporal options are required');
        }

        if (!options.connection) {
            throw new Error('Connection configuration is required');
        }

        if (!options.connection.address || !options.connection.address.trim()) {
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

    /**
     * Validate asynchronous options
     */
    private static validateAsyncOptions(options: TemporalAsyncOptions): void {
        const hasFactory = Boolean(options.useFactory);
        const hasClass = Boolean(options.useClass);
        const hasExisting = Boolean(options.useExisting);

        const configMethods = [hasFactory, hasClass, hasExisting].filter(Boolean).length;

        if (configMethods === 0) {
            throw new Error(
                'Invalid Temporal module options: Must provide useFactory, useClass, or useExisting',
            );
        }

        if (configMethods > 1) {
            throw new Error(
                'Invalid Temporal module options: Cannot provide multiple configuration methods',
            );
        }
    }

    /**
     * Create options from factory based on configuration type
     */
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

        throw new Error('Invalid Temporal module options');
    }
}
