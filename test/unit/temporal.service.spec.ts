import { Test, TestingModule } from '@nestjs/testing';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalService } from '../../src/services/temporal.service';
import { DiscoveryStats, WorkerStatus } from '../../src/interfaces';

describe('TemporalService', () => {
    let service: TemporalService;
    let clientService: jest.Mocked<TemporalClientService>;
    let discoveryService: jest.Mocked<TemporalDiscoveryService>;
    let workerManager: jest.Mocked<TemporalWorkerManagerService>;

    const mockOptions: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'default',
        },
        taskQueue: 'test-queue',
    };

    beforeEach(async () => {
        const mockClientService = {
            startWorkflow: jest.fn(),
            signalWorkflow: jest.fn(),
            queryWorkflow: jest.fn(),
            terminateWorkflow: jest.fn(),
            cancelWorkflow: jest.fn(),
            getRawClient: jest.fn(),
            isHealthy: jest.fn(),
        };

        const mockDiscoveryService = {
            getStats: jest.fn(),
            getWorkflowNames: jest.fn(),
            hasWorkflow: jest.fn(),
        };

        const mockWorkerManager = {
            getWorkerStatus: jest.fn(),
            restartWorker: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalService,
                {
                    provide: TemporalClientService,
                    useValue: mockClientService,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalWorkerManagerService,
                    useValue: mockWorkerManager,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalService>(TemporalService);
        clientService = module.get(TemporalClientService);
        discoveryService = module.get(TemporalDiscoveryService);
        workerManager = module.get(TemporalWorkerManagerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should call logInitializationSummary', async () => {
            const mockStats: DiscoveryStats = {
                controllers: 2,
                methods: 8,
                signals: 2,  
                queries: 3,
                workflows: 3,
                childWorkflows: 1,
            };
            discoveryService.getStats.mockReturnValue(mockStats);

            const logSpy = jest.spyOn(service as any, 'logInitializationSummary');
            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
        });
    });

    describe('getClient', () => {
        it('should return client service', () => {
            const result = service.getClient();
            expect(result).toBe(clientService);
        });
    });

    describe('getDiscoveryService', () => {
        it('should return discovery service', () => {
            const result = service.getDiscoveryService();
            expect(result).toBe(discoveryService);
        });
    });

    describe('getWorkerManager', () => {
        it('should return worker manager when available', () => {
            const result = service.getWorkerManager();
            expect(result).toBe(workerManager);
        });

        it('should return undefined when worker manager not available', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            const result = serviceWithoutWorker.getWorkerManager();
            expect(result).toBeUndefined();
        });
    });

    describe('startWorkflow', () => {
        it('should start workflow with enhanced options', async () => {
            const mockResult = {
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: {} as any,
            };

            clientService.startWorkflow.mockResolvedValue(mockResult);

            const result = await service.startWorkflow('TestWorkflow', ['arg1'], { taskQueue: 'test' });

            expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', ['arg1'], { taskQueue: 'test' });
            expect(result).toBe(mockResult);
        });

        it('should use default task queue when not provided', async () => {
            const mockResult = {
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: {} as any,
            };

            clientService.startWorkflow.mockResolvedValue(mockResult);

            await service.startWorkflow('TestWorkflow', ['arg1'], {});

            expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', ['arg1'], { taskQueue: 'test-queue' });
        });
    });

    describe('signalWorkflow', () => {
        it('should signal workflow with validation', async () => {
            clientService.signalWorkflow.mockResolvedValue(undefined);

            await service.signalWorkflow('workflow-id', 'signal-name', ['arg1']);

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('workflow-id', 'signal-name', ['arg1']);
        });

        it('should signal workflow without args', async () => {
            clientService.signalWorkflow.mockResolvedValue(undefined);

            await service.signalWorkflow('workflow-id', 'signal-name');

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('workflow-id', 'signal-name', []);
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.signalWorkflow('', 'signal-name')).rejects.toThrow('Workflow ID is required');
        });

        it('should throw error for whitespace-only workflow ID', async () => {
            await expect(service.signalWorkflow('   ', 'signal-name')).rejects.toThrow('Workflow ID is required');
        });
    });

    describe('queryWorkflow', () => {
        it('should query workflow with validation', async () => {
            clientService.queryWorkflow.mockResolvedValue('query-result');

            const result = await service.queryWorkflow('workflow-id', 'query-name', ['arg1']);

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('workflow-id', 'query-name', ['arg1']);
            expect(result).toBe('query-result');
        });

        it('should query workflow without args', async () => {
            clientService.queryWorkflow.mockResolvedValue('query-result');

            const result = await service.queryWorkflow('workflow-id', 'query-name');

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('workflow-id', 'query-name', []);
            expect(result).toBe('query-result');
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.queryWorkflow('', 'query-name')).rejects.toThrow('Workflow ID is required');
        });
    });

    describe('terminateWorkflow', () => {
        it('should terminate workflow with reason', async () => {
            clientService.terminateWorkflow.mockResolvedValue(undefined);

            await service.terminateWorkflow('workflow-id', 'test reason');

            expect(clientService.terminateWorkflow).toHaveBeenCalledWith('workflow-id', 'test reason');
        });

        it('should terminate workflow without reason', async () => {
            clientService.terminateWorkflow.mockResolvedValue(undefined);

            await service.terminateWorkflow('workflow-id');

            expect(clientService.terminateWorkflow).toHaveBeenCalledWith('workflow-id', undefined);
        });
    });

    describe('cancelWorkflow', () => {
        it('should cancel workflow', async () => {
            clientService.cancelWorkflow.mockResolvedValue(undefined);

            await service.cancelWorkflow('workflow-id');

            expect(clientService.cancelWorkflow).toHaveBeenCalledWith('workflow-id');
        });
    });

    describe('hasWorker', () => {
        it('should return true when worker manager is available', () => {
            expect(service.hasWorker()).toBe(true);
        });

        it('should return false when worker manager is not available', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            expect(serviceWithoutWorker.hasWorker()).toBe(false);
        });
    });

    describe('getWorkerStatus', () => {
        it('should return worker status when available', () => {
            const mockStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = service.getWorkerStatus();

            expect(result).toBe(mockStatus);
        });

        it('should return null when worker manager not available', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            expect(serviceWithoutWorker.getWorkerStatus()).toBe(null);
        });
    });

    describe('restartWorker', () => {
        it('should restart worker when available', async () => {
            workerManager.restartWorker.mockResolvedValue(undefined);

            await service.restartWorker();

            expect(workerManager.restartWorker).toHaveBeenCalled();
        });

        it('should throw error when worker manager not available', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            await expect(serviceWithoutWorker.restartWorker()).rejects.toThrow('Worker manager not available');
        });
    });

    describe('getWorkerHealth', () => {
        it('should return healthy status when worker is healthy', async () => {
            const mockStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('healthy');
            expect(result.details).toBe(mockStatus);
        });

        it('should return degraded status when worker is running but not healthy', async () => {
            const mockStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return unhealthy status when worker is not running', async () => {
            const mockStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should return not_available when worker manager not available', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            const result = await serviceWithoutWorker.getWorkerHealth();

            expect(result.status).toBe('not_available');
        });

        it('should return unhealthy status on error', async () => {
            workerManager.getWorkerStatus.mockImplementation(() => {
                throw new Error('Worker error');
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
            expect(result.details).toEqual({ error: 'Worker error' });
        });
    });

    describe('getDiscoveryStats', () => {
        it('should return discovery stats', () => {
            const mockStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            discoveryService.getStats.mockReturnValue(mockStats);

            const result = service.getDiscoveryStats();

            expect(result).toBe(mockStats);
        });
    });

    describe('getSystemStatus', () => {
        it('should return comprehensive system status', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getSystemStatus();

            expect(result.client.available).toBe(true);
            expect(result.client.healthy).toBe(true);
            expect(result.worker.available).toBe(true);
            expect(result.worker.status).toBe(mockWorkerStatus);
            expect(result.discovery).toBe(mockDiscoveryStats);
        });

        it('should handle service without worker', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);

            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);

            const result = await serviceWithoutWorker.getSystemStatus();

            expect(result.worker.available).toBe(false);
            expect(result.worker.status).toBeUndefined();
        });
    });

    describe('getOverallHealth', () => {
        it('should return healthy when all components are healthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('healthy');
            expect(result.components.client.healthy).toBe(true);
            expect(result.components.worker.available).toBe(true);
        });

        it('should return unhealthy when client is not healthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(false);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should return degraded when worker has issues', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 3,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 4,
                childWorkflows: 2,
            };

            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return degraded when discovery has no workflows but controllers exist', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 2,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 0,
                childWorkflows: 2,
            };

            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 5,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return worker status as error when available but unhealthy (line 340)', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 2,
                methods: 10,
                signals: 2,
                queries: 3,
                workflows: 1,
                childWorkflows: 0,
            };

            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: false,
                isHealthy: false, // Worker is unhealthy
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            service.hasWorker = jest.fn().mockReturnValue(true); // Worker is available
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            // Worker status should be 'error' when available but unhealthy (line 340)
            expect(result.components.worker.status).toBe('error');
        });
    });

    describe('getAvailableWorkflows', () => {
        it('should return available workflow names', () => {
            const mockWorkflows = ['WorkflowA', 'WorkflowB'];
            discoveryService.getWorkflowNames.mockReturnValue(mockWorkflows);

            const result = service.getAvailableWorkflows();

            expect(result).toBe(mockWorkflows);
        });
    });

    describe('hasWorkflow', () => {
        it('should return true when workflow exists', () => {
            discoveryService.hasWorkflow.mockReturnValue(true);

            const result = service.hasWorkflow('TestWorkflow');

            expect(result).toBe(true);
            expect(discoveryService.hasWorkflow).toHaveBeenCalledWith('TestWorkflow');
        });

        it('should return false when workflow does not exist', () => {
            discoveryService.hasWorkflow.mockReturnValue(false);

            const result = service.hasWorkflow('NonexistentWorkflow');

            expect(result).toBe(false);
        });
    });

    describe('private methods', () => {
        describe('enhanceWorkflowOptions', () => {
            it('should use provided task queue', async () => {
                clientService.startWorkflow.mockResolvedValue({
                    result: Promise.resolve('test'),
                    workflowId: 'test-id',
                    firstExecutionRunId: 'test-run',
                    handle: {} as any,
                });

                await service.startWorkflow('TestWorkflow', [], { taskQueue: 'custom-queue' });

                expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', [], { taskQueue: 'custom-queue' });
            });

            it('should use module task queue when not provided', async () => {
                clientService.startWorkflow.mockResolvedValue({
                    result: Promise.resolve('test'),
                    workflowId: 'test-id',
                    firstExecutionRunId: 'test-run',
                    handle: {} as any,
                });

                await service.startWorkflow('TestWorkflow', [], {});

                expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', [], { taskQueue: 'test-queue' });
            });

            it('should use default task queue when module task queue is not provided (line 383)', async () => {
                // Create a service without taskQueue option to test fallback
                const serviceWithoutTaskQueue = new (service.constructor as any)(
                    clientService,
                    discoveryService,
                    workerManager,
                    {}, // no taskQueue option
                );

                clientService.startWorkflow.mockResolvedValue({
                    result: Promise.resolve('test'),
                    workflowId: 'test-id',
                    firstExecutionRunId: 'test-run',
                    handle: {} as any,
                });

                await serviceWithoutTaskQueue.startWorkflow('TestWorkflow', [], {});

                // Should fall back to DEFAULT_TASK_QUEUE (line 383)
                expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', [], { taskQueue: 'default-task-queue' });
            });
        });

        describe('validateWorkflowExists', () => {
            it('should validate workflow ID in signalWorkflow', async () => {
                await expect(service.signalWorkflow('', 'signal')).rejects.toThrow('Workflow ID is required');
            });

            it('should validate workflow ID in queryWorkflow', async () => {
                await expect(service.queryWorkflow('', 'query')).rejects.toThrow('Workflow ID is required');
            });
        });

        describe('logInitializationSummary', () => {
            it('should log initialization details', async () => {
                const mockStats: DiscoveryStats = {
                    controllers: 3,
                    methods: 10,
                    signals: 2,
                    queries: 3,
                    workflows: 4,
                    childWorkflows: 2,
                };

                discoveryService.getStats.mockReturnValue(mockStats);

                // Call the private method through onModuleInit
                await service.onModuleInit();

                expect(discoveryService.getStats).toHaveBeenCalled();
            });

            it('should log when worker is not available (line 407)', async () => {
                const mockStats: DiscoveryStats = {
                    controllers: 3,
                    methods: 10,
                    signals: 2,
                    queries: 3,
                    workflows: 4,
                    childWorkflows: 2,
                };

                discoveryService.getStats.mockReturnValue(mockStats);
                service.hasWorker = jest.fn().mockReturnValue(false); // No worker available

                const loggerSpy = jest.spyOn((service as any).logger, 'log');

                await service.onModuleInit();

                // Should log 'not available' when hasWorker() returns false (line 407)
                expect(loggerSpy).toHaveBeenCalledWith('Worker: not available');
                
                loggerSpy.mockRestore();
            });

        });
    });
});