import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions, WorkerDefinition } from '../../src/interfaces';

describe('TemporalWorkerManagerService - Multiple Workers', () => {
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
            getAllActivities: jest.fn().mockReturnValue({}),
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true }),
        };

        mockConnection = {
            close: jest.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Multiple workers initialization', () => {
        it('should initialize multiple workers when workers array is provided', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                    autoStart: false,
                },
                {
                    taskQueue: 'queue-2',
                    workflowsPath: './workflows',
                    autoStart: false,
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
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

            // Mock Worker.create
            const mockWorker = {
                run: jest.fn().mockResolvedValue(undefined),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            jest.mock('@temporalio/worker', () => ({
                Worker: {
                    create: jest.fn().mockResolvedValue(mockWorker),
                },
            }));

            const workerCreateSpy = jest.spyOn(service as any, 'createWorkerFromDefinition');
            workerCreateSpy.mockResolvedValue({
                worker: mockWorker,
                taskQueue: 'queue-1',
                namespace: 'default',
                isRunning: false,
                isInitialized: true,
                lastError: null,
                startedAt: null,
                restartCount: 0,
                activities: new Map(),
                workflowSource: 'filesystem',
            });

            await service.onModuleInit();

            expect(workerCreateSpy).toHaveBeenCalledTimes(2);
            workerCreateSpy.mockRestore();
        });

        it('should handle worker creation errors when allowConnectionFailure is false', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
                allowConnectionFailure: false,
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

            const workerCreateSpy = jest
                .spyOn(service as any, 'createWorkerFromDefinition')
                .mockRejectedValue(new Error('Worker creation failed'));

            await expect(service.onModuleInit()).rejects.toThrow('Worker creation failed');

            workerCreateSpy.mockRestore();
        });

        it('should continue on worker creation errors when allowConnectionFailure is true', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                },
                {
                    taskQueue: 'queue-2',
                    workflowsPath: './workflows',
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
                allowConnectionFailure: true,
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            const workerCreateSpy = jest
                .spyOn(service as any, 'createWorkerFromDefinition')
                .mockRejectedValueOnce(new Error('First worker failed'))
                .mockResolvedValueOnce({
                    worker: mockWorker,
                    taskQueue: 'queue-2',
                    namespace: 'default',
                    isRunning: false,
                    isInitialized: true,
                    lastError: null,
                    startedAt: null,
                    restartCount: 0,
                    activities: new Map(),
                    workflowSource: 'filesystem',
                });

            const loggerErrorSpy = jest
                .spyOn((service as any).logger, 'error')
                .mockImplementation();

            await service.onModuleInit();

            expect(loggerErrorSpy).toHaveBeenCalledWith(
                "Failed to initialize worker for task queue 'queue-1'",
                expect.any(Error),
            );

            workerCreateSpy.mockRestore();
            loggerErrorSpy.mockRestore();
        });

        it('should skip worker initialization if connection fails and allowConnectionFailure is true', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
                allowConnectionFailure: true,
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
                        useValue: null, // No connection
                    },
                ],
            }).compile();

            service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);

            const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.onModuleInit();

            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Connection failed, skipping worker initialization',
            );

            loggerWarnSpy.mockRestore();
        });

        it('should auto-start workers on application bootstrap when autoStart is not false', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                    autoStart: true,
                },
                {
                    taskQueue: 'queue-2',
                    workflowsPath: './workflows',
                    // autoStart defaults to true
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
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

            // Mock workers map
            const mockWorker = {
                run: jest.fn().mockResolvedValue(undefined),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                        isRunning: false,
                        isInitialized: true,
                    },
                ],
                [
                    'queue-2',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-2',
                        isRunning: false,
                        isInitialized: true,
                    },
                ],
            ]);

            const startWorkerSpy = jest
                .spyOn(service, 'startWorkerByTaskQueue')
                .mockResolvedValue();

            await service.onApplicationBootstrap();

            expect(startWorkerSpy).toHaveBeenCalledWith('queue-1');
            expect(startWorkerSpy).toHaveBeenCalledWith('queue-2');
            expect(startWorkerSpy).toHaveBeenCalledTimes(2);

            startWorkerSpy.mockRestore();
        });

        it('should not auto-start workers when autoStart is false', async () => {
            const workerDefinitions: WorkerDefinition[] = [
                {
                    taskQueue: 'queue-1',
                    workflowsPath: './workflows',
                    autoStart: false,
                },
            ];

            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: workerDefinitions,
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                        isRunning: false,
                        isInitialized: true,
                    },
                ],
            ]);

            const startWorkerSpy = jest
                .spyOn(service, 'startWorkerByTaskQueue')
                .mockResolvedValue();

            await service.onApplicationBootstrap();

            expect(startWorkerSpy).not.toHaveBeenCalled();

            startWorkerSpy.mockRestore();
        });
    });

    describe('registerWorker', () => {
        it('should create and register a new worker dynamically', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: [],
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

            const mockWorker = {
                run: jest.fn().mockResolvedValue(undefined),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

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

            const startWorkerSpy = jest
                .spyOn(service, 'startWorkerByTaskQueue')
                .mockResolvedValue();

            const workerDef: WorkerDefinition = {
                taskQueue: 'new-queue',
                workflowsPath: './workflows',
                autoStart: true,
            };

            const result = await service.registerWorker(workerDef);

            expect(result.success).toBe(true);
            expect(result.taskQueue).toBe('new-queue');
            expect(result.worker).toBe(mockWorker);
            expect(createWorkerSpy).toHaveBeenCalledWith(workerDef);
            expect(startWorkerSpy).toHaveBeenCalledWith('new-queue');

            createWorkerSpy.mockRestore();
            startWorkerSpy.mockRestore();
        });

        it('should not auto-start worker if autoStart is false', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: [],
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

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

            const startWorkerSpy = jest.spyOn(service, 'startWorkerByTaskQueue');

            const workerDef: WorkerDefinition = {
                taskQueue: 'new-queue',
                workflowsPath: './workflows',
                autoStart: false,
            };

            await service.registerWorker(workerDef);

            expect(startWorkerSpy).not.toHaveBeenCalled();

            createWorkerSpy.mockRestore();
            startWorkerSpy.mockRestore();
        });

        it('should return error result if worker creation fails', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: [],
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

            const loggerErrorSpy = jest
                .spyOn((service as any).logger, 'error')
                .mockImplementation();

            const createWorkerSpy = jest
                .spyOn(service as any, 'createWorkerFromDefinition')
                .mockRejectedValue(new Error('Creation failed'));

            const workerDef: WorkerDefinition = {
                taskQueue: 'failing-queue',
                workflowsPath: './workflows',
            };

            const result = await service.registerWorker(workerDef);

            expect(result.success).toBe(false);
            expect(result.taskQueue).toBe('failing-queue');
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Creation failed');
            expect(loggerErrorSpy).toHaveBeenCalled();

            createWorkerSpy.mockRestore();
            loggerErrorSpy.mockRestore();
        });

        it('should throw error if task queue is empty', async () => {
            const moduleOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                workers: [],
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
                taskQueue: '',
                workflowsPath: './workflows',
            };

            const result = await service.registerWorker(workerDef);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('Task queue is required');
        });
    });

    describe('getWorker', () => {
        it('should return worker by task queue', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                    },
                ],
            ]);

            const result = service.getWorker('queue-1');

            expect(result).toBe(mockWorker);
        });

        it('should return null if worker not found', async () => {
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

            (service as any).workers = new Map();

            const result = service.getWorker('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getAllWorkers', () => {
        it('should return information about all workers', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                        namespace: 'default',
                        isRunning: true,
                        isInitialized: true,
                        lastError: null,
                        startedAt: new Date(),
                        activities: new Map([['activity1', jest.fn()]]),
                        workflowSource: 'filesystem',
                    },
                ],
                [
                    'queue-2',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-2',
                        namespace: 'default',
                        isRunning: false,
                        isInitialized: true,
                        lastError: 'Some error',
                        startedAt: null,
                        activities: new Map(),
                        workflowSource: 'bundle',
                    },
                ],
            ]);

            const result = service.getAllWorkers();

            expect(result.totalWorkers).toBe(2);
            expect(result.runningWorkers).toBe(1);
            expect(result.healthyWorkers).toBe(1); // Only queue-1 is healthy
            expect(result.workers.size).toBe(2);
            expect(result.workers.get('queue-1')?.isHealthy).toBe(true);
            expect(result.workers.get('queue-2')?.isHealthy).toBe(false);
        });
    });

    describe('getWorkerStatusByTaskQueue', () => {
        it('should return status for specific worker', async () => {
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

            const startedAt = new Date();
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
                        activities: new Map([['activity1', jest.fn()]]),
                        workflowSource: 'filesystem',
                    },
                ],
            ]);

            const result = service.getWorkerStatusByTaskQueue('queue-1');

            expect(result).not.toBeNull();
            expect(result?.taskQueue).toBe('queue-1');
            expect(result?.isRunning).toBe(true);
            expect(result?.isHealthy).toBe(true);
            expect(result?.activitiesCount).toBe(1);
            expect(result?.startedAt).toBe(startedAt);
            expect(result?.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should return null for non-existent worker', async () => {
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

            (service as any).workers = new Map();

            const result = service.getWorkerStatusByTaskQueue('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('startWorkerByTaskQueue', () => {
        it('should start a specific worker successfully', async () => {
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

            const mockWorker = {
                run: jest.fn().mockResolvedValue(undefined),
                shutdown: jest.fn(),
            };

            const workerInstance = {
                worker: mockWorker,
                taskQueue: 'queue-1',
                namespace: 'default',
                isRunning: false,
                isInitialized: true,
                lastError: null,
                startedAt: null,
                activities: new Map(),
                workflowSource: 'filesystem' as const,
            };

            (service as any).workers = new Map([['queue-1', workerInstance]]);

            const loggerInfoSpy = jest.spyOn((service as any).logger, 'info').mockImplementation();

            await service.startWorkerByTaskQueue('queue-1');

            expect(workerInstance.isRunning).toBe(true);
            expect(workerInstance.startedAt).toBeInstanceOf(Date);
            expect(workerInstance.lastError).toBeNull();
            expect(mockWorker.run).toHaveBeenCalled();
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                "Starting worker for task queue 'queue-1'...",
            );

            loggerInfoSpy.mockRestore();
        });

        it('should warn if worker is already running', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                        isRunning: true, // Already running
                        isInitialized: true,
                    },
                ],
            ]);

            const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            await service.startWorkerByTaskQueue('queue-1');

            expect(loggerWarnSpy).toHaveBeenCalledWith("Worker for 'queue-1' is already running");
            expect(mockWorker.run).not.toHaveBeenCalled();

            loggerWarnSpy.mockRestore();
        });

        it('should throw error if worker not found', async () => {
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

            (service as any).workers = new Map();

            await expect(service.startWorkerByTaskQueue('non-existent')).rejects.toThrow(
                "Worker for task queue 'non-existent' not found",
            );
        });

        it('should handle worker run failure', async () => {
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

            const mockWorker = {
                run: jest.fn().mockRejectedValue(new Error('Worker failed to start')),
                shutdown: jest.fn(),
            };

            const workerInstance = {
                worker: mockWorker,
                taskQueue: 'queue-1',
                namespace: 'default',
                isRunning: false,
                isInitialized: true,
                lastError: null,
                startedAt: null,
                activities: new Map(),
                workflowSource: 'filesystem' as const,
            };

            (service as any).workers = new Map([['queue-1', workerInstance]]);

            const loggerErrorSpy = jest
                .spyOn((service as any).logger, 'error')
                .mockImplementation();

            // Start worker
            await service.startWorkerByTaskQueue('queue-1');

            // Wait for worker.run() rejection to be handled
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(workerInstance.isRunning).toBe(false);
            expect(workerInstance.lastError).toBe('Worker failed to start');

            loggerErrorSpy.mockRestore();
        });
    });

    describe('stopWorkerByTaskQueue', () => {
        it('should stop a running worker successfully', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn().mockResolvedValue(undefined),
            };

            const workerInstance = {
                worker: mockWorker,
                taskQueue: 'queue-1',
                namespace: 'default',
                isRunning: true,
                isInitialized: true,
                lastError: null,
                startedAt: new Date(),
                activities: new Map(),
                workflowSource: 'filesystem' as const,
            };

            (service as any).workers = new Map([['queue-1', workerInstance]]);

            const loggerInfoSpy = jest.spyOn((service as any).logger, 'info').mockImplementation();

            await service.stopWorkerByTaskQueue('queue-1');

            expect(workerInstance.isRunning).toBe(false);
            expect(workerInstance.startedAt).toBeNull();
            expect(mockWorker.shutdown).toHaveBeenCalled();
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                "Stopping worker for task queue 'queue-1'...",
            );

            loggerInfoSpy.mockRestore();
        });

        it('should debug log if worker is not running', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn(),
            };

            (service as any).workers = new Map([
                [
                    'queue-1',
                    {
                        worker: mockWorker,
                        taskQueue: 'queue-1',
                        isRunning: false, // Not running
                        isInitialized: true,
                    },
                ],
            ]);

            const loggerDebugSpy = jest
                .spyOn((service as any).logger, 'debug')
                .mockImplementation();

            await service.stopWorkerByTaskQueue('queue-1');

            expect(loggerDebugSpy).toHaveBeenCalledWith("Worker for 'queue-1' is not running");
            expect(mockWorker.shutdown).not.toHaveBeenCalled();

            loggerDebugSpy.mockRestore();
        });

        it('should throw error if worker not found', async () => {
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

            (service as any).workers = new Map();

            await expect(service.stopWorkerByTaskQueue('non-existent')).rejects.toThrow(
                "Worker for task queue 'non-existent' not found",
            );
        });

        it('should handle shutdown errors', async () => {
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

            const mockWorker = {
                run: jest.fn(),
                shutdown: jest.fn().mockRejectedValue(new Error('Shutdown failed')),
            };

            const workerInstance = {
                worker: mockWorker,
                taskQueue: 'queue-1',
                namespace: 'default',
                isRunning: true,
                isInitialized: true,
                lastError: null,
                startedAt: new Date(),
                activities: new Map(),
                workflowSource: 'filesystem' as const,
            };

            (service as any).workers = new Map([['queue-1', workerInstance]]);

            const loggerErrorSpy = jest
                .spyOn((service as any).logger, 'error')
                .mockImplementation();

            await expect(service.stopWorkerByTaskQueue('queue-1')).rejects.toThrow(
                'Shutdown failed',
            );

            expect(workerInstance.lastError).toBe('Shutdown failed');
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                "Failed to stop worker for 'queue-1'",
                expect.any(Error),
            );

            loggerErrorSpy.mockRestore();
        });
    });

    describe('getConnection', () => {
        it('should return the native connection', async () => {
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

            (service as any).connection = mockConnection;

            const result = service.getConnection();

            expect(result).toBe(mockConnection);
        });

        it('should return null if no connection', async () => {
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

            (service as any).connection = null;

            const result = service.getConnection();

            expect(result).toBeNull();
        });
    });
});
