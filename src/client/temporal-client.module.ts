import { DynamicModule, Global, Module, OnApplicationShutdown, Provider } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { TemporalAsyncOptions, TemporalOptions, TemporalOptionsFactory } from '../interfaces';
import { DEFAULT_NAMESPACE, ERRORS, TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../constants';
import { TemporalClientService } from './temporal-client.service';
import { TemporalScheduleService } from './temporal-schedule.service';
import { TemporalLogger } from '../utils/logger';

/**
 * Streamlined Temporal Client Module
 * Provides configured Temporal client and services throughout the application
 */
@Global()
@Module({})
export class TemporalClientModule {
    private static createModuleLogger(options?: any): TemporalLogger {
        return new TemporalLogger(TemporalClientModule.name, {
            enableLogger: options?.enableLogger,
            logLevel: options?.logLevel,
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
     * Create client provider for sync registration
     */
    private static createClientProvider(options: any): Provider {
        return {
            provide: TEMPORAL_CLIENT,
            useFactory: async () =>
                this.createClientInstance(options, this.createModuleLogger(options)),
        };
    }

    /**
     * Create client provider for async registration
     */
    private static createAsyncClientProvider(): Provider {
        return {
            provide: TEMPORAL_CLIENT,
            useFactory: async (temporalOptions: TemporalOptions) => {
                const clientOptions = this.extractClientOptions(temporalOptions);
                return this.createClientInstance(
                    clientOptions,
                    this.createModuleLogger(clientOptions),
                );
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
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ];
        }

        if (options.useClass) {
            return [
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalOptionsFactory) =>
                        optionsFactory.createTemporalOptions(),
                    inject: [options.useClass],
                },
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
            ];
        }

        if (options.useExisting) {
            return [
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalOptionsFactory) =>
                        optionsFactory.createTemporalOptions(),
                    inject: [options.useExisting],
                },
            ];
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }

    // ==========================================
    // Client Instance Creation
    // ==========================================

    /**
     * Create and configure Temporal client instance
     */
    private static async createClientInstance(
        options: any,
        logger: TemporalLogger,
    ): Promise<Client | null> {
        let connection: Connection | null = null;

        try {
            logger.log(`Connecting to Temporal server at ${options.connection.address}`);

            // Create connection with proper configuration
            const connectionConfig: any = {
                address: options.connection.address,
                tls: options.connection.tls,
                metadata: options.connection.metadata,
            };

            // Add API key authentication if provided
            if (options.connection.apiKey) {
                connectionConfig.metadata = {
                    ...connectionConfig.metadata,
                    authorization: `Bearer ${options.connection.apiKey}`,
                };
            }

            connection = await Connection.connect(connectionConfig);

            const namespace = options.connection.namespace || DEFAULT_NAMESPACE;
            logger.log(`Connected to Temporal server, using namespace "${namespace}"`);

            // Create client with shutdown capabilities
            const client = new Client({ connection, namespace });
            return this.enhanceClientWithShutdown(client, logger);
        } catch (error) {
            // Cleanup connection on error
            if (connection) {
                await connection.close().catch((closeError) => {
                    logger.error('Failed to close connection during error cleanup', closeError);
                });
            }

            const errorMsg = `${ERRORS.CLIENT_INITIALIZATION}: ${error.message}`;
            logger.error(errorMsg, error.stack);

            // Allow graceful failure if configured
            if (options.allowConnectionFailure !== false) {
                logger.warn('Continuing application startup without Temporal client');
                return null;
            }

            throw new Error(errorMsg);
        }
    }

    /**
     * Enhance client with application shutdown capabilities
     */
    private static enhanceClientWithShutdown(
        client: Client,
        logger: TemporalLogger,
    ): Client & OnApplicationShutdown {
        const enhancedClient = client as Client & OnApplicationShutdown;

        enhancedClient.onApplicationShutdown = async (signal?: string) => {
            logger.log(`Closing Temporal client connection (signal: ${signal})`);

            try {
                if (client?.connection) {
                    await client.connection.close();
                    logger.log('Temporal connection closed successfully');
                }
            } catch (error) {
                logger.error('Failed to close Temporal connection', error);
            }
        };

        return enhancedClient;
    }

    // ==========================================
    // Helper Methods
    // ==========================================

    /**
     * Extract client-specific options from full Temporal options
     */
    private static extractClientOptions(options: TemporalOptions): any {
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
    private static validateOptions(options: any): void {
        if (!options.connection) {
            throw new Error('Connection configuration is required');
        }

        if (!options.connection.address) {
            throw new Error('Connection address is required');
        }
    }
}
