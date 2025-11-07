import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions, WorkerDefinition } from '../../src/interfaces';

describe('TemporalWorkerManagerService - Edge Cases', () => {
    let service: TemporalWorkerManagerService;
    let mockDiscoveryService: any;
    let mockConnection: any;

    beforeEach(() => {
        mockDiscoveryService = {
            discoverActivities: jest.fn().mockResolvedValue({
                success: true,
                discoveredCount: 0,
                activities: [],
                errors: [],
            }),
            getAllActivities: jest.fn().mockReturnValue({
                activity1: jest.fn(),
                activity2: jest.fn(),
            }),
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true }),
        };

        mockConnection = {
            close: jest.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createWorkerFromDefinition - edge cases', () => {
        it('should throw error if worker already exists for task queue', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            // Add existing worker
            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };
            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                    },
                ],
            ]);

            const workerDef: WorkerDefinition = {
                taskQueue: 'queue-1',
                workflowsPath: './workflows',
            };

            await expect((service as any).createWorkerFromDefinition(workerDef)).rejects.toThrow(
                "Worker for task queue 'queue-1' already exists",
            );
        });

        it('should use activity classes when provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const loadActivitiesSpy = jest
                .spyOn(service as any, 'loadActivitiesForWorker')
                .mockResolvedValue(undefined);

            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };

            // Mock Worker.create
            const WorkerModule = await import('@temporalio/worker');
            jest.spyOn(WorkerModule, 'Worker' as any, 'get').mockReturnValue({
                create: jest.fn().mockResolvedValue(mockWorker),
            } as any);

            const workerDef: WorkerDefinition = {
                taskQueue: 'queue-with-classes',
                workflowsPath: './workflows',
                activityClasses: [class TestActivity {}],
            };

            await (service as any).createWorkerFromDefinition(workerDef);

            expect(loadActivitiesSpy).toHaveBeenCalled();
            loadActivitiesSpy.mockRestore();
        });

        it('should use discovered activities when no activity classes provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };

            // Mock Worker.create
            const WorkerModule = await import('@temporalio/worker');
            jest.spyOn(WorkerModule, 'Worker' as any, 'get').mockReturnValue({
                create: jest.fn().mockResolvedValue(mockWorker),
            } as any);

            const workerDef: WorkerDefinition = {
                taskQueue: 'queue-no-classes',
                workflowsPath: './workflows',
            };

            await (service as any).createWorkerFromDefinition(workerDef);

            expect(mockDiscoveryService.getAllActivities).toHaveBeenCalled();
        });

        it('should use workflowBundle if provided instead of workflowsPath', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };
            const mockBundle = { code: Buffer.from('code'), sourceMap: Buffer.from('map') };

            // Mock Worker.create to capture config
            let capturedConfig: any;
            const WorkerModule = await import('@temporalio/worker');
            jest.spyOn(WorkerModule, 'Worker' as any, 'get').mockReturnValue({
                create: jest.fn().mockImplementation((config) => {
                    capturedConfig = config;
                    return Promise.resolve(mockWorker);
                }),
            } as any);

            const workerDef: WorkerDefinition = {
                taskQueue: 'queue-with-bundle',
                workflowBundle: mockBundle,
            };

            await (service as any).createWorkerFromDefinition(workerDef);

            expect(capturedConfig.workflowBundle).toBe(mockBundle);
            expect(capturedConfig.workflowsPath).toBeUndefined();
        });

        it('should merge workerOptions into config when provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };
            const workerOptions = {
                maxConcurrentActivityTaskExecutions: 100,
                maxConcurrentWorkflowTaskExecutions: 50,
            };

            // Mock Worker.create to capture config
            let capturedConfig: any;
            const WorkerModule = await import('@temporalio/worker');
            jest.spyOn(WorkerModule, 'Worker' as any, 'get').mockReturnValue({
                create: jest.fn().mockImplementation((config) => {
                    capturedConfig = config;
                    return Promise.resolve(mockWorker);
                }),
            } as any);

            const workerDef: WorkerDefinition = {
                taskQueue: 'queue-with-options',
                workflowsPath: './workflows',
                workerOptions,
            };

            await (service as any).createWorkerFromDefinition(workerDef);

            expect(capturedConfig.maxConcurrentActivityTaskExecutions).toBe(100);
            expect(capturedConfig.maxConcurrentWorkflowTaskExecutions).toBe(50);
        });
    });

    describe('getWorkflowSourceFromDef', () => {
        it('should return "bundle" when workflowBundle is provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const workerDef: WorkerDefinition = {
                taskQueue: 'test',
                workflowBundle: { code: Buffer.from(''), sourceMap: Buffer.from('') },
            };

            const result = (service as any).getWorkflowSourceFromDef(workerDef);

            expect(result).toBe('bundle');
        });

        it('should return "filesystem" when workflowsPath is provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const workerDef: WorkerDefinition = {
                taskQueue: 'test',
                workflowsPath: './workflows',
            };

            const result = (service as any).getWorkflowSourceFromDef(workerDef);

            expect(result).toBe('filesystem');
        });

        it('should return "none" when no workflow source is provided', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const workerDef: WorkerDefinition = {
                taskQueue: 'test',
            };

            const result = (service as any).getWorkflowSourceFromDef(workerDef);

            expect(result).toBe('none');
        });
    });

    describe('loadActivitiesForWorker', () => {
        it('should wait for discovery service to complete', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            let callCount = 0;
            const mockDiscoveryWithDelay = {
                ...mockDiscoveryService,
                getHealthStatus: jest.fn().mockImplementation(() => {
                    callCount++;
                    return { isComplete: callCount >= 3 }; // Complete after 3 calls
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryWithDelay,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const activities = new Map<string, Function>();
            await (service as any).loadActivitiesForWorker(activities);

            expect(callCount).toBeGreaterThanOrEqual(3);
            expect(mockDiscoveryWithDelay.getAllActivities).toHaveBeenCalled();
        });

        it('should timeout after max attempts', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const mockDiscoveryNeverComplete = {
                ...mockDiscoveryService,
                getHealthStatus: jest.fn().mockReturnValue({ isComplete: false }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryNeverComplete,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const activities = new Map<string, Function>();
            await (service as any).loadActivitiesForWorker(activities);

            expect(mockDiscoveryNeverComplete.getHealthStatus).toHaveBeenCalled();
        });
    });

    describe('registerWorker - connection creation', () => {
        it('should create connection if it does not exist', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            // Ensure connection is null initially
            (service as any).connection = null;

            const mockWorker = { run: jest.fn(), shutdown: jest.fn() };

            const createConnectionSpy = jest
                .spyOn(service as any, 'createConnection')
                .mockImplementation(async () => {
                    (service as any).connection = mockConnection;
                });

            const createWorkerSpy = jest
                .spyOn(service as any, 'createWorkerFromDefinition')
                .mockResolvedValue({
                    worker: mockWorker,
                    taskQueue: 'new-queue',
                    namespace: 'default',
                    isRunning: false,
                    isInitialized: true,
                    lastError: null,
                    startedAt: null,
                    restartCount: 0,
                    activities: new Map(),
                    workflowSource: 'filesystem',
                });

            const workerDef: WorkerDefinition = {
                taskQueue: 'new-queue',
                workflowsPath: './workflows',
                autoStart: false,
            };

            await service.registerWorker(workerDef);

            expect(createConnectionSpy).toHaveBeenCalled();

            createConnectionSpy.mockRestore();
            createWorkerSpy.mockRestore();
        });
    });

    describe('Worker status calculation with uptime', () => {
        it('should calculate uptime correctly for running worker', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const startedAt = new Date(Date.now() - 5000); // Started 5 seconds ago
            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: {},
                        taskQueue: 'queue-1',
                        namespace: 'default',
                        isRunning: true,
                        isInitialized: true,
                        lastError: null,
                        startedAt,
                        activities: new Map(),
                        workflowSource: 'filesystem',
                    },
                ],
            ]);

            const status = service.getWorkerStatusByTaskQueue('queue-1');

            expect(status?.uptime).toBeGreaterThanOrEqual(4900);
            expect(status?.uptime).toBeLessThan(6000);
        });

        it('should return undefined uptime for worker that has not started', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: mockConnection,
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: {},
                        taskQueue: 'queue-1',
                        namespace: 'default',
                        isRunning: false,
                        isInitialized: true,
                        lastError: null,
                        startedAt: null,
                        activities: new Map(),
                        workflowSource: 'filesystem',
                    },
                ],
            ]);

            const status = service.getWorkerStatusByTaskQueue('queue-1');

            expect(status?.uptime).toBeUndefined();
        });
    });
});
