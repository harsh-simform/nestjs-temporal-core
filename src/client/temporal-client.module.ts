import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { TemporalAsyncOptions, TemporalOptions, TemporalOptionsFactory } from '../interfaces';
import { DEFAULT_NAMESPACE, ERRORS, TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { TemporalClientService } from './temporal-client.service';
import { TemporalScheduleService } from './temporal-schedule.service';
import { TemporalLogger } from '../utils/logger';

interface ClientConnectionOptions {
    address: string;
    tls?: unknown;
    metadata?: Record<string, string>;
    apiKey?: string;
    namespace?: string;
}

/**
 * Streamlined Temporal Client Module
 * Provides configured Temporal client and services throughout the application
 */
@Global()
@Module({})
export class TemporalClientModule {
    private static createModuleLogger(options?: Record<string, unknown>): TemporalLogger {
        return new TemporalLogger(TemporalClientModule.name, {
            enableLogger: options?.enableLogger as boolean | undefined,
            logLevel: options?.logLevel as
                | 'error'
                | 'warn'
                | 'info'
                | 'debug'
                | 'verbose'
                | undefined,
        });
    }

    // ==========================================
    // Synchronous Registration
    // ==========================================

    /**
     * Register module with synchronous options
     */
    static register(options: TemporalOptions): DynamicModule {
        const clientOptions = this.extractClientOptions(options);

        return {
            module: TemporalClientModule,
            providers: [
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: clientOptions,
                },
                this.createClientProvider(clientOptions),
                TemporalClientService,
                TemporalScheduleService,
            ],
            exports: [TemporalClientService, TemporalScheduleService, TEMPORAL_CLIENT],
        };
    }

    // ==========================================
    // Asynchronous Registration
    // ==========================================

    /**
     * Register module with asynchronous options
     */
    static registerAsync(options: TemporalAsyncOptions): DynamicModule {
        return {
            module: TemporalClientModule,
            imports: options.imports || [],
            providers: [
                ...this.createAsyncProviders(options),
                this.createAsyncClientProvider(),
                TemporalClientService,
                TemporalScheduleService,
            ],
            exports: [TemporalClientService, TemporalScheduleService, TEMPORAL_CLIENT],
        };
    }

    // ==========================================
    // Simplified Registration Methods
    // ==========================================

    /**
     * Register for client-only usage (no worker)
     */
    static forClient(options: {
        connection: TemporalOptions['connection'];
        isGlobal?: boolean;
    }): DynamicModule {
        return this.register({
            connection: options.connection,
            isGlobal: options.isGlobal,
        });
    }

    // ==========================================
    // Provider Creation Methods
    // ==========================================

    /**
     * Create synchronous client provider
     */
    private static createClientProvider(options: Record<string, unknown>): Provider {
        return {
            provide: TEMPORAL_CLIENT,
            useFactory: async (): Promise<Client | null> => {
                const logger = this.createModuleLogger(options);
                return this.createClientInstance(options, logger);
            },
        };
    }

    /**
     * Create asynchronous client provider
     */
    private static createAsyncClientProvider(): Provider {
        return {
            provide: TEMPORAL_CLIENT,
            useFactory: async (options: Record<string, unknown>): Promise<Client | null> => {
                const logger = this.createModuleLogger(options);
                return this.createClientInstance(options, logger);
            },
            inject: [TEMPORAL_MODULE_OPTIONS],
        };
    }

    /**
     * Create async providers based on configuration type
     */
    private static createAsyncProviders(options: TemporalAsyncOptions): Provider[] {
        if (options.useFactory) {
            return [
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (...args: unknown[]) => {
                        const temporalOptions = await options.useFactory!(...args);
                        return this.extractClientOptions(temporalOptions);
                    },
                    inject: options.inject || [],
                },
            ];
        }

        if (options.useClass) {
            return [
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalOptionsFactory) => {
                        const temporalOptions = await optionsFactory.createTemporalOptions();
                        return this.extractClientOptions(temporalOptions);
                    },
                    inject: [options.useClass],
                },
            ];
        }

        if (options.useExisting) {
            return [
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalOptionsFactory) => {
                        const temporalOptions = await optionsFactory.createTemporalOptions();
                        return this.extractClientOptions(temporalOptions);
                    },
                    inject: [options.useExisting],
                },
            ];
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }

    /**
     * Create and configure Temporal client instance
     */
    private static async createClientInstance(
        options: Record<string, unknown>,
        logger: TemporalLogger,
    ): Promise<Client | null> {
        let temporalConnection: Connection | null = null;

        try {
            const connection = options.connection as ClientConnectionOptions;
            logger.log(`Connecting to Temporal server at ${connection.address}`);

            // Create connection with proper configuration
            const connectionConfig: Record<string, unknown> = {
                address: connection.address,
                tls: connection.tls,
                metadata: connection.metadata,
            };

            // Add API key authentication if provided
            if (connection.apiKey) {
                connectionConfig.metadata = {
                    ...((connectionConfig.metadata as Record<string, string>) || {}),
                    authorization: `Bearer ${connection.apiKey}`,
                };
            }

            temporalConnection = await Connection.connect(connectionConfig);

            const namespace = connection.namespace || DEFAULT_NAMESPACE;
            logger.log(`Connected to Temporal server, using namespace "${namespace}"`);

            // Create client with shutdown capabilities
            const client = new Client({ connection: temporalConnection, namespace });
            return this.enhanceClientWithShutdown(client, logger);
        } catch (error) {
            // Cleanup connection on error
            if (temporalConnection) {
                await temporalConnection.close().catch((closeError) => {
                    logger.warn(`Error closing connection: ${(closeError as Error).message}`);
                });
            }

            const errorMsg = `${ERRORS.CLIENT_INITIALIZATION}: ${(error as Error).message}`;
            logger.error(errorMsg, (error as Error).stack);

            // Check if we should allow connection failure
            if (options.allowConnectionFailure !== false) {
                logger.warn('Continuing application startup without Temporal client');
                return null;
            }

            throw new Error(errorMsg);
        }
    }

    /**
     * Enhance client with proper shutdown handling
     */
    private static enhanceClientWithShutdown(client: Client, logger: TemporalLogger): Client {
        const originalConnection = client.connection;

        // Add graceful shutdown
        process.on('SIGTERM', async () => {
            logger.log('Gracefully shutting down Temporal client...');
            try {
                await originalConnection.close();
                logger.log('Temporal client shutdown completed');
            } catch (error) {
                logger.error(`Error during client shutdown: ${(error as Error).message}`);
            }
        });

        return client;
    }

    /**
     * Extract client-specific options from full Temporal options
     */
    private static extractClientOptions(options: TemporalOptions): Record<string, unknown> {
        return {
            connection: {
                address: options.connection.address,
                namespace: options.connection.namespace,
                tls: options.connection.tls,
                apiKey: options.connection.apiKey,
                metadata: options.connection.metadata,
            },
            allowConnectionFailure: true, // Default to graceful failure
            enableLogger: options.enableLogger,
            logLevel: options.logLevel,
        };
    }

    /**
     * Validate client options
     */
    private static validateOptions(options: Record<string, unknown>): void {
        if (!options.connection) {
            throw new Error('Connection configuration is required');
        }

        const connection = options.connection as ClientConnectionOptions;
        if (!connection.address) {
            throw new Error('Connection address is required');
        }
    }
}
