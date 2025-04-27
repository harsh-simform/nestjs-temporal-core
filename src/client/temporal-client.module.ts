import {
    DynamicModule,
    Global,
    Module,
    Provider,
    OnApplicationShutdown,
    Logger,
} from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import {
    TemporalClientOptions,
    TemporalClientAsyncOptions,
    TemporalClientOptionsFactory,
} from '../interfaces';
import {
    TEMPORAL_CLIENT,
    TEMPORAL_CLIENT_MODULE_OPTIONS,
    DEFAULT_NAMESPACE,
    ERRORS,
} from '../constants';
import { TemporalClientService } from './temporal-client.service';
import { TemporalScheduleService } from './temporal-schedule.service';

/**
 * Global module for Temporal client configuration
 * Provides a configured Temporal client throughout the application
 */
@Global()
@Module({})
export class TemporalClientModule {
    private static readonly logger = new Logger(TemporalClientModule.name);

    /**
     * Creates a Temporal client instance
     * @param options Client configuration options
     * @returns Configured Temporal client
     */
    private static async createClient(options: TemporalClientOptions): Promise<Client> {
        let connection: Connection | null = null;
        try {
            this.logger.log(`Connecting to Temporal server at ${options.connection.address}`);

            // Create connection with appropriate options
            connection = await Connection.connect({
                address: options.connection.address,
                tls: options.connection.tls,
                metadata: options.connection.metadata,
                ...(options.connection.apiKey && {
                    metadata: {
                        ...options.connection.metadata,
                        authorization: `Bearer ${options.connection.apiKey}`,
                    },
                }),
                ...(options.connection.connectionTimeout && {
                    connectionTimeout: options.connection.connectionTimeout,
                }),
            });

            const namespace = options.namespace || DEFAULT_NAMESPACE;
            this.logger.log(`Connected to Temporal server, using namespace "${namespace}"`);

            return new Client({
                connection,
                namespace,
            });
        } catch (error) {
            if (connection) {
                await connection.close().catch((closeError) => {
                    this.logger.error(
                        'Failed to close Temporal connection during error handling',
                        closeError,
                    );
                });
            }

            const errorMsg = `${ERRORS.CLIENT_INITIALIZATION}: ${error.message}`;
            this.logger.error(errorMsg, error.stack);
            throw new Error(errorMsg);
        }
    }

    /**
     * Synchronously register Temporal client module with options
     * @param options Client configuration
     * @returns Configured dynamic module
     */
    static register(options: TemporalClientOptions): DynamicModule {
        const clientProvider = {
            provide: TEMPORAL_CLIENT,
            useFactory: async () => {
                try {
                    const client = await this.createClient(options);
                    return this.addShutdownHook(client);
                } catch (error) {
                    this.logger.error('Failed to initialize Temporal client', error);

                    // Allow server to start even if Temporal client fails
                    if (options.allowConnectionFailure !== false) {
                        this.logger.warn('Continuing application startup without Temporal client');
                        return null;
                    }

                    throw error;
                }
            },
        };

        return {
            module: TemporalClientModule,
            providers: [
                {
                    provide: TEMPORAL_CLIENT_MODULE_OPTIONS,
                    useValue: options,
                },
                clientProvider,
                TemporalClientService,
                TemporalScheduleService,
            ],
            exports: [TemporalClientService, TemporalScheduleService],
        };
    }

    /**
     * Asynchronously register Temporal client module with factory
     * @param options Async client configuration
     * @returns Configured dynamic module
     */
    static registerAsync(options: TemporalClientAsyncOptions): DynamicModule {
        const clientProvider = {
            provide: TEMPORAL_CLIENT,
            useFactory: async (clientOptions: TemporalClientOptions) => {
                try {
                    const client = await this.createClient(clientOptions);
                    return this.addShutdownHook(client);
                } catch (error) {
                    this.logger.error('Failed to initialize Temporal client', error);

                    // Allow server to start even if Temporal client fails
                    if (clientOptions.allowConnectionFailure !== false) {
                        this.logger.warn('Continuing application startup without Temporal client');
                        return null;
                    }

                    throw error;
                }
            },
            inject: [TEMPORAL_CLIENT_MODULE_OPTIONS],
        };

        return {
            module: TemporalClientModule,
            imports: options.imports || [],
            providers: [
                ...this.createAsyncProviders(options),
                clientProvider,
                TemporalClientService,
                TemporalScheduleService,
            ],
            exports: [TemporalClientService, TemporalScheduleService],
        };
    }

    /**
     * Creates providers for async module configuration
     * @param options Async options
     * @returns Array of providers
     */
    private static createAsyncProviders(options: TemporalClientAsyncOptions): Provider[] {
        if (options.useFactory) {
            return [
                {
                    provide: TEMPORAL_CLIENT_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ];
        }

        if (options.useClass) {
            return [
                {
                    provide: TEMPORAL_CLIENT_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalClientOptionsFactory) =>
                        await optionsFactory.createClientOptions(),
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
                    provide: TEMPORAL_CLIENT_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalClientOptionsFactory) =>
                        await optionsFactory.createClientOptions(),
                    inject: [options.useExisting],
                },
            ];
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }

    /**
     * Adds application shutdown hook to client
     * @param client Temporal client
     * @returns Enhanced client with shutdown hook
     */
    private static addShutdownHook(client: Client): Client & OnApplicationShutdown {
        const enhancedClient = client as Client & OnApplicationShutdown;

        enhancedClient.onApplicationShutdown = async (signal?: string) => {
            this.logger.log(`Closing Temporal client connection (signal: ${signal})`);

            if (client?.connection) {
                try {
                    await client.connection.close();
                    this.logger.log('Temporal connection closed successfully');
                } catch (error) {
                    this.logger.error('Failed to close Temporal connection', error);
                }
            }
        };

        return enhancedClient;
    }
}
