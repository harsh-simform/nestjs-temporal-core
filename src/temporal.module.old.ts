import { DynamicModule, Module, Provider, Type, ForwardReference } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TemporalService } from './services/temporal.service';
import {
    ACTIVITY_MODULE_OPTIONS,
    TEMPORAL_CLIENT,
    TEMPORAL_CONNECTION,
    TEMPORAL_MODULE_OPTIONS,
} from './constants';
import { TemporalDiscoveryService } from './services/temporal-discovery.service';
import { TemporalClientService } from './services/temporal-client.service';
import { TemporalScheduleService } from './services/temporal-schedule.service';
import { TemporalWorkerManagerService } from './services/temporal-worker.service';
import { TemporalActivityService } from './services/temporal-activity.service';
import { TemporalMetadataAccessor } from './services/temporal-metadata.service';
import { TemporalLoggerManager, createLogger, LoggerUtils } from './utils/logger';
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
    static register(options: Partial<TemporalOptions> = {}): DynamicModule {
        this.validateOptions(options);

        const imports: DynamicModule[] = [];
        const providers: Provider[] = [];

        // Core providers
        providers.push(
            {
                provide: TEMPORAL_MODULE_OPTIONS,
                useValue: options,
            },
            {
                provide: TEMPORAL_CLIENT,
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
                    const logger = createLogger('TemporalModule:ClientFactory', {
                        enableLogger: temporalOptions.enableLogger,
                        logLevel: temporalOptions.logLevel,
                    });

                    // Only create client if connection configuration is provided
                    if (!temporalOptions.connection) {
                        logger.info(
                            'No connection configuration provided - running without client',
                        );
                        return null;
                    }

                    try {
                        logger.debug('Importing Temporal client SDK');
                        const temporalClient = await import('@temporalio/client');

                        if (!temporalClient || !temporalClient.Client) {
                            throw new Error(
                                'Failed to import Temporal client - module not available',
                            );
                        }

                        const { Client } = temporalClient;

                        const clientOptions: Record<string, unknown> = {
                            connection: {
                                address: temporalOptions.connection.address,
                                tls: temporalOptions.connection.tls,
                                metadata: temporalOptions.connection.metadata,
                            },
                            namespace: temporalOptions.connection.namespace || 'default',
                        };

                        // Add API key authentication if provided
                        if (temporalOptions.connection.apiKey) {
                            logger.debug('Adding API key authentication to client options');
                            clientOptions.connection = {
                                ...(clientOptions.connection as Record<string, unknown>),
                                metadata: {
                                    ...(temporalOptions.connection.metadata || {}),
                                    authorization: `Bearer ${temporalOptions.connection.apiKey}`,
                                },
                            };
                        }

                        logger.info(
                            `Connecting to Temporal server at ${temporalOptions.connection.address}`,
                        );
                        logger.debug(`Client options: ${JSON.stringify(clientOptions, null, 2)}`);

                        const client = new Client(clientOptions);
                        LoggerUtils.logConnection(logger, temporalOptions.connection.address, true);
                        return client;
                    } catch (error) {
                        const shouldAllowFailure = temporalOptions.allowConnectionFailure !== false;
                        LoggerUtils.logConnection(
                            logger,
                            temporalOptions.connection?.address || 'unknown',
                            false,
                            error as Error,
                        );

                        if (shouldAllowFailure) {
                            logger.warn('Continuing without client due to connection failure');
                            return null;
                        }
                        logger.error('Client initialization failed - throwing error');
                        throw error;
                    }
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            {
                provide: TEMPORAL_CONNECTION,
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
                    const logger = createLogger('TemporalModule:ConnectionFactory', {
                        enableLogger: temporalOptions.enableLogger,
                        logLevel: temporalOptions.logLevel,
                    });
                    try {
                        // Create a NativeConnection when connection options provided; otherwise null
                        if (!temporalOptions.connection) return null;
                        const { NativeConnection } = await import('@temporalio/worker');
                        const address = temporalOptions.connection.address || 'localhost:7233';
                        const connectOptions: any = {
                            address,
                            tls: temporalOptions.connection.tls,
                        };
                        if (temporalOptions.connection.apiKey) {
                            connectOptions.metadata = {
                                ...(temporalOptions.connection.metadata || {}),
                                authorization: `Bearer ${temporalOptions.connection.apiKey}`,
                            };
                        }
                        logger.debug(`Creating NativeConnection to ${address}`);
                        const connection = await NativeConnection.connect(connectOptions);
                        return connection;
                    } catch (error) {
                        logger.warn('Failed to create TEMPORAL_CONNECTION, returning null');
                        return null;
                    }
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
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
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
                    const logger = createLogger('TemporalModule:AsyncClientFactory', {
                        enableLogger: temporalOptions.enableLogger,
                        logLevel: temporalOptions.logLevel,
                    });

                    // Only create client if connection configuration is provided
                    if (!temporalOptions.connection) {
                        logger.info(
                            'No connection configuration provided - running without client',
                        );
                        return null;
                    }

                    try {
                        logger.debug('Importing Temporal client SDK for async configuration');
                        const temporalClient = await import('@temporalio/client');

                        if (!temporalClient || !temporalClient.Client) {
                            throw new Error(
                                'Failed to import Temporal client - module not available',
                            );
                        }

                        const { Client } = temporalClient;

                        const clientOptions: Record<string, unknown> = {
                            connection: {
                                address: temporalOptions.connection.address,
                                tls: temporalOptions.connection.tls,
                                metadata: temporalOptions.connection.metadata,
                            },
                            namespace: temporalOptions.connection.namespace || 'default',
                        };

                        // Add API key authentication if provided
                        if (temporalOptions.connection.apiKey) {
                            logger.debug('Adding API key authentication to async client options');
                            clientOptions.connection = {
                                ...(clientOptions.connection as Record<string, unknown>),
                                metadata: {
                                    ...(temporalOptions.connection.metadata || {}),
                                    authorization: `Bearer ${temporalOptions.connection.apiKey}`,
                                },
                            };
                        }

                        logger.info(
                            `Connecting to Temporal server at ${temporalOptions.connection.address} (async)`,
                        );
                        logger.debug(
                            `Async client options: ${JSON.stringify(clientOptions, null, 2)}`,
                        );

                        const client = new Client(clientOptions);
                        LoggerUtils.logConnection(logger, temporalOptions.connection.address, true);
                        return client;
                    } catch (error) {
                        const shouldAllowFailure = temporalOptions.allowConnectionFailure !== false;
                        LoggerUtils.logConnection(
                            logger,
                            temporalOptions.connection?.address || 'unknown',
                            false,
                            error as Error,
                        );

                        if (shouldAllowFailure) {
                            logger.warn(
                                'Continuing without client due to async connection failure',
                            );
                            return null;
                        }
                        logger.error('Async client initialization failed - throwing error');
                        throw error;
                    }
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            {
                provide: TEMPORAL_CONNECTION,
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
                    const logger = createLogger('TemporalModule:AsyncConnectionFactory', {
                        enableLogger: temporalOptions.enableLogger,
                        logLevel: temporalOptions.logLevel,
                    });
                    try {
                        if (!temporalOptions.connection) return null;
                        const { NativeConnection } = await import('@temporalio/worker');
                        const address = temporalOptions.connection.address || 'localhost:7233';
                        const connectOptions: any = {
                            address,
                            tls: temporalOptions.connection.tls,
                        };
                        if (temporalOptions.connection.apiKey) {
                            connectOptions.metadata = {
                                ...(temporalOptions.connection.metadata || {}),
                                authorization: `Bearer ${temporalOptions.connection.apiKey}`,
                            };
                        }
                        logger.debug(`Creating NativeConnection to ${address} (async)`);
                        const connection = await NativeConnection.connect(connectOptions);
                        return connection;
                    } catch (error) {
                        logger.warn('Failed to create TEMPORAL_CONNECTION (async), returning null');
                        return null;
                    }
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            {
                provide: ACTIVITY_MODULE_OPTIONS,
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
                    return {
                        activityClasses: temporalOptions.worker?.activityClasses || [],
                    };
                },
                inject: [TEMPORAL_MODULE_OPTIONS],
            },
            {
                provide: TemporalLoggerManager,
                useFactory: async (temporalOptions: Partial<TemporalOptions>) => {
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
    private static validateOptions(options: Partial<TemporalOptions>): void {
        if (!options) {
            return; // Allow empty options for minimal configuration
        }

        // Validate connection configuration if provided
        if (options.connection) {
            if (!options.connection.address || !options.connection.address.trim()) {
                throw new Error('Connection address is required when connection is configured');
            }
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
}
