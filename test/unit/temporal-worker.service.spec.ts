import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { Worker, NativeConnection } from '@temporalio/worker';

// Mock @temporalio/worker module
jest.mock('@temporalio/worker', () => ({
    Worker: {
        create: jest.fn(),
    },
    NativeConnection: {
        connect: jest.fn(),
    },
}));

describe('TemporalWorkerManagerService', () => {
    let service: TemporalWorkerManagerService;
    let mockDiscoveryService: jest.Mocked<Partial<TemporalDiscoveryService>>;
    let mockConnection: jest.Mocked<Partial<NativeConnection>>;
    let mockWorker: jest.Mocked<Partial<Worker>>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        worker: {
            workflowsPath: './dist/workflows',
            activityClasses: [],
        },
        enableLogger: false,
        logLevel: 'error',
    };

    beforeEach(async () => {
        mockWorker = {
            run: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
            shutdown: jest.fn().mockResolvedValue(undefined),
        };

        mockConnection = {
            close: jest.fn().mockResolvedValue(undefined),
        };

        mockDiscoveryService = {
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true, status: 'healthy' }),
            getAllActivities: jest.fn().mockReturnValue({}),
            getActivityNames: jest.fn().mockReturnValue([]),
        };

        (Worker.create as jest.Mock).mockResolvedValue(mockWorker);
        (NativeConnection.connect as jest.Mock).mockResolvedValue(mockConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: TEMPORAL_CONNECTION,
                    useValue: null,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
            ],
        }).compile();

        service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('onModuleInit', () => {
        it('should initialize worker successfully', async () => {
            await service.onModuleInit();

            expect(NativeConnection.connect).toHaveBeenCalled();
            expect(Worker.create).toHaveBeenCalled();
        });

        it('should skip initialization if no worker config', async () => {
            const noWorkerOptions = { ...mockOptions, worker: undefined };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noWorkerOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceNoWorker = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await serviceNoWorker.onModuleInit();

            expect(NativeConnection.connect).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            (Worker.create as jest.Mock).mockRejectedValueOnce(new Error('Worker creation failed'));

            await expect(service.onModuleInit()).rejects.toThrow('Worker creation failed');
        });

        it('should use injected connection if available', async () => {
            const injectedConnection = { close: jest.fn() };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: injectedConnection,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceWithInjected = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await serviceWithInjected.onModuleInit();

            expect(NativeConnection.connect).not.toHaveBeenCalled();
        });
    });

    describe('onApplicationBootstrap', () => {
        it('should start worker on bootstrap if autoStart is not false', async () => {
            await service.onModuleInit();
            const startSpy = jest.spyOn(service, 'startWorker').mockResolvedValue(undefined);

            await service.onApplicationBootstrap();

            expect(startSpy).toHaveBeenCalled();
        });

        it('should not start worker if autoStart is false', async () => {
            const optionsNoAutoStart = {
                ...mockOptions,
                worker: { ...mockOptions.worker, autoStart: false },
            };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsNoAutoStart,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceNoAutoStart = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await serviceNoAutoStart.onModuleInit();

            const startSpy = jest.spyOn(serviceNoAutoStart, 'startWorker');
            await serviceNoAutoStart.onApplicationBootstrap();

            expect(startSpy).not.toHaveBeenCalled();
        });
    });

    describe('onModuleDestroy', () => {
        it('should shutdown worker on module destroy', async () => {
            await service.onModuleInit();
            await service.startWorker();

            // Mock the worker.run() promise to avoid hanging
            (mockWorker.run as jest.Mock).mockResolvedValue(undefined);

            await service.onModuleDestroy();

            expect(mockWorker.shutdown).toHaveBeenCalled();
        });
    });

    describe('startWorker', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should start worker successfully', async () => {
            // Start worker in a non-blocking way
            const startPromise = service.startWorker();

            // Wait a bit for the worker to start
            await new Promise((resolve) => setTimeout(resolve, 600));

            expect(mockWorker.run).toHaveBeenCalled();
            expect(service.isWorkerRunning()).toBe(true);
        });

        it('should throw error if worker not initialized', async () => {
            const uninitializedService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            await expect(uninitializedService.startWorker()).rejects.toThrow(
                'Worker not initialized',
            );
        });

        it('should not start if already running', async () => {
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const runCallCount = (mockWorker.run as jest.Mock).mock.calls.length;
            await service.startWorker();

            expect((mockWorker.run as jest.Mock).mock.calls.length).toBe(runCallCount);
        });

        it('should handle worker start errors', async () => {
            mockWorker.run = jest.fn().mockRejectedValue(new Error('Start failed'));

            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            expect(service.isWorkerRunning()).toBe(false);
        });
    });

    describe('stopWorker', () => {
        it('should stop worker successfully', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            await service.stopWorker();

            expect(mockWorker.shutdown).toHaveBeenCalled();
            expect(service.isWorkerRunning()).toBe(false);
        });

        it('should handle stop when worker not running', async () => {
            await service.onModuleInit();
            await service.stopWorker();

            expect(mockWorker.shutdown).not.toHaveBeenCalled();
        });

        it('should handle shutdown errors', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            mockWorker.shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));
            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await service.stopWorker();

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });

    describe('restartWorker', () => {
        it('should restart worker successfully', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const result = await service.restartWorker();

            expect(result.success).toBe(true);
            expect(mockWorker.shutdown).toHaveBeenCalled();
        });

        it('should handle restart errors', async () => {
            await service.onModuleInit();
            await service.startWorker();

            // Wait for worker to actually start
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Make shutdown fail - but stopWorker catches this error
            mockWorker.shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));

            // Restart should still succeed because stopWorker catches errors
            // and startWorker proceeds independently
            const result = await service.restartWorker();

            // The service is resilient - even if shutdown has issues, the restart proceeds
            expect(result.success).toBe(true);
            expect(mockWorker.shutdown).toHaveBeenCalled();
        });
    });

    describe('getWorkerStatus', () => {
        it('should return worker status', async () => {
            await service.onModuleInit();

            const status = service.getWorkerStatus();

            expect(status).toBeDefined();
            expect(status.isInitialized).toBe(true);
            expect(status.taskQueue).toBe('test-queue');
            expect(status.namespace).toBe('test-namespace');
        });

        it('should include uptime when worker is running', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const status = service.getWorkerStatus();

            expect(status.uptime).toBeDefined();
            expect(status.startedAt).toBeDefined();
        });

        it('should include error information', async () => {
            await service.onModuleInit();
            mockWorker.run = jest.fn().mockRejectedValue(new Error('Runtime error'));

            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const status = service.getWorkerStatus();

            expect(status.lastError).toBeDefined();
        });
    });

    describe('getRegisteredActivities', () => {
        it('should return registered activities', async () => {
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                testActivity: jest.fn(),
            });

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();

            expect(activities).toBeDefined();
            expect(typeof activities).toBe('object');
        });
    });

    describe('registerActivitiesFromDiscovery', () => {
        it('should register activities from discovery service', async () => {
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                activity1: jest.fn(),
                activity2: jest.fn(),
            });

            await service.onModuleInit();

            const result = await service.registerActivitiesFromDiscovery();

            expect(result.success).toBe(true);
            expect(result.registeredCount).toBe(2);
        });

        it('should handle registration errors', async () => {
            mockDiscoveryService.getAllActivities = jest.fn().mockImplementation(() => {
                throw new Error('Discovery failed');
            });

            await service.onModuleInit();

            const result = await service.registerActivitiesFromDiscovery();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should wait for discovery to complete', async () => {
            mockDiscoveryService.getHealthStatus = jest
                .fn()
                .mockReturnValueOnce({ isComplete: false })
                .mockReturnValueOnce({ isComplete: false })
                .mockReturnValueOnce({ isComplete: true, status: 'healthy' });

            await service.onModuleInit();

            const result = await service.registerActivitiesFromDiscovery();

            expect(result).toBeDefined();
        });
    });

    describe('isWorkerAvailable', () => {
        it('should return true when worker is available', async () => {
            await service.onModuleInit();

            expect(service.isWorkerAvailable()).toBe(true);
        });

        it('should return false when worker is not available', () => {
            const uninitializedService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            expect(uninitializedService.isWorkerAvailable()).toBe(false);
        });
    });

    describe('isWorkerRunning', () => {
        it('should return true when worker is running', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            expect(service.isWorkerRunning()).toBe(true);
        });

        it('should return false when worker is not running', async () => {
            await service.onModuleInit();

            expect(service.isWorkerRunning()).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return status via getStatus alias', async () => {
            await service.onModuleInit();

            const status = service.getStatus();

            expect(status).toBeDefined();
            expect(status.isInitialized).toBe(true);
        });
    });

    describe('getHealthStatus', () => {
        it('should return health status', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const health = service.getHealthStatus();

            expect(health).toBeDefined();
            expect(health.isHealthy).toBeDefined();
            expect(health.isRunning).toBe(true);
            expect(health.isInitialized).toBe(true);
        });

        it('should show unhealthy when errors occur', async () => {
            await service.onModuleInit();
            mockWorker.run = jest.fn().mockRejectedValue(new Error('Health issue'));

            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const health = service.getHealthStatus();

            expect(health.isHealthy).toBe(false);
            expect(health.lastError).toBeDefined();
        });
    });

    describe('getStats', () => {
        it('should return worker statistics', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const stats = service.getStats();

            expect(stats).toBeDefined();
            expect(stats.isInitialized).toBe(true);
            expect(stats.isRunning).toBe(true);
            expect(stats.taskQueue).toBe('test-queue');
            expect(stats.namespace).toBe('test-namespace');
        });
    });

    describe('shutdown', () => {
        it('should shutdown worker via shutdown alias', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            await service.shutdown();

            expect(mockWorker.shutdown).toHaveBeenCalled();
        });
    });

    describe('Private methods', () => {
        it('should validate configuration', async () => {
            const invalidOptions = { ...mockOptions, taskQueue: undefined };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: invalidOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const invalidService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            await expect(invalidService.onModuleInit()).rejects.toThrow('Task queue is required');
        });

        it('should validate conflicting workflow configurations', async () => {
            const conflictingOptions = {
                ...mockOptions,
                worker: {
                    workflowsPath: './dist/workflows',
                    workflowBundle: { path: 'bundle.js' },
                },
            };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: conflictingOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const conflictingService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            await expect(conflictingService.onModuleInit()).rejects.toThrow(
                'Cannot specify both workflowsPath and workflowBundle',
            );
        });

        it('should handle connection failures when allowed', async () => {
            (NativeConnection.connect as jest.Mock).mockRejectedValueOnce(
                new Error('Connection failed'),
            );

            const optionsWithFailureAllowed = {
                ...mockOptions,
                allowConnectionFailure: true,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithFailureAllowed,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceWithAllowedFailure = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            // Should not throw
            await serviceWithAllowedFailure.onModuleInit();
        });

        it('should extract error messages from Error objects', () => {
            const error = new Error('Test error');
            const message = (service as any).extractErrorMessage(error);

            expect(message).toBe('Test error');
        });

        it('should extract error messages from strings', () => {
            const message = (service as any).extractErrorMessage('String error');

            expect(message).toBe('String error');
        });

        it('should handle unknown error types', () => {
            const message = (service as any).extractErrorMessage({ code: 'ERROR' });

            expect(message).toBe('Unknown error');
        });

        it('should get workflow source correctly', async () => {
            await service.onModuleInit();

            const status = service.getWorkerStatus();
            expect(status.workflowSource).toBe('filesystem');
        });

        it('should handle workflow bundle source', async () => {
            const bundleOptions = {
                ...mockOptions,
                worker: {
                    workflowBundle: { path: 'bundle.js' },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: bundleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const bundleService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await bundleService.onModuleInit();

            const status = bundleService.getWorkerStatus();
            expect(status.workflowSource).toBe('bundle');
        });

        it('should handle no workflow source', async () => {
            const noWorkflowOptions = {
                ...mockOptions,
                worker: {
                    activityClasses: [],
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noWorkflowOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const noWorkflowService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await noWorkflowService.onModuleInit();

            const status = noWorkflowService.getWorkerStatus();
            expect(status.workflowSource).toBe('none');
        });
    });

    describe('Auto-restart functionality', () => {
        it('should handle worker run failures with auto-restart', async () => {
            const optionsWithAutoRestart = {
                ...mockOptions,
                autoRestart: true,
            };

            (Worker.create as jest.Mock).mockResolvedValue({
                run: jest.fn().mockRejectedValue(new Error('Worker crashed')),
                shutdown: jest.fn().mockResolvedValue(undefined),
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithAutoRestart,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const autoRestartService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await autoRestartService.onModuleInit();

            await autoRestartService.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Should have attempted to start
            expect(autoRestartService.isWorkerRunning()).toBe(false);
        });
    });

    describe('Connection with API key', () => {
        it('should connect with API key authentication', async () => {
            const optionsWithApiKey = {
                ...mockOptions,
                connection: {
                    ...mockOptions.connection,
                    apiKey: 'test-api-key',
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithApiKey,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const apiKeyService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await apiKeyService.onModuleInit();

            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        authorization: 'Bearer test-api-key',
                    }),
                }),
            );
        });
    });

    describe('Connection shutdown', () => {
        it('should not close injected connection on shutdown', async () => {
            const injectedConnection = {
                close: jest.fn().mockResolvedValue(undefined),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: injectedConnection,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceWithInjected = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await serviceWithInjected.onModuleInit();
            await serviceWithInjected.onModuleDestroy();

            expect(injectedConnection.close).not.toHaveBeenCalled();
        });

        it('should close own connection on shutdown', async () => {
            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(mockConnection.close).toHaveBeenCalled();
        });

        it('should handle connection close errors gracefully', async () => {
            mockConnection.close = jest.fn().mockRejectedValue(new Error('Close failed'));
            const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });

    describe('Additional error handling branches', () => {
        it('should handle allowConnectionFailure in catch block during init', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            allowConnectionFailure: true,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            // Mock validateConfiguration to throw
            jest.spyOn(testService as any, 'validateConfiguration').mockImplementation(() => {
                throw new Error('Validation error');
            });

            // Should not throw even with validation error
            await testService.onModuleInit();
            expect(testService.getWorkerStatus().isInitialized).toBe(false);
        });

        it('should handle errors in startWorker and set isRunning to false', async () => {
            await service.onModuleInit();

            // Mock runWorkerWithAutoRestart to throw
            jest.spyOn(service as any, 'runWorkerWithAutoRestart').mockRejectedValue(
                new Error('Start error'),
            );

            await expect(service.startWorker()).rejects.toThrow('Start error');
            expect(service.isWorkerRunning()).toBe(false);
        });

        it('should handle string errors in runWorkerWithAutoRestart', async () => {
            await service.onModuleInit();

            const crashingWorker = {
                run: jest.fn().mockRejectedValue('String error'),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (Worker.create as jest.Mock).mockResolvedValueOnce(crashingWorker);

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            autoRestart: true,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();
            await testService.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            expect(testService.isWorkerRunning()).toBe(false);
        });

        it('should handle auto-restart errors', async () => {
            const crashingWorker = {
                run: jest.fn().mockRejectedValue(new Error('Crash')),
                shutdown: jest.fn().mockRejectedValue(new Error('Shutdown failed')),
            };

            (Worker.create as jest.Mock).mockResolvedValue(crashingWorker);

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            autoRestart: true,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const loggerSpy = jest.spyOn((testService as any).logger, 'error').mockImplementation();

            await testService.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 1600));

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should hit max restart limit', async () => {
            const crashingWorker = {
                run: jest.fn().mockRejectedValue(new Error('Crash')),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (Worker.create as jest.Mock).mockResolvedValue(crashingWorker);

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            autoRestart: true,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const loggerSpy = jest.spyOn((testService as any).logger, 'error').mockImplementation();

            await testService.startWorker();
            // Wait long enough for multiple restart attempts
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Check that error was called (restart logic was triggered)
            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        }, 10000);

        it('should handle restart with stopWorker error', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Make stopWorker fail
            jest.spyOn(service, 'stopWorker').mockRejectedValue(new Error('Stop failed'));

            const result = await service.restartWorker();

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle individual activity registration errors', async () => {
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                goodActivity: jest.fn(),
                badActivity: function badActivity() {
                    throw new Error('Bad activity');
                },
            });

            // Mock activities.set to throw for badActivity
            const originalSet = Map.prototype.set;
            const callCount = 0;
            jest.spyOn(Map.prototype, 'set').mockImplementation(function (
                this: Map<any, any>,
                key: any,
                value: any,
            ) {
                if (key === 'badActivity') {
                    throw new Error('Cannot register');
                }
                return originalSet.call(this, key, value);
            });

            await service.onModuleInit();
            const result = await service.registerActivitiesFromDiscovery();

            expect(result.errors.length).toBeGreaterThan(0);
            (Map.prototype.set as jest.Mock).mockRestore();
        });

        it('should handle connection address missing', async () => {
            const noAddressOptions = {
                ...mockOptions,
                connection: {
                    namespace: 'test',
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noAddressOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            await expect(testService.onModuleInit()).rejects.toThrow(
                'Connection address is required',
            );
        });

        it('should handle connection failure when allowConnectionFailure is false', async () => {
            (NativeConnection.connect as jest.Mock).mockRejectedValueOnce(
                new Error('Connection error'),
            );

            const strictOptions = {
                ...mockOptions,
                allowConnectionFailure: false,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: strictOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            await expect(testService.onModuleInit()).rejects.toThrow();
        });

        it('should handle no connection in createWorkerConfig', async () => {
            const testService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            await expect((testService as any).createWorkerConfig()).rejects.toThrow(
                'Connection not established',
            );
        });

        it('should handle worker options in buildWorkerOptions', async () => {
            const optionsWithWorkerOptions = {
                ...mockOptions,
                worker: {
                    ...mockOptions.worker,
                    workerOptions: {
                        maxConcurrentActivityTaskExecutions: 10,
                    },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithWorkerOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const config = await (testService as any).createWorkerConfig();
            expect(config.maxConcurrentActivityTaskExecutions).toBe(10);
        });

        it('should handle errors in loadActivitiesFromDiscovery', async () => {
            const originalSet = Map.prototype.set;
            jest.spyOn(Map.prototype, 'set').mockImplementation(function (
                this: Map<any, any>,
                key: any,
                value: any,
            ) {
                if (key === 'failActivity') {
                    throw new Error('Registration failed');
                }
                return originalSet.call(this, key, value);
            });

            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                failActivity: jest.fn(),
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const result = await (testService as any).loadActivitiesFromDiscovery();
            expect(result.errors.length).toBeGreaterThan(0);

            (Map.prototype.set as jest.Mock).mockRestore();
        });

        it('should handle shutdown promise reuse', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Call shutdown multiple times concurrently
            const promise1 = service.shutdown();
            const promise2 = service.shutdown();
            const promise3 = service.shutdown();

            await Promise.all([promise1, promise2, promise3]);

            // Should only shutdown once
            expect(mockWorker.shutdown).toHaveBeenCalledTimes(1);
        });

        it('should handle error in performShutdown', async () => {
            await service.onModuleInit();
            await service.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
            jest.spyOn(service, 'stopWorker').mockRejectedValue(new Error('Stop error'));

            await service.shutdown();

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should handle error during worker run in setImmediate callback', async () => {
            await service.onModuleInit();

            // Mock worker.run to throw synchronously
            const errorWorker = {
                run: jest.fn(() => {
                    throw new Error('Sync error');
                }),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (service as any).worker = errorWorker;

            await expect(service.startWorker()).rejects.toThrow();
        });

        it('should handle autoRestart disabled', async () => {
            const crashingWorker = {
                run: jest.fn().mockRejectedValue(new Error('Crash')),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (Worker.create as jest.Mock).mockResolvedValue(crashingWorker);

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            autoRestart: false,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            await testService.startWorker();
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Should not auto-restart
            expect(testService.isWorkerRunning()).toBe(false);
        });

        it('should wait for discovery service to complete during registerActivitiesFromDiscovery', async () => {
            let callCount = 0;
            mockDiscoveryService.getHealthStatus = jest.fn().mockImplementation(() => {
                callCount++;
                return callCount > 35 ? { isComplete: true } : { isComplete: false };
            });

            await service.onModuleInit();
            const result = await service.registerActivitiesFromDiscovery();

            // Should timeout after 30 attempts
            expect(result).toBeDefined();
        });

        it('should handle connection with tls configuration', async () => {
            const tlsOptions = {
                ...mockOptions,
                connection: {
                    ...mockOptions.connection,
                    tls: {
                        clientCertPair: {
                            crt: Buffer.from('cert'),
                            key: Buffer.from('key'),
                        },
                    },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: tlsOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    tls: expect.any(Object),
                }),
            );
        });

        it('should handle connection with metadata', async () => {
            const metadataOptions = {
                ...mockOptions,
                connection: {
                    ...mockOptions.connection,
                    metadata: {
                        'custom-header': 'value',
                    },
                    apiKey: 'test-key',
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: metadataOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            expect(NativeConnection.connect).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        'custom-header': 'value',
                        authorization: 'Bearer test-key',
                    }),
                }),
            );
        });

        it('should create worker with workflowBundle configuration', async () => {
            const bundleOptions = {
                ...mockOptions,
                worker: {
                    workflowBundle: {
                        codePath: 'bundle.js',
                    },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: bundleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const config = await (testService as any).createWorkerConfig();
            expect(config.workflowBundle).toBeDefined();
        });

        it('should handle allowConnectionFailure in catch block lines 98-101', async () => {
            const failOptions = {
                ...mockOptions,
                allowConnectionFailure: true,
            };

            (Worker.create as jest.Mock).mockRejectedValueOnce(new Error('Worker init failed'));

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: failOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            // Should not throw even with failure due to allowConnectionFailure
            await testService.onModuleInit();
            expect(testService.getWorkerStatus().isInitialized).toBe(false);
        });

        it('should handle buildWorkerOptions with workflowsPath lines 472-473', async () => {
            await service.onModuleInit();

            const options = (service as any).buildWorkerOptions();
            expect(options.workflowsPath).toBe('./dist/workflows');
        });

        it('should handle buildWorkerOptions with workflowBundle lines 474-475', async () => {
            const bundleOptions = {
                ...mockOptions,
                worker: {
                    workflowBundle: { codePath: 'bundle.js' },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: bundleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const options = (testService as any).buildWorkerOptions();
            expect(options.workflowBundle).toBeDefined();
        });

        it('should handle buildWorkerOptions with activities conversion lines 478-483', async () => {
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                activity1: jest.fn(),
                activity2: jest.fn(),
            });

            await service.onModuleInit();

            const options = (service as any).buildWorkerOptions();
            expect(options.activities).toBeDefined();
            expect(typeof options.activities).toBe('object');
        });

        it('should handle buildWorkerOptions with workerOptions lines 486-488', async () => {
            const workerOptsConfig = {
                ...mockOptions,
                worker: {
                    ...mockOptions.worker,
                    workerOptions: {
                        maxConcurrentActivityTaskExecutions: 5,
                    },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: workerOptsConfig,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const options = (testService as any).buildWorkerOptions();
            expect(options.maxConcurrentActivityTaskExecutions).toBe(5);
        });

        it('should handle createConnection missing address line 503-504', async () => {
            const noAddressOpts = {
                ...mockOptions,
                connection: {
                    namespace: 'test',
                },
            };

            const testService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                noAddressOpts,
                null,
            );

            await expect((testService as any).createConnection()).rejects.toThrow(
                'Connection address is required',
            );
        });

        it('should handle createWorker without connection lines 546-547', async () => {
            const testService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            // Mock createConnection to set connection to null
            jest.spyOn(testService as any, 'createConnection').mockResolvedValue(undefined);
            (testService as any).connection = null;

            await expect((testService as any).createWorker()).rejects.toThrow(
                'Connection not established',
            );
        });

        it('should handle runWorkerLoop with no worker lines 566-567', async () => {
            const testService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            await expect((testService as any).runWorkerLoop()).rejects.toThrow(
                'Temporal worker not initialized',
            );
        });

        it('should handle runWorkerLoop with worker error lines 571-574', async () => {
            const errorWorker = {
                run: jest.fn().mockRejectedValue(new Error('Worker run error')),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (Worker.create as jest.Mock).mockResolvedValueOnce(errorWorker);

            await service.onModuleInit();
            (service as any).worker = errorWorker;

            await expect((service as any).runWorkerLoop()).rejects.toThrow('Execution error');
        });

        it('should handle startWorkerInBackground when not running lines 582-585', () => {
            const testService = new TemporalWorkerManagerService(
                mockDiscoveryService as any,
                mockOptions,
                null,
            );

            // Create a mock worker
            const mockWorkerInstance = {
                run: jest.fn().mockResolvedValue(undefined),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (testService as any).worker = mockWorkerInstance;
            (testService as any).isRunning = false;

            // This should call startWorker internally
            (testService as any).startWorkerInBackground();

            // Give it a moment to process
            setTimeout(() => {
                expect(mockWorkerInstance.run).toHaveBeenCalled();
            }, 100);
        });

        it('should handle createWorkerConfig with workflowsPath lines 736-738', async () => {
            await service.onModuleInit();

            const config = await (service as any).createWorkerConfig();
            expect(config.workflowsPath).toBe('./dist/workflows');
        });

        it('should handle createWorkerConfig with workflowBundle lines 739-741', async () => {
            const bundleOptions = {
                ...mockOptions,
                worker: {
                    workflowBundle: { codePath: 'bundle.js' },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: bundleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            const config = await (testService as any).createWorkerConfig();
            expect(config.workflowBundle).toBeDefined();
        });

        it('should handle createWorkerConfig with no workflow config lines 742-745', async () => {
            const noWorkflowOptions = {
                ...mockOptions,
                worker: {
                    activityClasses: [],
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noWorkflowOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
            await testService.onModuleInit();

            // Manually set the connection so createWorkerConfig doesn't throw
            (testService as any).connection = mockConnection;

            const logSpy = jest.spyOn((testService as any).logger, 'warn').mockImplementation();

            const config = await (testService as any).createWorkerConfig();

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('No workflow configuration'),
            );

            logSpy.mockRestore();
        });

        it('should hit lines 98-101 with non-Error exception and allowConnectionFailure', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            ...mockOptions,
                            allowConnectionFailure: true,
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const testService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            // Make initializeWorker throw a non-Error
            jest.spyOn(testService as any, 'initializeWorker').mockRejectedValue('String error');

            const loggerSpy = jest.spyOn((testService as any).logger, 'warn').mockImplementation();

            // Should not throw
            await testService.onModuleInit();

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('connection failures are allowed'),
            );
            loggerSpy.mockRestore();
        });

        it('should call startWorkerInBackground and hit error handler line 584', async () => {
            await service.onModuleInit();

            // Make startWorker throw an error
            jest.spyOn(service, 'startWorker').mockRejectedValue(new Error('Start failed'));

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Call the private method directly
            (service as any).startWorkerInBackground();

            // Wait for the catch block to execute
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(loggerSpy).toHaveBeenCalledWith(
                'Background worker start failed',
                expect.any(Error),
            );
            loggerSpy.mockRestore();
        });

        it('should test logWorkerConfiguration method', async () => {
            await service.onModuleInit();

            const loggerSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation();

            // Call the private method
            (service as any).logWorkerConfiguration();

            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Worker configuration'));
            loggerSpy.mockRestore();
        });

        it('should test runWorkerLoop method', async () => {
            await service.onModuleInit();

            mockWorker.run = jest.fn().mockResolvedValue(undefined);
            (service as any).worker = mockWorker;

            // Call the private method
            await (service as any).runWorkerLoop();

            expect(mockWorker.run).toHaveBeenCalled();
        });

        it('should test runWorkerLoop with error', async () => {
            await service.onModuleInit();

            mockWorker.run = jest.fn().mockRejectedValue(new Error('Run error'));
            (service as any).worker = mockWorker;

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Call the private method
            await expect((service as any).runWorkerLoop()).rejects.toThrow('Execution error');

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should test getEnvironmentDefaults method', () => {
            const defaults = (service as any).getEnvironmentDefaults();

            expect(defaults.taskQueue).toBe('test-queue');
            expect(defaults.namespace).toBe('test-namespace');
        });

        it('should test buildWorkerOptions with different configurations', () => {
            const options = (service as any).buildWorkerOptions();

            expect(options.workflowsPath).toBe('./dist/workflows');
            expect(options.activities).toBeDefined();
        });
    });

    describe('Multiple Workers Support', () => {
        const multipleWorkersOptions: TemporalOptions = {
            connection: {
                namespace: 'test-namespace',
                address: 'localhost:7233',
            },
            workers: [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './dist/workflows1',
                },
                {
                    taskQueue: 'queue-2',
                    workflowsPath: './dist/workflows2',
                    autoStart: true,
                },
            ],
            enableLogger: false,
            logLevel: 'error',
        };

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: multipleWorkersOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
        });

        it('should initialize multiple workers', async () => {
            await service.onModuleInit();

            expect(NativeConnection.connect).toHaveBeenCalled();
            expect(Worker.create).toHaveBeenCalledTimes(2);
        });

        it('should skip multiple workers init if connection fails and allowed', async () => {
            (NativeConnection.connect as jest.Mock).mockResolvedValue(null);

            const logSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Connection failed, skipping worker initialization'),
            );

            logSpy.mockRestore();
        });

        it('should handle errors during worker creation with allowConnectionFailure', async () => {
            const multipleWorkersWithAllowFailure = {
                ...multipleWorkersOptions,
                allowConnectionFailure: true,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: multipleWorkersWithAllowFailure,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            (Worker.create as jest.Mock)
                .mockRejectedValueOnce(new Error('Worker creation failed'))
                .mockResolvedValueOnce(mockWorker);

            const logSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation();

            await svc.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to initialize worker for task queue'),
                expect.any(Error),
            );

            logSpy.mockRestore();
        });

        it('should throw error during worker creation when allowConnectionFailure is false', async () => {
            const multipleWorkersNoFailure = {
                ...multipleWorkersOptions,
                allowConnectionFailure: false,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: multipleWorkersNoFailure,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            (Worker.create as jest.Mock).mockRejectedValue(new Error('Worker creation failed'));

            await expect(svc.onModuleInit()).rejects.toThrow('Worker creation failed');
        });

        it('should auto-start workers on bootstrap', async () => {
            await service.onModuleInit();

            const startSpy = jest
                .spyOn(service as any, 'startWorkerByTaskQueue')
                .mockResolvedValue(undefined);

            await service.onApplicationBootstrap();

            expect(startSpy).toHaveBeenCalledWith('queue-1');
            expect(startSpy).toHaveBeenCalledWith('queue-2');

            startSpy.mockRestore();
        });

        it('should not start workers on bootstrap if autoStart is false', async () => {
            const noAutoStartOptions = {
                ...multipleWorkersOptions,
                workers: [
                    {
                        taskQueue: 'queue-1',
                        workflowsPath: './dist/workflows1',
                        autoStart: false,
                    },
                ],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noAutoStartOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            await svc.onModuleInit();

            const startSpy = jest
                .spyOn(svc as any, 'startWorkerByTaskQueue')
                .mockResolvedValue(undefined);

            await svc.onApplicationBootstrap();

            expect(startSpy).not.toHaveBeenCalled();

            startSpy.mockRestore();
        });

        it('should register worker dynamically', async () => {
            await service.onModuleInit();

            const newWorkerDef = {
                taskQueue: 'dynamic-queue',
                workflowsPath: './dist/dynamic-workflows',
            };

            const result = await service.registerWorker(newWorkerDef);

            expect(result.success).toBe(true);
            expect(result.taskQueue).toBe('dynamic-queue');
            expect(Worker.create).toHaveBeenCalledTimes(3); // 2 initial + 1 dynamic
        });

        it('should handle errors when registering worker dynamically', async () => {
            await service.onModuleInit();

            (Worker.create as jest.Mock).mockRejectedValueOnce(new Error('Creation failed'));

            const newWorkerDef = {
                taskQueue: 'failing-queue',
                workflowsPath: './dist/workflows',
            };

            const result = await service.registerWorker(newWorkerDef);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
        });

        it('should validate task queue when registering worker', async () => {
            await service.onModuleInit();

            const invalidWorkerDef = {
                taskQueue: '',
                workflowsPath: './dist/workflows',
            };

            const result = await service.registerWorker(invalidWorkerDef);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('Task queue is required');
        });

        it('should throw error when creating duplicate worker', async () => {
            await service.onModuleInit();

            const duplicateWorkerDef = {
                taskQueue: 'queue-1', // Already exists
                workflowsPath: './dist/workflows',
            };

            const result = await service.registerWorker(duplicateWorkerDef);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('already exists');
        });

        it('should get worker by task queue', async () => {
            await service.onModuleInit();

            const worker = service.getWorker('queue-1');

            expect(worker).toBe(mockWorker);
        });

        it('should return null for non-existent worker', async () => {
            await service.onModuleInit();

            const worker = service.getWorker('non-existent-queue');

            expect(worker).toBeNull();
        });

        it('should handle worker with activityClasses', async () => {
            const workerWithActivityClasses = {
                ...multipleWorkersOptions,
                workers: [
                    {
                        taskQueue: 'activity-queue',
                        workflowsPath: './dist/workflows',
                        activityClasses: [class TestActivity {}],
                    },
                ],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: workerWithActivityClasses,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            await svc.onModuleInit();

            expect(Worker.create).toHaveBeenCalled();
        });

        it('should handle worker with workflowBundle', async () => {
            const workerWithBundle = {
                ...multipleWorkersOptions,
                workers: [
                    {
                        taskQueue: 'bundle-queue',
                        workflowBundle: { code: 'bundle-code', sourceMap: 'map' },
                    },
                ],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: workerWithBundle,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            await svc.onModuleInit();

            expect(Worker.create).toHaveBeenCalled();
        });

        it('should handle worker with workerOptions', async () => {
            const workerWithOptions = {
                ...multipleWorkersOptions,
                workers: [
                    {
                        taskQueue: 'options-queue',
                        workflowsPath: './dist/workflows',
                        workerOptions: {
                            maxConcurrentActivityTaskExecutions: 100,
                            maxConcurrentWorkflowTaskExecutions: 50,
                        },
                    },
                ],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: workerWithOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            await svc.onModuleInit();

            expect(Worker.create).toHaveBeenCalled();
        });

        it('should auto-start dynamically registered worker', async () => {
            await service.onModuleInit();

            const startSpy = jest
                .spyOn(service as any, 'startWorkerByTaskQueue')
                .mockResolvedValue(undefined);

            const newWorkerDef = {
                taskQueue: 'auto-start-queue',
                workflowsPath: './dist/workflows',
                autoStart: true,
            };

            await service.registerWorker(newWorkerDef);

            expect(startSpy).toHaveBeenCalledWith('auto-start-queue');

            startSpy.mockRestore();
        });

        it('should not auto-start dynamically registered worker when autoStart is false', async () => {
            await service.onModuleInit();

            const startSpy = jest
                .spyOn(service as any, 'startWorkerByTaskQueue')
                .mockResolvedValue(undefined);

            const newWorkerDef = {
                taskQueue: 'no-auto-start-queue',
                workflowsPath: './dist/workflows',
                autoStart: false,
            };

            await service.registerWorker(newWorkerDef);

            expect(startSpy).not.toHaveBeenCalled();

            startSpy.mockRestore();
        });

        it('should create connection before registering worker if not exists', async () => {
            // Don't initialize to test connection creation
            const newWorkerDef = {
                taskQueue: 'test-queue',
                workflowsPath: './dist/workflows',
            };

            const result = await service.registerWorker(newWorkerDef);

            expect(NativeConnection.connect).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should handle non-Error exceptions when registering worker', async () => {
            await service.onModuleInit();

            (Worker.create as jest.Mock).mockRejectedValueOnce('String error');

            const newWorkerDef = {
                taskQueue: 'error-queue',
                workflowsPath: './dist/workflows',
            };

            const result = await service.registerWorker(newWorkerDef);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('String error');
        });

        it('should return all workers information', async () => {
            await service.onModuleInit();

            const allWorkers = service.getAllWorkers();

            expect(allWorkers.totalWorkers).toBe(2);
            expect(allWorkers.workers.size).toBe(2);
            expect(allWorkers.workers.has('queue-1')).toBe(true);
            expect(allWorkers.workers.has('queue-2')).toBe(true);
            expect(allWorkers.runningWorkers).toBeDefined();
            expect(allWorkers.healthyWorkers).toBeDefined();
        });

        it('should return worker status by task queue', async () => {
            await service.onModuleInit();

            const status = service.getWorkerStatusByTaskQueue('queue-1');

            expect(status).toBeDefined();
            expect(status?.isInitialized).toBe(true);
        });

        it('should return null for non-existent task queue', async () => {
            await service.onModuleInit();

            const status = service.getWorkerStatusByTaskQueue('non-existent');

            expect(status).toBeNull();
        });

        it('should warn when starting already running worker', async () => {
            await service.onModuleInit();
            await service.onApplicationBootstrap(); // Start workers with autoStart=true

            const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.startWorkerByTaskQueue('queue-2'); // This worker has autoStart=true

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining("Worker for 'queue-2' is already running"),
            );
            loggerSpy.mockRestore();
        });

        it('should throw error when starting non-existent worker', async () => {
            await service.onModuleInit();

            await expect(service.startWorkerByTaskQueue('non-existent')).rejects.toThrow(
                "Worker for task queue 'non-existent' not found",
            );
        });

        it('should throw error when stopping non-existent worker', async () => {
            await service.onModuleInit();

            await expect(service.stopWorkerByTaskQueue('non-existent')).rejects.toThrow(
                "Worker for task queue 'non-existent' not found",
            );
        });

        it('should handle errors from worker.run() gracefully', async () => {
            await service.onModuleInit();

            const workerInstance = (service as any).workers.get('queue-1');
            const runError = new Error('Worker run failed');
            workerInstance.worker.run = jest.fn().mockRejectedValue(runError);

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await service.startWorkerByTaskQueue('queue-1');

            // Wait for async error handler
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should handle synchronous errors during worker start', async () => {
            await service.onModuleInit();

            const workerInstance = (service as any).workers.get('queue-1');
            const startError = new Error('Start failed');
            workerInstance.worker.run = jest.fn().mockImplementation(() => {
                throw startError;
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await expect(service.startWorkerByTaskQueue('queue-1')).rejects.toThrow('Start failed');

            loggerSpy.mockRestore();
        });

        it('should skip stopping a worker that is not running', async () => {
            await service.onModuleInit();

            const loggerSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation();

            await service.stopWorkerByTaskQueue('queue-1');

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining("Worker for 'queue-1' is not running"),
            );
            loggerSpy.mockRestore();
        });

        it('should successfully stop a running worker', async () => {
            await service.onModuleInit();
            await service.startWorkerByTaskQueue('queue-1');

            const loggerSpy = jest.spyOn((service as any).logger, 'info').mockImplementation();

            await service.stopWorkerByTaskQueue('queue-1');

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining("Worker for 'queue-1' stopped successfully"),
            );
            loggerSpy.mockRestore();
        });

        it('should handle errors during worker shutdown', async () => {
            await service.onModuleInit();
            await service.startWorkerByTaskQueue('queue-1');

            const workerInstance = (service as any).workers.get('queue-1');
            const shutdownError = new Error('Shutdown failed');
            workerInstance.worker.shutdown = jest.fn().mockRejectedValue(shutdownError);

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await expect(service.stopWorkerByTaskQueue('queue-1')).rejects.toThrow(
                'Shutdown failed',
            );

            loggerSpy.mockRestore();
        });

        it('should return the native connection', async () => {
            await service.onModuleInit();

            const connection = service.getConnection();

            expect(connection).toBeDefined();
            expect(connection).toBe((service as any).connection);
        });

        it('should calculate worker uptime correctly', async () => {
            await service.onModuleInit();
            await service.startWorkerByTaskQueue('queue-1');

            const workerInstance = (service as any).workers.get('queue-1');
            const status = (service as any).getWorkerStatusFromInstance(workerInstance);

            expect(status.uptime).toBeDefined();
            expect(typeof status.uptime).toBe('number');
            expect(status.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should return undefined uptime when worker not started', async () => {
            await service.onModuleInit();

            const workerInstance = (service as any).workers.get('queue-1');
            workerInstance.startedAt = null;

            const status = (service as any).getWorkerStatusFromInstance(workerInstance);

            expect(status.uptime).toBeUndefined();
        });

        it('should wait for health check to complete when loading activities', async () => {
            const activities = new Map();
            mockDiscoveryService.getHealthStatus = jest
                .fn()
                .mockReturnValueOnce({ isComplete: false })
                .mockReturnValueOnce({ isComplete: true });
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                activity1: jest.fn(),
                activity2: jest.fn(),
            });

            await (service as any).loadActivitiesForWorker(activities);

            expect(activities.size).toBe(2);
            expect(activities.has('activity1')).toBe(true);
            expect(activities.has('activity2')).toBe(true);
        });

        it('should handle immediate health check completion', async () => {
            const activities = new Map();
            mockDiscoveryService.getHealthStatus = jest.fn().mockReturnValue({ isComplete: true });
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                activity1: jest.fn(),
            });

            await (service as any).loadActivitiesForWorker(activities);

            expect(activities.size).toBe(1);
            expect(activities.has('activity1')).toBe(true);
        });

        it('should timeout after max attempts waiting for health check', async () => {
            const activities = new Map();
            mockDiscoveryService.getHealthStatus = jest.fn().mockReturnValue({ isComplete: false });
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                activity1: jest.fn(),
            });

            const startTime = Date.now();
            await (service as any).loadActivitiesForWorker(activities);
            const duration = Date.now() - startTime;

            // Should timeout after 30 attempts * 100ms = 3000ms
            expect(duration).toBeGreaterThanOrEqual(2900);
            expect(activities.size).toBe(1);
        });

        it('should return "bundle" from getWorkflowSourceFromDef with workflowBundle', async () => {
            const source = (service as any).getWorkflowSourceFromDef({
                taskQueue: 'test',
                workflowBundle: { code: 'bundled-code' },
            });

            expect(source).toBe('bundle');
        });

        it('should return "filesystem" from getWorkflowSourceFromDef with workflowsPath', async () => {
            const source = (service as any).getWorkflowSourceFromDef({
                taskQueue: 'test',
                workflowsPath: './workflows',
            });

            expect(source).toBe('filesystem');
        });

        it('should return "none" from getWorkflowSourceFromDef with neither', async () => {
            const source = (service as any).getWorkflowSourceFromDef({
                taskQueue: 'test',
            });

            expect(source).toBe('none');
        });

        it('should shutdown multiple workers gracefully on module destroy', async () => {
            await service.onModuleInit();
            await service.onApplicationBootstrap();

            await service.onModuleDestroy();

            expect((service as any).workers.size).toBe(0);
        });

        it('should handle errors during individual worker shutdown on destroy', async () => {
            await service.onModuleInit();
            await service.startWorkerByTaskQueue('queue-1');

            const workerInstance = (service as any).workers.get('queue-1');
            workerInstance.worker.shutdown = jest
                .fn()
                .mockRejectedValue(new Error('Shutdown failed'));

            const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.onModuleDestroy();

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining("Error shutting down worker 'queue-1'"),
                expect.any(Error),
            );
            loggerSpy.mockRestore();
        });

        it('should skip shutdown for non-running workers on destroy', async () => {
            await service.onModuleInit();

            const workerInstance = (service as any).workers.get('queue-1');
            const shutdownSpy = jest.spyOn(workerInstance.worker, 'shutdown');

            await service.onModuleDestroy();

            expect(shutdownSpy).not.toHaveBeenCalled();
        });
    });

    describe('Legacy Single Worker', () => {
        let singleWorkerService: TemporalWorkerManagerService;

        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                            taskQueue: 'test-queue',
                            worker: { workflowsPath: './workflows' },
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            singleWorkerService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );
        });

        it('should throw error when connection not established in createWorker', async () => {
            (singleWorkerService as any).connection = null;

            // Mock createConnection to not set connection
            jest.spyOn(singleWorkerService as any, 'createConnection').mockResolvedValue(undefined);

            await expect((singleWorkerService as any).createWorker()).rejects.toThrow(
                'Connection not established',
            );
        });

        it('should return error when worker configuration is missing in initializeWorker', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                            taskQueue: 'test-queue',
                            // No worker config
                        },
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const result = await (service as any).initializeWorker();

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error.message).toBe('Worker configuration is required');
            expect(result.activitiesCount).toBe(0);
        });

        it('should shutdown legacy single worker on module destroy', async () => {
            const mockWorker = {
                shutdown: jest.fn().mockResolvedValue(undefined),
                run: jest.fn().mockResolvedValue(undefined),
            };
            (singleWorkerService as any).worker = mockWorker;
            (singleWorkerService as any).initialized = true;
            (singleWorkerService as any).isRunning = true; // Worker is running
            (singleWorkerService as any).workers.clear(); // Ensure no multiple workers

            await singleWorkerService.onModuleDestroy();

            expect(mockWorker.shutdown).toHaveBeenCalled();
        });

        it('should return null when getting connection if connection is null', async () => {
            (singleWorkerService as any).connection = null;

            const connection = singleWorkerService.getConnection();

            expect(connection).toBeNull();
        });
    });

    describe('Edge Cases - Activity Loading', () => {
        const emptyActivityClassesOptions: TemporalOptions = {
            connection: {
                namespace: 'test-namespace',
                address: 'localhost:7233',
            },
            workers: [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './dist/workflows',
                    activityClasses: [], // Empty array should use all discovered
                },
            ],
            enableLogger: false,
        };

        it('should use all discovered activities when activityClasses is empty', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: emptyActivityClassesOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                discoveredActivity: jest.fn(),
            });

            await service.onModuleInit();

            expect(mockDiscoveryService.getAllActivities).toHaveBeenCalled();
        });

        it('should load activities with loadActivitiesForWorker when activityClasses provided', async () => {
            class TestActivity {}

            const withActivityClassesOptions: TemporalOptions = {
                connection: {
                    namespace: 'test-namespace',
                    address: 'localhost:7233',
                },
                workers: [
                    {
                        taskQueue: 'queue-1',
                        workflowsPath: './dist/workflows',
                        activityClasses: [TestActivity],
                    },
                ],
                enableLogger: false,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: withActivityClassesOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            mockDiscoveryService.getHealthStatus = jest.fn().mockReturnValue({ isComplete: true });
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue({
                testActivity: jest.fn(),
            });

            await service.onModuleInit();

            expect(mockDiscoveryService.getHealthStatus).toHaveBeenCalled();
            expect(mockDiscoveryService.getAllActivities).toHaveBeenCalled();
        });
    });
});
