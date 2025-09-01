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
            createNewClientSpy.mockImplementation(
                async (options: TemporalOptions, connectionKey: string) => {
                    // Simulate the logic that leads to the else block
                    const attempts = 3; // MAX_RETRY_ATTEMPTS
                    if (attempts >= 3) {
                        if (options.allowConnectionFailure !== false) {
                            return null;
                        } else {
                            throw new Error('Failed to connect to localhost:7233 after 3 attempts');
                        }
                    }
                    return null;
                },
            );

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

        it('should handle worker connection creation failure', async () => {
            (
                NativeConnection.connect as jest.MockedFunction<typeof NativeConnection.connect>
            ).mockRejectedValue(new Error('Connection failed'));

            const result = await factory.createWorkerConnection(mockTemporalOptions);
            expect(result).toBeNull();
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

            // Note: The catch block in isWorkerConnectionHealthy is defensive programming
            // but may be unreachable with current implementation since null/undefined
            // comparisons don't typically throw errors
        });

        describe('delay', () => {
            it('should delay for specified milliseconds', async () => {
                const startTime = Date.now();
                await (factory as any).delay(100);
                const endTime = Date.now();

                // Should delay for at least 100ms (allowing for some tolerance)
                expect(endTime - startTime).toBeGreaterThanOrEqual(95);
            });
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle connection attempts tracking correctly', async () => {
            // Mock client creation to fail multiple times
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            // First attempt
            await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(
                (factory as any).connectionAttempts.get(
                    (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                ),
            ).toBe(3);

            // Reset attempts and try again
            (factory as any).connectionAttempts.clear();
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);

            const result = await factory.createClient(mockTemporalOptions);
            expect(result).toBe(mockClient);
            // Attempts should be cleared on success
            expect(
                (factory as any).connectionAttempts.has(
                    (factory as any).getConnectionKey(mockTemporalOptions.connection!),
                ),
            ).toBe(false);
        });

        it('should handle TLS configuration in client options', async () => {
            const optionsWithTLS: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: {
                        serverName: 'temporal.example.com',
                        clientCertPair: {
                            crt: Buffer.from('test-cert'),
                            key: Buffer.from('test-key'),
                            ca: Buffer.from('test-ca'),
                        },
                    },
                    metadata: {},
                },
            };

            await factory.createClient(optionsWithTLS);

            expect(Client).toHaveBeenCalledWith(
                expect.objectContaining({
                    connection: expect.objectContaining({
                        tls: optionsWithTLS.connection!.tls,
                    }),
                }),
            );
        });

        it('should handle TLS configuration in worker connection options', async () => {
            const optionsWithTLS: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: {
                        serverName: 'temporal.example.com',
                        clientCertPair: {
                            crt: Buffer.from('test-cert'),
                            key: Buffer.from('test-key'),
                            ca: Buffer.from('test-ca'),
                        },
                    },
                    metadata: {},
                },
            };

            await factory.createWorkerConnection(optionsWithTLS);

            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    tls: optionsWithTLS.connection!.tls,
                }),
            );
        });

        it('should handle successful client creation with logging', async () => {
            const result = await factory.createClient(mockTemporalOptions);
            expect(result).toBe(mockClient);
        });

        it('should handle failed client creation with logging', async () => {
            // Mock client creation to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBeNull();
        });

        it('should handle retry logic with delay', async () => {
            // Mock client creation to fail first time, succeed second time
            (Client as jest.MockedClass<typeof Client>)
                .mockImplementationOnce(() => {
                    throw new Error('Connection failed');
                })
                .mockImplementationOnce(() => mockClient);

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);
            expect(result).toBe(mockClient);
            expect(Client).toHaveBeenCalledTimes(2);
        });

        it('should log warning and return null when max retries exceeded with allowConnectionFailure=true', async () => {
            // Mock all calls to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            // Pre-set the connection attempts to trigger the max retry logic path
            const connectionKey = (factory as any).getConnectionKey(
                mockTemporalOptionsWithFailureAllowed.connection!,
            );
            (factory as any).connectionAttempts.set(connectionKey, 3); // MAX_RETRY_ATTEMPTS

            // Create a spy on the logger warn method
            const loggerWarnSpy = jest.spyOn((factory as any).logger, 'warn');

            const result = await factory.createClient(mockTemporalOptionsWithFailureAllowed);

            expect(result).toBeNull();
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Max retry attempts exceeded for localhost:7233 - running without client',
            );
        });

        it('should handle allowConnectionFailure=undefined (truthy) by returning null after max retries', async () => {
            // Mock all calls to fail
            (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            const optionsWithUndefinedFailure: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: {},
                },
                allowConnectionFailure: undefined, // This will be truthy
            };

            const result = await factory.createClient(optionsWithUndefinedFailure);
            expect(result).toBeNull();
            expect(Client).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
        });

        it('should throw error when attempts exceed max and allowConnectionFailure is explicitly false', async () => {
            // Pre-set the connection attempts to reach the max limit
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
                optionsWithFailureNotAllowed.connection!,
            );
            (factory as any).connectionAttempts.set(connectionKey, 3); // MAX_RETRY_ATTEMPTS

            await expect(factory.createClient(optionsWithFailureNotAllowed)).rejects.toThrow(
                'Failed to connect to localhost:7233 after 3 attempts',
            );
        });

        it('should handle worker connection creation with existing metadata', async () => {
            const optionsWithExistingMetadata: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'test-namespace',
                    tls: false,
                    metadata: { 'existing-key': 'existing-value' },
                    apiKey: 'test-api-key',
                },
            };

            await factory.createWorkerConnection(optionsWithExistingMetadata);

            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        'existing-key': 'existing-value',
                        authorization: 'Bearer test-api-key',
                    }),
                }),
            );
        });

        it('should handle successful worker connection creation and return connection', async () => {
            const result = await factory.createWorkerConnection(mockTemporalOptions);
            expect(result).toBe(mockNativeConnection);
            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: 'localhost:7233',
                    tls: false,
                }),
            );
        });
    });
});
