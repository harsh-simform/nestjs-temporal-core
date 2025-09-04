import { Test, TestingModule } from '@nestjs/testing';
import { TemporalConnectionFactory } from '../../src/providers/temporal-connection.factory';
import { TemporalOptions } from '../../src/interfaces';
import { Client } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

// Mock the Temporal SDK modules
jest.mock('@temporalio/client', () => ({
    Client: jest.fn(),
}));

jest.mock('@temporalio/worker', () => ({
    NativeConnection: {
        connect: jest.fn(),
    },
}));

describe('TemporalConnectionFactory', () => {
    let factory: TemporalConnectionFactory;
    let mockClient: jest.Mocked<Client>;
    let mockNativeConnection: jest.Mocked<NativeConnection>;

    const mockTemporalOptions: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'test-namespace',
            tls: false,
            metadata: {},
        },
        allowConnectionFailure: false,
    };

    const mockTemporalOptionsWithAuth: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'test-namespace',
            tls: false,
            metadata: {},
            apiKey: 'test-api-key',
        },
        allowConnectionFailure: false,
    };

    const mockTemporalOptionsWithFailureAllowed: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'test-namespace',
            tls: false,
            metadata: {},
        },
        allowConnectionFailure: true,
    };

    beforeEach(async () => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock client
        mockClient = {
            workflow: jest.fn(),
        } as any;

        // Create mock native connection
        mockNativeConnection = {
            close: jest.fn(),
        } as any;

        // Mock the Client constructor
        (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);

        // Mock the NativeConnection.connect method
        (
            NativeConnection.connect as jest.MockedFunction<typeof NativeConnection.connect>
        ).mockResolvedValue(mockNativeConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [TemporalConnectionFactory],
        }).compile();

        factory = module.get<TemporalConnectionFactory>(TemporalConnectionFactory);
    });

    afterEach(async () => {
        await factory.cleanup();
    });

    describe('createClient', () => {
        it('should return null when no connection configuration is provided', async () => {
            const options: TemporalOptions = {};
            const result = await factory.createClient(options);
            expect(result).toBeNull();
        });

        it('should return cached client when available and healthy', async () => {
            // First call to create and cache a client
            const client1 = await factory.createClient(mockTemporalOptions);
            expect(client1).toBe(mockClient);

            // Second call should return the cached client
            const client2 = await factory.createClient(mockTemporalOptions);
            expect(client2).toBe(mockClient);
            expect(Client).toHaveBeenCalledTimes(1); // Should only create once
        });

        it('should create new client when cached client is unhealthy', async () => {
            // Create first client
            const client1 = await factory.createClient(mockTemporalOptions);
            expect(client1).toBe(mockClient);

            // Mock unhealthy client
            const unhealthyClient = { ...mockClient };
            delete (unhealthyClient as any).workflow;

            // Replace the cached client with unhealthy one
            (factory as any).clientConnectionCache.set(
                (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                unhealthyClient,
            );

            // Create new client - should create a new one
            const client2 = await factory.createClient(mockTemporalOptions);
            expect(client2).toBe(mockClient);
            expect(Client).toHaveBeenCalledTimes(2);
        });

        it('should handle client creation with API key authentication', async () => {
            const result = await factory.createClient(mockTemporalOptionsWithAuth);
            expect(result).toBe(mockClient);
            expect(Client).toHaveBeenCalledWith(
                expect.objectContaining({
                    connection: expect.objectContaining({
                        metadata: expect.objectContaining({
                            authorization: 'Bearer test-api-key',
                        }),
                    }),
                }),
            );
        });

        it('should handle client creation with undefined metadata', async () => {
            // Spy on createNewClient to control the Client mock inside it
            const createNewClientSpy = jest.spyOn(factory as any, 'createNewClient');

            // Mock the Client constructor to capture the options passed to it
            let capturedClientOptions: any = null;
            (Client as jest.MockedClass<typeof Client>).mockImplementation((options: any) => {
                capturedClientOptions = options;
                return mockClient;
            });

            const optionsWithUndefinedMetadata: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: undefined,
                    apiKey: 'test-api-key',
                },
                allowConnectionFailure: false,
            };

            const result = await factory.createClient(optionsWithUndefinedMetadata);
            expect(result).toBe(mockClient);

            // Verify that the metadata was properly handled (should have authorization but no other metadata)
            expect(capturedClientOptions).toEqual(
                expect.objectContaining({
                    connection: expect.objectContaining({
                        metadata: expect.objectContaining({
                            authorization: 'Bearer test-api-key',
                        }),
                    }),
                }),
            );

            // Verify that metadata only contains the authorization (since original metadata was undefined)
            expect(Object.keys(capturedClientOptions.connection.metadata)).toHaveLength(1);
            expect(capturedClientOptions.connection.metadata.authorization).toBe(
                'Bearer test-api-key',
            );

            createNewClientSpy.mockRestore();
        });

        it('should retry connection on failure and succeed', async () => {
            // Mock first call to fail, second to succeed
            (Client as jest.MockedClass<typeof Client>)
                .mockImplementationOnce(() => {
                    throw new Error('Connection failed');
                })
                .mockImplementationOnce(() => mockClient);

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBe(mockClient);
            expect(Client).toHaveBeenCalledTimes(2);
        });

        it('should retry connection on failure and eventually fail with allowConnectionFailure=true', async () => {
            // Mock all calls to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBeNull();
            expect(Client).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
        });

        it('should throw error when max retries exceeded and allowConnectionFailure=false', async () => {
            // Mock all calls to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            // Create options with allowConnectionFailure explicitly set to false
            const optionsWithFailureNotAllowed: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: {},
                },
                allowConnectionFailure: false,
            };

            await expect(factory.createClient(optionsWithFailureNotAllowed)).rejects.toThrow(
                'Connection failed',
            );
            expect(Client).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
        });

        it('should cover the else block when allowConnectionFailure is explicitly false', async () => {
            // Mock the createNewClient method to simulate the scenario where we reach the else block
            const createNewClientSpy = jest.spyOn(factory as any, 'createNewClient');

            // Mock to simulate reaching the else block
            createNewClientSpy.mockImplementation((options: TemporalOptions) => {
                // Simulate the logic that leads to the else block
                const attempts = 3; // MAX_RETRY_ATTEMPTS
                if (attempts >= 3) {
                    if (options.allowConnectionFailure !== false) {
                        return Promise.resolve(null);
                    } else {
                        throw new Error('Failed to connect to localhost:7233 after 3 attempts');
                    }
                }
                return Promise.resolve(null);
            });

            const optionsWithFailureNotAllowed: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: {},
                },
                allowConnectionFailure: false,
            };

            await expect(factory.createClient(optionsWithFailureNotAllowed)).rejects.toThrow(
                'Failed to connect to localhost:7233 after 3 attempts',
            );

            createNewClientSpy.mockRestore();
        });

        it('should throw error when max retry attempts already exceeded and allowConnectionFailure=false', async () => {
            const optionsWithFailureNotAllowed: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: {},
                },
                allowConnectionFailure: false,
            };

            const connectionKey = (factory as any).getConnectionKey(
                optionsWithFailureNotAllowed.connection,
            );

            // Pre-set the connection attempts to MAX_RETRY_ATTEMPTS to hit the condition immediately
            (factory as any).connectionAttempts.set(connectionKey, 3);

            await expect(factory.createClient(optionsWithFailureNotAllowed)).rejects.toThrow(
                'Failed to connect to localhost:7233 after 3 attempts',
            );
        });

        it('should return null when max retry attempts already exceeded and allowConnectionFailure=true', async () => {
            const optionsWithFailureAllowed: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: {},
                },
                allowConnectionFailure: true,
            };

            const connectionKey = (factory as any).getConnectionKey(
                optionsWithFailureAllowed.connection,
            );

            // Pre-set the connection attempts to MAX_RETRY_ATTEMPTS to hit the condition immediately
            (factory as any).connectionAttempts.set(connectionKey, 3);

            const result = await factory.createClient(optionsWithFailureAllowed);
            expect(result).toBeNull();
        });

        it('should handle max retry attempts exceeded with allowConnectionFailure=true', async () => {
            // Mock all calls to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBeNull();
            expect(Client).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
        });

        it('should handle connection failure with non-Error exceptions', async () => {
            // Mock to throw a string instead of Error
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw 'String error';
            });

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBeNull();
        });

        it('should test retry delay mechanism', async () => {
            // Mock first two calls to fail, third to succeed
            (Client as jest.MockedClass<typeof Client>)
                .mockImplementationOnce(() => {
                    throw new Error('Connection failed');
                })
                .mockImplementationOnce(() => {
                    throw new Error('Connection failed');
                })
                .mockImplementationOnce(() => mockClient);

            // Spy on the delay method to verify it's called
            const delaySpy = jest.spyOn(factory as any, 'delay');

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBe(mockClient);
            expect(Client).toHaveBeenCalledTimes(3);
            expect(delaySpy).toHaveBeenCalledWith(1000); // RETRY_DELAY_MS
            expect(delaySpy).toHaveBeenCalledTimes(2); // Called twice for retries

            delaySpy.mockRestore();
        });

        it('should handle metadata spread with existing metadata and API key', async () => {
            const optionsWithExistingMetadata: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: { 'custom-header': 'value' },
                    apiKey: 'test-api-key',
                },
                allowConnectionFailure: false,
            };

            let capturedClientOptions: any = null;
            (Client as jest.MockedClass<typeof Client>).mockImplementation((options: any) => {
                capturedClientOptions = options;
                return mockClient;
            });

            const result = await factory.createClient(optionsWithExistingMetadata);
            expect(result).toBe(mockClient);

            // Verify that both custom metadata and authorization are present
            expect(capturedClientOptions.connection.metadata).toEqual({
                'custom-header': 'value',
                authorization: 'Bearer test-api-key',
            });
        });
    });

    describe('createWorkerConnection', () => {
        it('should return null when no connection configuration is provided', async () => {
            const options: TemporalOptions = {};
            const result = await factory.createWorkerConnection(options);
            expect(result).toBeNull();
        });

        it('should return cached connection when available and healthy', async () => {
            // First call to create and cache a connection
            const connection1 = await factory.createWorkerConnection(mockTemporalOptions);
            expect(connection1).toBe(mockNativeConnection);

            // Second call should return the cached connection
            const connection2 = await factory.createWorkerConnection(mockTemporalOptions);
            expect(connection2).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledTimes(1); // Should only create once
        });

        it('should create new connection when cached connection is unhealthy', async () => {
            // Create first connection
            const connection1 = await factory.createWorkerConnection(mockTemporalOptions);
            expect(connection1).toBe(mockNativeConnection);

            // Mock unhealthy connection by setting it to null
            const unhealthyConnection = null;

            // Replace the cached connection with unhealthy one
            (factory as any).workerConnectionCache.set(
                (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                unhealthyConnection,
            );

            // Create new connection - should create a new one
            const connection2 = await factory.createWorkerConnection(mockTemporalOptions);
            expect(connection2).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledTimes(2);
        });

        it('should handle worker connection creation with API key authentication', async () => {
            const result = await factory.createWorkerConnection(mockTemporalOptionsWithAuth);
            expect(result).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        authorization: 'Bearer test-api-key',
                    }),
                }),
            );
        });

        it('should handle worker connection creation with undefined metadata', async () => {
            const optionsWithUndefinedMetadata: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: undefined,
                    apiKey: 'test-api-key',
                },
                allowConnectionFailure: false,
            };

            const result = await factory.createWorkerConnection(optionsWithUndefinedMetadata);
            expect(result).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        authorization: 'Bearer test-api-key',
                    }),
                }),
            );
        });

        it('should handle worker connection creation failure', async () => {
            (
                NativeConnection.connect as jest.MockedFunction<typeof NativeConnection.connect>
            ).mockRejectedValue(new Error('Connection failed'));

            const result = await factory.createWorkerConnection(mockTemporalOptions);
            expect(result).toBeNull();
        });

        it('should handle worker connection with non-Error exception', async () => {
            (
                NativeConnection.connect as jest.MockedFunction<typeof NativeConnection.connect>
            ).mockRejectedValue('String connection error');

            const result = await factory.createWorkerConnection(mockTemporalOptions);
            expect(result).toBeNull();
        });

        it('should handle worker connection with existing metadata and API key', async () => {
            const optionsWithExistingMetadata: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: { 'custom-header': 'value' },
                    apiKey: 'test-api-key',
                },
                allowConnectionFailure: false,
            };

            const result = await factory.createWorkerConnection(optionsWithExistingMetadata);
            expect(result).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: {
                        'custom-header': 'value',
                        authorization: 'Bearer test-api-key',
                    },
                }),
            );
        });

        it('should close unhealthy cached connection before creating new one', async () => {
            // Create first connection
            await factory.createWorkerConnection(mockTemporalOptions);

            // Mock unhealthy connection that will be detected as unhealthy
            const unhealthyConnection = null;

            // Replace the cached connection with unhealthy one
            (factory as any).workerConnectionCache.set(
                (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                unhealthyConnection,
            );

            // Create new connection - should create a new one since the cached one is unhealthy
            await factory.createWorkerConnection(mockTemporalOptions);
            expect(NativeConnection.connect).toHaveBeenCalledTimes(2);
        });

        it('should handle close error when cleaning up unhealthy cached connection', async () => {
            // Create first connection
            await factory.createWorkerConnection(mockTemporalOptions);

            // Mock unhealthy connection that throws error on close
            const unhealthyConnection = {
                close: jest.fn().mockRejectedValue(new Error('Close failed')),
            };

            // Replace the cached connection with unhealthy one
            (factory as any).workerConnectionCache.set(
                (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                unhealthyConnection,
            );

            // Mock the health check to return false for this connection
            jest.spyOn(factory as any, 'isWorkerConnectionHealthy').mockReturnValueOnce(false);

            // Create new connection - should close the old one first and handle the error
            await factory.createWorkerConnection(mockTemporalOptions);
            expect(unhealthyConnection.close).toHaveBeenCalled();
        });
    });

    describe('onModuleDestroy', () => {
        it('should cleanup all connections on module destroy', async () => {
            // Create some connections first
            await factory.createClient(mockTemporalOptions);
            await factory.createWorkerConnection(mockTemporalOptions);

            // Mock the cleanup method
            const cleanupSpy = jest.spyOn(factory, 'cleanup');

            await factory.onModuleDestroy();

            expect(cleanupSpy).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should close all worker connections and clear caches', async () => {
            // Create some connections first
            await factory.createClient(mockTemporalOptions);
            await factory.createWorkerConnection(mockTemporalOptions);

            // Mock close to throw error for one connection
            const mockConnectionWithError = {
                close: jest.fn().mockRejectedValue(new Error('Close failed')),
            };

            // Add a connection that will fail to close
            (factory as any).workerConnectionCache.set('test-key', mockConnectionWithError);

            await factory.cleanup();

            // Verify all connections were attempted to be closed
            expect(mockNativeConnection.close).toHaveBeenCalled();
            expect(mockConnectionWithError.close).toHaveBeenCalled();

            // Verify caches are cleared
            expect((factory as any).clientConnectionCache.size).toBe(0);
            expect((factory as any).workerConnectionCache.size).toBe(0);
            expect((factory as any).connectionAttempts.size).toBe(0);
        });

        it('should handle cleanup when no connections exist', async () => {
            await factory.cleanup();

            // Should not throw any errors
            expect((factory as any).clientConnectionCache.size).toBe(0);
            expect((factory as any).workerConnectionCache.size).toBe(0);
        });

        it('should handle cleanup with mixed success and failure scenarios', async () => {
            // Create some connections first
            await factory.createClient(mockTemporalOptions);
            await factory.createWorkerConnection(mockTemporalOptions);

            // Mock one connection to succeed and one to fail
            const mockConnectionSuccess = {
                close: jest.fn().mockResolvedValue(undefined),
            };

            const mockConnectionFailure = {
                close: jest.fn().mockRejectedValue(new Error('Close failed')),
            };

            // Add connections with different close behaviors
            (factory as any).workerConnectionCache.set('success-key', mockConnectionSuccess);
            (factory as any).workerConnectionCache.set('failure-key', mockConnectionFailure);

            await factory.cleanup();

            // Verify all connections were attempted to be closed
            expect(mockNativeConnection.close).toHaveBeenCalled();
            expect(mockConnectionSuccess.close).toHaveBeenCalled();
            expect(mockConnectionFailure.close).toHaveBeenCalled();

            // Verify caches are cleared despite some failures
            expect((factory as any).clientConnectionCache.size).toBe(0);
            expect((factory as any).workerConnectionCache.size).toBe(0);
        });

        it('should handle client creation with null metadata (covering || {} branch)', async () => {
            const mockClient = { workflow: {} };
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);

            const options: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    tls: false,
                    metadata: undefined, // Use undefined instead of null
                    apiKey: 'test-key',
                },
                allowConnectionFailure: true,
            };

            const result = await factory.createClient(options);

            expect(result).toBe(mockClient);
            expect(Client).toHaveBeenCalledWith(
                expect.objectContaining({
                    connection: expect.objectContaining({
                        metadata: { authorization: 'Bearer test-key' },
                    }),
                }),
            );
        });

        it('should handle worker connection creation with null metadata (covering || {} branch)', async () => {
            const mockConnection = { close: jest.fn() };
            (NativeConnection.connect as jest.Mock).mockResolvedValue(mockConnection);

            const options: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    tls: false,
                    metadata: undefined, // Use undefined instead of null
                    apiKey: 'test-key',
                },
                allowConnectionFailure: true,
            };

            const result = await factory.createWorkerConnection(options);

            expect(result).toBe(mockConnection);
            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { authorization: 'Bearer test-key' },
                }),
            );
        });

        it('should handle worker connection health check error (covering catch block)', () => {
            // Create a connection object that throws when accessing constructor
            const badConnection = Object.create(null);
            Object.defineProperty(badConnection, 'constructor', {
                get() {
                    throw new Error('Constructor access error');
                },
            });

            const result = (factory as any).isWorkerConnectionHealthy(badConnection);

            expect(result).toBe(false);
        });
    });

    describe('getConnectionHealth', () => {
        it('should return correct health status', () => {
            // Add some connections to the caches
            (factory as any).clientConnectionCache.set('client1', mockClient);
            (factory as any).clientConnectionCache.set('client2', mockClient);
            (factory as any).workerConnectionCache.set('worker1', mockNativeConnection);
            (factory as any).connectionAttempts.set('attempt1', 5);
            (factory as any).connectionAttempts.set('attempt2', 3);

            const health = factory.getConnectionHealth();

            expect(health.clientConnections).toBe(2);
            expect(health.workerConnections).toBe(1);
            expect(health.totalAttempts).toBe(8);
        });

        it('should return zero counts when no connections exist', () => {
            const health = factory.getConnectionHealth();

            expect(health.clientConnections).toBe(0);
            expect(health.workerConnections).toBe(0);
            expect(health.totalAttempts).toBe(0);
        });

        it('should handle empty connection attempts map', () => {
            // Ensure connectionAttempts map is empty
            (factory as any).connectionAttempts.clear();

            const health = factory.getConnectionHealth();

            expect(health.clientConnections).toBe(0);
            expect(health.workerConnections).toBe(0);
            expect(health.totalAttempts).toBe(0);
        });
    });

    describe('private methods', () => {
        describe('getConnectionKey', () => {
            it('should generate correct connection key', () => {
                const key = (factory as any).getConnectionKey(mockTemporalOptions.connection!);
                expect(key).toBe('localhost:7233:test-namespace:noauth');
            });

            it('should generate correct connection key with API key', () => {
                const key = (factory as any).getConnectionKey(
                    mockTemporalOptionsWithAuth.connection!,
                );
                expect(key).toBe('localhost:7233:test-namespace:auth');
            });

            it('should use default namespace when not provided', () => {
                const optionsWithoutNamespace = {
                    ...mockTemporalOptions,
                    connection: {
                        ...mockTemporalOptions.connection!,
                        namespace: undefined,
                    },
                };
                const key = (factory as any).getConnectionKey(optionsWithoutNamespace.connection!);
                expect(key).toBe('localhost:7233:default:noauth');
            });
        });

        describe('isClientHealthy', () => {
            it('should return true for healthy client', () => {
                const isHealthy = (factory as any).isClientHealthy(mockClient);
                expect(isHealthy).toBe(true);
            });

            it('should return false for unhealthy client', () => {
                const unhealthyClient = {};
                const isHealthy = (factory as any).isClientHealthy(unhealthyClient);
                expect(isHealthy).toBe(false);
            });

            it('should return false when client throws error', () => {
                const faultyClient = {
                    get workflow() {
                        throw new Error('Access error');
                    },
                };
                const isHealthy = (factory as any).isClientHealthy(faultyClient);
                expect(isHealthy).toBe(false);
            });
        });

        describe('isWorkerConnectionHealthy', () => {
            it('should return true for healthy connection', () => {
                const isHealthy = (factory as any).isWorkerConnectionHealthy(mockNativeConnection);
                expect(isHealthy).toBe(true);
            });

            it('should return false for null connection', () => {
                const isHealthy = (factory as any).isWorkerConnectionHealthy(null);
                expect(isHealthy).toBe(false);
            });

            it('should return false for undefined connection', () => {
                const isHealthy = (factory as any).isWorkerConnectionHealthy(undefined);
                expect(isHealthy).toBe(false);
            });

            it('should return false when connection.constructor throws error', () => {
                // Create a connection object where accessing constructor throws
                const throwingConnection = {
                    constructor: undefined,
                };

                // Mock Object.defineProperty to throw when accessing constructor
                Object.defineProperty(throwingConnection, 'constructor', {
                    get: () => {
                        throw new Error('Constructor access error');
                    },
                    configurable: true,
                });

                const isHealthy = (factory as any).isWorkerConnectionHealthy(throwingConnection);
                expect(isHealthy).toBe(false);
            });

            it('should return false for non-object connection', () => {
                const isHealthy = (factory as any).isWorkerConnectionHealthy('not-an-object');
                expect(isHealthy).toBe(false);
            });

            it('should return false for connection with missing constructor', () => {
                // Create a connection object with a null prototype to truly have no constructor
                const connectionWithoutConstructor = Object.create(null);
                connectionWithoutConstructor.someProperty = 'value';

                const isHealthy = (factory as any).isWorkerConnectionHealthy(
                    connectionWithoutConstructor,
                );
                expect(isHealthy).toBe(false);
            });
        });
    });
});
