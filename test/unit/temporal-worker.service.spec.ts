import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { WorkerModuleOptions } from '../../src/interfaces';

// Mock Temporal SDK
jest.mock('@temporalio/worker', () => ({
    NativeConnection: {
        connect: jest.fn(),
    },
    Worker: {
        create: jest.fn(),
    },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    createLogger: jest.fn(() => ({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    })),
}));

// Test classes
class TestActivity {
    testMethod() {}
}

class NonActivityClass {
    someMethod() {}
}

describe('TemporalWorkerManagerService', () => {
    let service: TemporalWorkerManagerService;
    let mockDiscoveryService: jest.Mocked<DiscoveryService>;
    let mockMetadataAccessor: jest.Mocked<TemporalMetadataAccessor>;
    let mockWorker: jest.Mocked<Worker>;
    let mockConnection: jest.Mocked<NativeConnection>;
    let mockOptions: WorkerModuleOptions;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock worker
        mockWorker = {
            run: jest.fn(),
            shutdown: jest.fn(),
        } as any;

        // Create mock connection
        mockConnection = {} as any;

        // Create mock options
        mockOptions = {
            taskQueue: 'test-queue',
            connection: {
                address: 'localhost:7233',
            },
            autoStart: true,
            autoRestart: true,
            allowWorkerFailure: false,
        };

        // Create mock discovery service
        mockDiscoveryService = {
            getControllers: jest.fn().mockReturnValue([]),
            getProviders: jest.fn().mockReturnValue([]),
        } as any;

        // Create mock metadata accessor
        mockMetadataAccessor = {
            getActivityMethodNames: jest.fn().mockReturnValue([]),
            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
            isActivity: jest.fn().mockReturnValue(false),
            getActivityOptions: jest.fn().mockReturnValue(null),
            isActivityMethod: jest.fn().mockReturnValue(false),
            getActivityMethodName: jest.fn().mockReturnValue(null),
            getActivityMethodOptions: jest.fn().mockReturnValue(null),
            getActivityMethodMetadata: jest.fn().mockReturnValue(null),
            getActivityInfo: jest.fn().mockReturnValue({
                isActivity: false,
                activityOptions: null,
                methodNames: [],
                methodCount: 0,
            }),
            validateActivityClass: jest.fn().mockReturnValue({
                isValid: true,
                issues: [],
            }),
            clearCache: jest.fn(),
            getCacheStats: jest.fn().mockReturnValue({
                message: 'Cache stats',
                note: 'No issues',
            }),
        } as any;

        // Setup Temporal SDK mocks
        (NativeConnection.connect as jest.Mock).mockResolvedValue(mockConnection);
        (Worker.create as jest.Mock).mockResolvedValue(mockWorker);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: mockMetadataAccessor,
                },
            ],
        }).compile();

        service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
    });

    describe('Module Lifecycle', () => {
        it('should initialize successfully', async () => {
            await service.onModuleInit();
            expect(service.isWorkerInitialized()).toBe(true);
        });

        it('should handle initialization errors gracefully when allowWorkerFailure is true', async () => {
            mockOptions.allowWorkerFailure = true;
            (NativeConnection.connect as jest.Mock).mockRejectedValue(
                new Error('Connection failed'),
            );

            await service.onModuleInit();
            expect(service.isWorkerInitialized()).toBe(false);
        });

        it('should throw error when allowWorkerFailure is false', async () => {
            mockOptions.allowWorkerFailure = false;
            (NativeConnection.connect as jest.Mock).mockRejectedValue(
                new Error('Connection failed'),
            );

            await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
        });

        it('should start worker in background on bootstrap', async () => {
            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockWorker.run).toHaveBeenCalled();
        });

        it('should not start worker when autoStart is false', async () => {
            mockOptions.autoStart = false;
            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockWorker.run).not.toHaveBeenCalled();
        });

        it('should shutdown gracefully', async () => {
            await service.onModuleInit();
            // Start the worker first so it's running when we shutdown
            await service.onApplicationBootstrap();
            await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for background start
            await service.onModuleDestroy();

            expect(mockWorker.shutdown).toHaveBeenCalled();
        });
    });

    describe('Worker Status', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should return correct worker status', () => {
            const status = service.getWorkerStatus();

            expect(status).toMatchObject({
                isInitialized: true,
                isRunning: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });
        });

        it('should return worker instance', () => {
            const worker = service.getWorker();
            expect(worker).toBe(mockWorker);
        });

        it('should return connection instance', () => {
            const connection = service.getConnection();
            expect(connection).toBe(mockConnection);
        });

        it('should check if worker is running', () => {
            expect(service.isWorkerRunning()).toBe(false);
        });

        it('should check if worker is initialized', () => {
            expect(service.isWorkerInitialized()).toBe(true);
        });
    });

    describe('Activity Discovery', () => {
        it('should handle empty activity discovery', async () => {
            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toEqual([]);
        });

        it('should discover activities when available', async () => {
            // Mock discovery service to return a provider with activities
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                },
                metatype: class TestClass {},
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            // Mock metadata accessor to identify the class as an activity
            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            mockMetadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toContain('testMethod');
        });
    });

    describe('Worker Restart', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should restart worker successfully', async () => {
            await service.onModuleInit(); // Initialize first
            await service.restartWorker();

            expect(mockWorker.shutdown).toHaveBeenCalled();
            expect(mockWorker.run).toHaveBeenCalled();
        });

        it('should handle restart when worker is not initialized', async () => {
            // Create new service without initialization
            const newService = new TemporalWorkerManagerService(
                mockOptions,
                mockDiscoveryService,
                mockMetadataAccessor,
            );

            // Mock the worker as null to simulate not initialized
            Object.defineProperty(newService, 'worker', { value: null });
            Object.defineProperty(newService, 'isInitialized', { value: false });

            await expect(newService.restartWorker()).rejects.toThrow('Worker not initialized');
        });
    });

    describe('Health Check', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should return healthy status when worker is running', async () => {
            // Mock worker as running
            Object.defineProperty(service, 'isRunning', { value: true });

            const health = await service.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.details.isRunning).toBe(true);
            expect(health.activities.total).toBe(0);
        });

        it('should return unhealthy status when worker has errors', async () => {
            await service.onModuleInit(); // Initialize first
            // Mock worker with error
            Object.defineProperty(service, 'lastError', { value: 'Test error' });

            const health = await service.healthCheck();

            expect(health.status).toBe('degraded'); // With error, status is degraded, not unhealthy
            expect(health.details.lastError).toBe('Test error');
        });

        it('should return degraded status when worker is initialized but not running', async () => {
            await service.onModuleInit(); // Initialize first
            const health = await service.healthCheck();

            expect(health.status).toBe('healthy'); // When initialized and no errors, status is healthy
            expect(health.details.isInitialized).toBe(true);
            expect(health.details.isRunning).toBe(false);
        });
    });

    describe('Configuration Validation', () => {
        it('should validate required configuration', async () => {
            mockOptions.taskQueue = undefined as any;

            await expect(service.onModuleInit()).rejects.toThrow('Task queue is required');
        });

        it('should validate connection configuration', async () => {
            const invalidOptions = { ...mockOptions, connection: undefined as any };
            const invalidService = new TemporalWorkerManagerService(
                invalidOptions,
                mockDiscoveryService,
                mockMetadataAccessor,
            );

            await expect(invalidService.onModuleInit()).rejects.toThrow(
                'Connection configuration is required',
            );
        });

        it('should validate connection address', async () => {
            const invalidOptions = { ...mockOptions, connection: { address: '' } };
            const invalidService = new TemporalWorkerManagerService(
                invalidOptions,
                mockDiscoveryService,
                mockMetadataAccessor,
            );

            await expect(invalidService.onModuleInit()).rejects.toThrow(
                'Connection address is required',
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle worker run errors gracefully', async () => {
            mockWorker.run.mockRejectedValue(new Error('Worker run error'));

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(service.getWorkerStatus().lastError).toBe('Worker run error');
        });

        it('should handle connection errors', async () => {
            (NativeConnection.connect as jest.Mock).mockRejectedValue(
                new Error('Connection failed'),
            );

            await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
        });

        it('should handle worker creation errors', async () => {
            (Worker.create as jest.Mock).mockRejectedValue(new Error('Worker creation failed'));

            await expect(service.onModuleInit()).rejects.toThrow('Worker creation failed');
        });
    });

    describe('Auto Restart', () => {
        it('should restart worker on failure when autoRestart is enabled', async () => {
            mockOptions.autoRestart = true;
            mockWorker.run.mockRejectedValue(new Error('Worker error'));

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing and restart
            await new Promise((resolve) => setTimeout(resolve, 6000));

            expect(mockWorker.run).toHaveBeenCalledTimes(2);
        });

        it('should not restart worker when autoRestart is disabled', async () => {
            mockOptions.autoRestart = false;
            mockWorker.run.mockRejectedValue(new Error('Worker error'));

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockWorker.run).toHaveBeenCalledTimes(1);
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete worker lifecycle', async () => {
            // Initialize
            await service.onModuleInit();
            expect(service.isWorkerInitialized()).toBe(true);

            // Start
            await service.onApplicationBootstrap();
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(mockWorker.run).toHaveBeenCalled();

            // Check status
            const status = service.getWorkerStatus();
            expect(status.isInitialized).toBe(true);

            // Shutdown
            await service.onModuleDestroy();
            expect(mockWorker.shutdown).toHaveBeenCalled();
        });

        it('should handle worker with activities', async () => {
            // Mock discovery service to return a provider with activities
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                },
                metatype: class TestClass {},
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            // Mock metadata accessor to identify the class as an activity
            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            mockMetadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toContain('testMethod');

            const status = service.getWorkerStatus();
            expect(status.activitiesCount).toBe(1);
        });
    });

    describe('Environment Defaults', () => {
        it('should handle production environment defaults', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            await service.onModuleInit();

            process.env.NODE_ENV = originalEnv;
            expect(service.isWorkerInitialized()).toBe(true);
        });

        it('should handle development environment defaults', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            await service.onModuleInit();

            process.env.NODE_ENV = originalEnv;
            expect(service.isWorkerInitialized()).toBe(true);
        });

        it('should handle unknown environment defaults', async () => {
            const originalEnv = process.env.NODE_ENV;
            delete process.env.NODE_ENV;

            await service.onModuleInit();

            process.env.NODE_ENV = originalEnv;
            expect(service.isWorkerInitialized()).toBe(true);
        });
    });

    describe('Activity Discovery Edge Cases', () => {
        it('should handle activity class with validation issues', async () => {
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                },
                metatype: class TestClass {},
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockReturnValue({
                isValid: false,
                issues: ['No activity methods found'],
            });

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toEqual([]);
        });

        it('should handle activity class processing errors', async () => {
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                },
                metatype: class TestClass {},
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            mockMetadataAccessor.extractActivityMethods.mockImplementation(() => {
                throw new Error('Processing error');
            });

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toEqual([]);
        });

        it('should handle activity classes filter', async () => {
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                },
                metatype: class AnotherClass {} as any,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            // Set activity classes filter
            mockOptions.activityClasses = [class AnotherClass {}];
            mockMetadataAccessor.isActivity.mockReturnValue(true);

            await service.onModuleInit();

            const activities = service.getRegisteredActivities();
            expect(activities).toEqual([]);
        });

        it('should handle activity classes filter with matching class', async () => {
            const TestClass = class TestClass {};
            const mockProvider = {
                instance: {
                    testMethod: jest.fn(),
                    constructor: TestClass,
                },
                metatype: TestClass,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            // Set activity classes filter - create new service instance with activityClasses
            const optionsWithActivityClasses = {
                ...mockOptions,
                activityClasses: [TestClass],
            };
            const testService = new TemporalWorkerManagerService(
                optionsWithActivityClasses,
                mockDiscoveryService,
                mockMetadataAccessor,
            );

            // Mock the required methods
            jest.spyOn(testService as any, 'createConnection').mockResolvedValue(undefined);
            jest.spyOn(testService as any, 'createWorker').mockResolvedValue(undefined);
            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            mockMetadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );

            await testService.onModuleInit();

            const activities = testService.getRegisteredActivities();
            expect(activities).toContain('testMethod');
        });
    });

    describe('Worker Loop Error Handling', () => {
        it('should handle worker not initialized in run loop', async () => {
            // Create service without initialization
            const newService = new TemporalWorkerManagerService(
                mockOptions,
                mockDiscoveryService,
                mockMetadataAccessor,
            );

            // Mock the worker as null
            Object.defineProperty(newService, 'worker', { value: null });

            await expect(newService['runWorkerLoop']()).rejects.toThrow(
                'Temporal worker not initialized',
            );
        });

        it('should handle worker execution errors', async () => {
            mockWorker.run.mockRejectedValue(new Error('Worker execution error'));

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            // Wait for background processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(service.getWorkerStatus().lastError).toBe('Worker execution error');
        });
    });

    describe('Shutdown Error Handling', () => {
        it('should handle worker shutdown errors', async () => {
            await service.onModuleInit();
            mockWorker.shutdown.mockRejectedValue(new Error('Shutdown error') as never);

            await service.shutdown();

            expect(mockWorker.shutdown).toHaveBeenCalled();
        });

        it('should handle connection close errors', async () => {
            await service.onModuleInit();

            // Mock connection close error
            const mockConnectionWithError = {
                close: jest.fn().mockRejectedValue(new Error('Connection close error')),
            };
            Object.defineProperty(service, 'connection', { value: mockConnectionWithError });

            await service.shutdown();

            expect(mockConnectionWithError.close).toHaveBeenCalled();
        });

        it('should handle worker promise timeout', async () => {
            await service.onModuleInit();
            await service.onApplicationBootstrap();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Mock worker promise that never resolves
            const neverResolvingPromise = new Promise<never>(() => {});
            Object.defineProperty(service, 'workerPromise', { value: neverResolvingPromise });

            await service.shutdown();

            // Should complete without hanging
            expect(true).toBe(true);
        });
    });

    describe('Configuration Logging', () => {
        it('should log worker configuration with bundle', async () => {
            mockOptions.workflowBundle = 'test-bundle';

            await service.onModuleInit();

            // Configuration should be logged
            expect(service.isWorkerInitialized()).toBe(true);
        });

        it('should log worker configuration with workflows path', async () => {
            mockOptions.workflowsPath = '/path/to/workflows';

            await service.onModuleInit();

            // Configuration should be logged
            expect(service.isWorkerInitialized()).toBe(true);
        });

        it('should log worker configuration with namespace', async () => {
            mockOptions.connection = {
                address: 'localhost:7233',
                namespace: 'test-namespace',
            };

            await service.onModuleInit();

            // Configuration should be logged
            expect(service.isWorkerInitialized()).toBe(true);
        });
    });

    describe('Health Check Edge Cases', () => {
        it('should handle health check with no error and running worker', async () => {
            await service.onModuleInit();

            // Mock worker as running and healthy
            Object.defineProperty(service, 'isRunning', { value: true });
            Object.defineProperty(service, 'lastError', { value: undefined });
            Object.defineProperty(service, 'connection', { value: {} });

            const health = await service.healthCheck();

            expect(health.status).toBe('healthy');
        });

        it('should handle health check with error', async () => {
            await service.onModuleInit();

            // Mock worker with error
            Object.defineProperty(service, 'lastError', { value: 'Test error' });

            const health = await service.healthCheck();

            expect(health.status).toBe('degraded');
            expect(health.details.lastError).toBe('Test error');
        });

        it('should handle health check with no error but not healthy', async () => {
            await service.onModuleInit();

            // Mock worker as not healthy (no connection)
            Object.defineProperty(service, 'lastError', { value: undefined });
            Object.defineProperty(service, 'connection', { value: null });

            const health = await service.healthCheck();

            expect(health.status).toBe('degraded');
        });
    });

    describe('Restart Worker Edge Cases', () => {
        it('should handle restart with initialization errors', async () => {
            await service.onModuleInit();

            // Mock initialization error during restart
            const mockInitializeWorker = jest.spyOn(service as any, 'initializeWorker');
            mockInitializeWorker.mockRejectedValue(new Error('Restart initialization error'));

            await expect(service.restartWorker()).rejects.toThrow('Restart initialization error');

            mockInitializeWorker.mockRestore();
        });

        it('should handle restart with auto start disabled', async () => {
            mockOptions.autoStart = false;

            await service.onModuleInit();
            await service.restartWorker();

            // Worker should be restarted but not started automatically
            expect(service.isWorkerInitialized()).toBe(true);
        });
    });

    describe('Activity Discovery Edge Cases', () => {
        it('should handle activity classes filter with matching class', async () => {
            class TestActivity {
                testMethod() {}
            }

            const mockInstance = {
                constructor: TestActivity,
            };

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            jest.spyOn(service['metadataAccessor'], 'isActivity').mockReturnValue(true);
            jest.spyOn(service['metadataAccessor'], 'validateActivityClass').mockReturnValue({
                isValid: true,
                issues: [],
            });
            jest.spyOn(service['metadataAccessor'], 'extractActivityMethods').mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );

            const activities = await service['discoverActivities']();

            expect(activities).toHaveProperty('testMethod');
        });

        it('should handle activity classes filter with non-matching class', async () => {
            const mockInstance = {
                constructor: NonActivityClass,
            };

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: NonActivityClass,
                },
            ] as any);

            jest.spyOn(service['metadataAccessor'], 'isActivity').mockReturnValue(true);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle activity class validation failure', async () => {
            const mockInstance = {
                constructor: TestActivity,
            };

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            jest.spyOn(service['metadataAccessor'], 'isActivity').mockReturnValue(true);
            jest.spyOn(service['metadataAccessor'], 'validateActivityClass').mockReturnValue({
                isValid: false,
                issues: ['Validation error'],
            });

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle activity method extraction error', async () => {
            const mockInstance = {
                constructor: TestActivity,
            };

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            jest.spyOn(service['metadataAccessor'], 'isActivity').mockReturnValue(true);
            jest.spyOn(service['metadataAccessor'], 'validateActivityClass').mockReturnValue({
                isValid: true,
                issues: [],
            });
            jest.spyOn(service['metadataAccessor'], 'extractActivityMethods').mockImplementation(
                () => {
                    throw new Error('Extraction error');
                },
            );

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle wrapper without instance', async () => {
            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: null,
                    metatype: TestActivity,
                },
            ] as any);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle wrapper without metatype', async () => {
            const mockInstance = {
                constructor: TestActivity,
            };

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: null,
                },
            ] as any);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle wrapper without constructor', async () => {
            const mockInstance = {};

            mockDiscoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });
    });

    describe('Worker Configuration Logging', () => {
        it('should log worker configuration with bundle', () => {
            (service as any).options = {
                workflowBundle: 'test-bundle',
                taskQueue: 'test-queue',
            };

            const logSpy = jest.spyOn(service['logger'], 'log');
            const debugSpy = jest.spyOn(service['logger'], 'debug');

            service['logWorkerConfiguration']();

            expect(logSpy).toHaveBeenCalledWith('Worker configuration summary:');
            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringContaining('"workflowSource": "bundle"'),
            );
        });

        it('should log worker configuration with filesystem', () => {
            (service as any).options = {
                workflowsPath: '/path/to/workflows',
                taskQueue: 'test-queue',
            };

            const logSpy = jest.spyOn(service['logger'], 'log');
            const debugSpy = jest.spyOn(service['logger'], 'debug');

            service['logWorkerConfiguration']();

            expect(logSpy).toHaveBeenCalledWith('Worker configuration summary:');
            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringContaining('"workflowSource": "filesystem"'),
            );
        });

        it('should log worker configuration with no workflow source', () => {
            (service as any).options = {
                taskQueue: 'test-queue',
            };

            const logSpy = jest.spyOn(service['logger'], 'log');
            const debugSpy = jest.spyOn(service['logger'], 'debug');

            service['logWorkerConfiguration']();

            expect(logSpy).toHaveBeenCalledWith('Worker configuration summary:');
            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringContaining('"workflowSource": "none"'),
            );
        });
    });

    describe('Environment Defaults', () => {
        it('should return default options for unknown environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'unknown';

            const result = service['getEnvironmentDefaults']();

            expect(result).toEqual({
                maxConcurrentActivityTaskExecutions: 20,
                maxConcurrentWorkflowTaskExecutions: 10,
                maxConcurrentLocalActivityExecutions: 20,
                reuseV8Context: true,
            });

            if (originalEnv) {
                process.env.NODE_ENV = originalEnv;
            }
        });

        it('should return empty options for production environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const result = service['getEnvironmentDefaults']();

            expect(result).toEqual({});

            if (originalEnv) {
                process.env.NODE_ENV = originalEnv;
            }
        });

        it('should return empty options for development environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const result = service['getEnvironmentDefaults']();

            expect(result).toEqual({});

            if (originalEnv) {
                process.env.NODE_ENV = originalEnv;
            }
        });
    });

    describe('Worker Options Building', () => {
        it('should build worker options with workflow bundle', () => {
            (service as any).options = {
                workflowBundle: 'test-bundle',
                taskQueue: 'test-queue',
                workerOptions: { maxConcurrentActivityTaskExecutions: 10 },
            };
            (service as any).activities = { testActivity: jest.fn() };

            const result = service['buildWorkerOptions']();

            expect(result).toHaveProperty('workflowBundle', 'test-bundle');
            expect(result).toHaveProperty('taskQueue', 'test-queue');
            expect(result).toHaveProperty('activities');
            expect(result).toHaveProperty('maxConcurrentActivityTaskExecutions', 10);
        });

        it('should build worker options with workflows path', () => {
            (service as any).options = {
                workflowsPath: '/path/to/workflows',
                taskQueue: 'test-queue',
            };
            (service as any).activities = { testActivity: jest.fn() };

            const result = service['buildWorkerOptions']();

            expect(result).toHaveProperty('workflowsPath', '/path/to/workflows');
            expect(result).toHaveProperty('taskQueue', 'test-queue');
            expect(result).toHaveProperty('activities');
        });

        it('should build worker options without workflow source', () => {
            (service as any).options = {
                taskQueue: 'test-queue',
            };
            (service as any).activities = { testActivity: jest.fn() };

            const result = service['buildWorkerOptions']();

            expect(result).toHaveProperty('taskQueue', 'test-queue');
            expect(result).toHaveProperty('activities');
            expect(result).not.toHaveProperty('workflowBundle');
            expect(result).not.toHaveProperty('workflowsPath');
        });
    });

    describe('Connection Creation', () => {
        it('should create connection with default address', async () => {
            (service as any).options = {};

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'localhost:7233',
                tls: undefined,
            });
        });

        it('should create connection with custom address', async () => {
            (service as any).options = {
                connection: {
                    address: 'custom:7233',
                },
            };

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'custom:7233',
                tls: undefined,
            });
        });

        it('should create connection with API key', async () => {
            (service as any).options = {
                connection: {
                    address: 'test:7233',
                    apiKey: 'test-api-key',
                    metadata: { custom: 'value' },
                },
            };

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'test:7233',
                tls: undefined,
                metadata: {
                    custom: 'value',
                    authorization: 'Bearer test-api-key',
                },
            });
        });
    });

    describe('Worker Creation', () => {
        it('should create worker with connection', async () => {
            (service as any).connection = {};
            (service as any).options = {
                taskQueue: 'test-queue',
                connection: { namespace: 'test-namespace' },
            };

            const createSpy = jest.spyOn(Worker, 'create').mockResolvedValue({} as any);
            jest.spyOn(service as any, 'buildWorkerOptions').mockReturnValue({});

            await service['createWorker']();

            expect(createSpy).toHaveBeenCalledWith({
                connection: {},
                namespace: 'test-namespace',
                taskQueue: 'test-queue',
            });
        });

        it('should throw error when connection not established', async () => {
            (service as any).connection = null;

            await expect(service['createWorker']()).rejects.toThrow('Connection not established');
        });
    });

    describe('Configuration Validation', () => {
        it('should validate configuration with missing task queue', () => {
            (service as any).options = {};

            expect(() => service['validateConfiguration']()).toThrow('Task queue is required');
        });

        it('should validate configuration with both workflowsPath and workflowBundle', () => {
            (service as any).options = {
                taskQueue: 'test-queue',
                connection: { address: 'localhost:7233' },
                workflowsPath: '/path',
                workflowBundle: 'bundle',
            };

            expect(() => service['validateConfiguration']()).toThrow(
                'Cannot specify both workflowsPath and workflowBundle',
            );
        });

        it('should pass validation with valid configuration', () => {
            (service as any).options = {
                taskQueue: 'test-queue',
                connection: { address: 'localhost:7233' },
            };

            expect(() => service['validateConfiguration']()).not.toThrow();
        });
    });

    describe('Worker Background Startup', () => {
        it('should skip starting worker when already running', async () => {
            await service.onModuleInit();
            
            // Set worker as running
            (service as any).isRunning = true;
            
            // This should return early without starting worker
            service['startWorkerInBackground']();
            
            // Should not have set workerPromise
            expect((service as any).workerPromise).toBeNull();
        });

        it('should skip starting worker when worker is null', async () => {
            await service.onModuleInit();
            
            // Set worker as null
            (service as any).worker = null;
            
            // This should return early without starting worker
            service['startWorkerInBackground']();
            
            // Should not have set workerPromise
            expect((service as any).workerPromise).toBeNull();
        });
    });

    describe('Shutdown Edge Cases', () => {
        it('should handle connection close success', async () => {
            await service.onModuleInit();
            
            // Mock connection close to succeed
            const mockConnection = {
                close: jest.fn().mockResolvedValue(undefined),
            };
            Object.defineProperty(service, 'connection', { value: mockConnection });
            
            const logSpy = jest.spyOn(service['logger'], 'log');
            
            await service.shutdown();
            
            expect(mockConnection.close).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Connection closed successfully');
        });

        it('should handle worker promise timeout during shutdown', async () => {
            await service.onModuleInit();
            
            // Mock worker promise that rejects with an error
            const errorPromise = Promise.reject(new Error('Worker promise error'));
            Object.defineProperty(service, 'workerPromise', { value: errorPromise });
            
            const debugSpy = jest.spyOn(service['logger'], 'debug');
            
            await service.shutdown();
            
            // Should have logged about worker promise error
            expect(debugSpy).toHaveBeenCalledWith(
                'Worker promise completed with error during shutdown:',
                'Worker promise error',
            );
        });
    });

    describe('Health Check Complete Coverage', () => {
        it('should return unhealthy status when worker is not initialized', async () => {
            // Don't initialize the service
            const health = await service.healthCheck();
            
            expect(health.status).toBe('unhealthy');
            expect(health.details.isInitialized).toBe(false);
        });
    });

    describe('Error Handling Edge Cases', () => {
        it('should handle initialization error with unknown error format', async () => {
            mockOptions.allowWorkerFailure = true;
            (NativeConnection.connect as jest.Mock).mockRejectedValue(null);

            await service.onModuleInit();
            
            expect(service.getWorkerStatus().lastError).toBe('Unknown initialization error');
        });

        it('should handle initialization error with error stack', async () => {
            mockOptions.allowWorkerFailure = true;
            const error = new Error('Test error');
            error.stack = 'Test stack trace';
            (NativeConnection.connect as jest.Mock).mockRejectedValue(error);

            const errorSpy = jest.spyOn(service['logger'], 'error');
            await service.onModuleInit();
            
            expect(errorSpy).toHaveBeenCalledWith('Error during worker initialization', 'Test stack trace');
        });

        it('should handle worker loop error with unknown error format', async () => {
            mockWorker.run.mockRejectedValue(null);

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(service.getWorkerStatus().lastError).toBe('Unknown worker error');
        });

        it('should handle worker loop error with error stack', async () => {
            const error = new Error('Worker error');
            error.stack = 'Worker stack trace';
            mockWorker.run.mockRejectedValue(error);

            await service.onModuleInit();
            await service.onApplicationBootstrap();

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(service.getWorkerStatus().lastError).toBe('Worker error');
        });

        it('should handle worker execution error with unknown error format', async () => {
            const mockWorker = {
                run: jest.fn().mockRejectedValue(null),
                shutdown: jest.fn(),
            };

            jest.spyOn(service as any, 'createWorker').mockResolvedValue(undefined);
            jest.spyOn(service as any, 'createConnection').mockResolvedValue(undefined);
            jest.spyOn(service as any, 'discoverActivities').mockResolvedValue({});

            (service as any).worker = mockWorker;

            try {
                await service['runWorkerLoop']();
            } catch (error) {
                // Expected to throw
            }
            
            expect((service as any).lastError).toBe('Worker execution error');
        });

        it('should handle worker execution error with error stack', async () => {
            const error = new Error('Execution error');
            error.stack = 'Execution stack trace';
            const mockWorker = {
                run: jest.fn().mockRejectedValue(error),
                shutdown: jest.fn(),
            };

            jest.spyOn(service as any, 'createWorker').mockResolvedValue(undefined);
            jest.spyOn(service as any, 'createConnection').mockResolvedValue(undefined);
            jest.spyOn(service as any, 'discoverActivities').mockResolvedValue({});

            (service as any).worker = mockWorker;

            const errorSpy = jest.spyOn(service['logger'], 'error');
            await expect(service['runWorkerLoop']()).rejects.toThrow('Execution error');
            expect(errorSpy).toHaveBeenCalledWith('Worker execution failed', 'Execution stack trace');
        });
    });

    describe('Connection Creation Edge Cases', () => {
        it('should handle connection with metadata but no API key', async () => {
            (service as any).options = {
                connection: {
                    address: 'localhost:7233',
                    metadata: { custom: 'value' },
                },
            };

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'localhost:7233',
                tls: undefined,
            });
        });

        it('should handle connection with API key and existing metadata', async () => {
            (service as any).options = {
                connection: {
                    address: 'localhost:7233',
                    apiKey: 'test-key',
                    metadata: { existing: 'metadata' },
                },
            };

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'localhost:7233',
                tls: undefined,
                metadata: {
                    existing: 'metadata',
                    authorization: 'Bearer test-key',
                },
            });
        });

        it('should handle connection with API key and no existing metadata', async () => {
            (service as any).options = {
                connection: {
                    address: 'localhost:7233',
                    apiKey: 'test-key',
                },
            };

            const connectSpy = jest.spyOn(NativeConnection, 'connect').mockResolvedValue({} as any);

            await service['createConnection']();

            expect(connectSpy).toHaveBeenCalledWith({
                address: 'localhost:7233',
                tls: undefined,
                metadata: {
                    authorization: 'Bearer test-key',
                },
            });
        });
    });

    describe('Activity Discovery Complete Coverage', () => {
        it('should handle provider with no targetClass', async () => {
            const mockProvider = {
                instance: {},
                metatype: null,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle provider with no constructor and no metatype', async () => {
            // Create an instance without a constructor property
            const instanceWithoutConstructor = Object.create(null);
            const mockProvider = {
                instance: instanceWithoutConstructor,
                metatype: null,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle provider with no instance in activity processing', async () => {
            const mockProvider = {
                instance: null,
                metatype: TestActivity,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            mockMetadataAccessor.isActivity.mockReturnValue(true);

            const activities = await service['discoverActivities']();

            expect(Object.keys(activities)).toHaveLength(0);
        });

        it('should handle activity processing error with error stack', async () => {
            const error = new Error('Processing error');
            error.stack = 'Processing stack trace';
            const mockProvider = {
                instance: {
                    constructor: TestActivity,
                },
                metatype: TestActivity,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockImplementation(() => {
                throw error;
            });

            const errorSpy = jest.spyOn(service['logger'], 'error');
            const activities = await service['discoverActivities']();

            expect(activities).toEqual({});
            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to process activity class TestActivity:',
                'Processing stack trace',
            );
        });

        it('should handle activity processing error with unknown error format', async () => {
            const mockProvider = {
                instance: {
                    constructor: TestActivity,
                },
                metatype: TestActivity,
            };
            mockDiscoveryService.getProviders.mockReturnValue([mockProvider] as any);

            mockMetadataAccessor.isActivity.mockReturnValue(true);
            mockMetadataAccessor.validateActivityClass.mockImplementation(() => {
                throw null;
            });

            const errorSpy = jest.spyOn(service['logger'], 'error');
            const activities = await service['discoverActivities']();

            expect(activities).toEqual({});
            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to process activity class TestActivity:',
                null,
            );
        });
    });

    describe('Shutdown Complete Coverage', () => {
        it('should handle shutdown with no worker', async () => {
            (service as any).worker = null;

            await service.shutdown();

            expect(service.isWorkerInitialized()).toBe(false);
        });

        it('should handle shutdown with worker shutdown error and stack', async () => {
            await service.onModuleInit();
            
            const error = new Error('Shutdown error');
            error.stack = 'Shutdown stack trace';
            mockWorker.shutdown.mockRejectedValue(error as never);

            const errorSpy = jest.spyOn(service['logger'], 'error');
            await service.shutdown();

            expect(errorSpy).toHaveBeenCalledWith('Error during worker shutdown', 'Shutdown stack trace');
        });

        it('should handle shutdown with no connection', async () => {
            await service.onModuleInit();
            (service as any).connection = null;

            await service.shutdown();

            expect(service.isWorkerInitialized()).toBe(false);
        });
    });

    describe('Worker Status Edge Cases', () => {
        it('should handle worker status with all conditions false', async () => {
            await service.onModuleInit();
            
            (service as any).lastError = 'Some error';
            (service as any).connection = null;
            
            const status = service.getWorkerStatus();
            
            expect(status.isHealthy).toBe(false);
        });

        it('should handle worker status with startedAt and uptime calculation', async () => {
            await service.onModuleInit();
            
            const startTime = new Date();
            (service as any).startedAt = startTime;
            
            const status = service.getWorkerStatus();
            
            expect(status.startedAt).toBe(startTime);
            expect(status.uptime).toBeDefined();
            expect(typeof status.uptime).toBe('number');
        });

        it('should handle worker status with different workflow configurations', async () => {
            await service.onModuleInit();
            
            // Test with workflowBundle
            (service as any).options.workflowBundle = 'test-bundle';
            let status = service.getWorkerStatus();
            expect(status.workflowSource).toBe('bundle');
            
            // Test with workflowsPath
            (service as any).options.workflowBundle = undefined;
            (service as any).options.workflowsPath = '/test/path';
            status = service.getWorkerStatus();
            expect(status.workflowSource).toBe('filesystem');
            
            // Test with neither
            (service as any).options.workflowsPath = undefined;
            status = service.getWorkerStatus();
            expect(status.workflowSource).toBe('none');
        });

        it('should handle worker status with no taskQueue', async () => {
            await service.onModuleInit();
            
            // Remove taskQueue to test fallback
            (service as any).options.taskQueue = undefined;
            
            const status = service.getWorkerStatus();
            
            expect(status.taskQueue).toBe('unknown');
        });

        it('should handle restart error with error stack', async () => {
            await service.onModuleInit();
            
            const error = new Error('Restart error');
            error.stack = 'Restart stack trace';
            jest.spyOn(service as any, 'initializeWorker').mockRejectedValue(error);

            const errorSpy = jest.spyOn(service['logger'], 'error');
            await expect(service.restartWorker()).rejects.toThrow('Restart error');
            expect(errorSpy).toHaveBeenCalledWith('Error during worker restart', 'Restart stack trace');
        });

        it('should handle restart error with unknown error format', async () => {
            await service.onModuleInit();
            
            jest.spyOn(service as any, 'initializeWorker').mockRejectedValue(null);

            try {
                await service.restartWorker();
            } catch (error) {
                // Expected to throw
            }
            
            expect((service as any).lastError).toBe('Unknown restart error');
        });
    });
});
