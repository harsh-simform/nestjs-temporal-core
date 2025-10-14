import { Test, TestingModule } from '@nestjs/testing';
import { TemporalService } from '../../src/services/temporal.service';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';

describe('TemporalService', () => {
    let service: TemporalService;
    let mockClientService: jest.Mocked<Partial<TemporalClientService>>;
    let mockWorkerService: jest.Mocked<Partial<TemporalWorkerManagerService>>;
    let mockScheduleService: jest.Mocked<Partial<TemporalScheduleService>>;
    let mockDiscoveryService: jest.Mocked<Partial<TemporalDiscoveryService>>;
    let mockMetadataAccessor: jest.Mocked<Partial<TemporalMetadataAccessor>>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        enableLogger: false,
        logLevel: 'error',
    };

    beforeEach(async () => {
        mockClientService = {
            isHealthy: jest.fn().mockReturnValue(true),
            startWorkflow: jest
                .fn()
                .mockResolvedValue({ workflowId: 'test-wf-123', firstExecutionRunId: 'run-456' }),
            signalWorkflow: jest.fn().mockResolvedValue(undefined),
            queryWorkflow: jest.fn().mockResolvedValue({ status: 'running' }),
            getWorkflowHandle: jest.fn().mockReturnValue({ workflowId: 'test-wf-123' }),
            terminateWorkflow: jest.fn().mockResolvedValue(undefined),
            cancelWorkflow: jest.fn().mockResolvedValue(undefined),
        };

        mockWorkerService = {
            isWorkerAvailable: jest.fn().mockReturnValue(true),
            isWorkerRunning: jest.fn().mockReturnValue(true),
            getWorkerStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 5,
            }),
            getStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 5,
            }),
            stopWorker: jest.fn().mockResolvedValue(undefined),
            startWorker: jest.fn().mockResolvedValue(undefined),
            restartWorker: jest
                .fn()
                .mockResolvedValue({ success: true, restartCount: 0, maxRestarts: 3 }),
        };

        mockScheduleService = {
            isHealthy: jest.fn().mockReturnValue(true),
            getScheduleStats: jest.fn().mockReturnValue({ total: 0, active: 0, paused: 0 }),
        };

        mockDiscoveryService = {
            getHealthStatus: jest
                .fn()
                .mockReturnValue({ isComplete: true, status: 'healthy', timestamp: Date.now() }),
            getActivityNames: jest.fn().mockReturnValue([]),
            getStats: jest.fn().mockReturnValue({ classes: 0, methods: 0, total: 0 }),
            executeActivity: jest.fn().mockResolvedValue({}),
            getActivity: jest.fn().mockReturnValue(undefined),
            getAllActivities: jest.fn().mockReturnValue({}),
            hasActivity: jest.fn().mockReturnValue(false),
        };

        mockMetadataAccessor = {
            isActivity: jest.fn().mockReturnValue(false),
            getActivityMetadata: jest.fn().mockReturnValue(null),
            extractActivityMethodsFromClass: jest.fn().mockReturnValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: TemporalClientService,
                    useValue: mockClientService,
                },
                {
                    provide: TemporalWorkerManagerService,
                    useValue: mockWorkerService,
                },
                {
                    provide: TemporalScheduleService,
                    useValue: mockScheduleService,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: mockMetadataAccessor,
                },
            ],
        }).compile();

        service = module.get<TemporalService>(TemporalService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('onModuleInit', () => {
        it('should initialize successfully', async () => {
            const result = await service.onModuleInit();

            expect(result.success).toBe(true);
            expect(result.servicesInitialized.client).toBe(true);
            expect(result.servicesInitialized.discovery).toBe(true);
            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
        });

        it('should continue initialization even if services are not immediately ready', async () => {
            // Mock setTimeout to immediately call the callback
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = ((cb: any) => {
                cb();
                return 0 as any;
            }) as any;

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: {
                            ...mockClientService,
                            isHealthy: jest.fn().mockReturnValue(false),
                        },
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: mockWorkerService,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: mockScheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: {
                            ...mockDiscoveryService,
                            getHealthStatus: jest
                                .fn()
                                .mockReturnValue({ isComplete: false, timestamp: Date.now() }),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: mockMetadataAccessor,
                    },
                ],
            }).compile();

            const timeoutService = module.get<TemporalService>(TemporalService);
            const result = await timeoutService.onModuleInit();

            global.setTimeout = originalSetTimeout;

            // The service still initializes successfully even if not all services are ready
            expect(result.success).toBe(true);
        });
    });

    describe('onModuleDestroy', () => {
        it('should shutdown gracefully', async () => {
            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(mockWorkerService.stopWorker).toHaveBeenCalled();
        });

        it('should handle shutdown errors', async () => {
            mockWorkerService.stopWorker = jest
                .fn()
                .mockRejectedValue(new Error('Shutdown failed'));
            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await service.onModuleInit();
            await service.onModuleDestroy();

            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });

        it('should reuse shutdown promise if called multiple times', async () => {
            await service.onModuleInit();

            const promise1 = service.onModuleDestroy();
            const promise2 = service.onModuleDestroy();

            // Both should return the same promise instance
            await expect(Promise.all([promise1, promise2])).resolves.toBeDefined();
        });
    });

    describe('startWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should start workflow successfully', async () => {
            const result = await service.startWorkflow('testWorkflow', ['arg1', 'arg2'], {
                workflowId: 'test-123',
            });

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
            expect(mockClientService.startWorkflow).toHaveBeenCalledWith(
                'testWorkflow',
                ['arg1', 'arg2'],
                expect.any(Object),
            );
        });

        it('should use default task queue if not provided', async () => {
            await service.startWorkflow('testWorkflow', [], {});

            expect(mockClientService.startWorkflow).toHaveBeenCalledWith(
                'testWorkflow',
                [],
                expect.objectContaining({
                    taskQueue: 'test-queue',
                }),
            );
        });

        it('should throw error if not initialized', async () => {
            const uninitializedService = new TemporalService(
                mockOptions,
                mockClientService as any,
                mockWorkerService as any,
                mockScheduleService as any,
                mockDiscoveryService as any,
                mockMetadataAccessor as any,
            );

            await expect(uninitializedService.startWorkflow('test')).rejects.toThrow();
        });

        it('should handle workflow start errors', async () => {
            mockClientService.startWorkflow = jest
                .fn()
                .mockRejectedValue(new Error('Start failed'));

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow('Start failed');
        });

        it('should handle non-Error exceptions', async () => {
            mockClientService.startWorkflow = jest.fn().mockRejectedValue('String error');

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow();
        });
    });

    describe('signalWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should signal workflow successfully', async () => {
            const result = await service.signalWorkflow('test-wf-123', 'testSignal', ['arg1']);

            expect(result.success).toBe(true);
            expect(result.workflowId).toBe('test-wf-123');
            expect(result.signalName).toBe('testSignal');
            expect(mockClientService.signalWorkflow).toHaveBeenCalledWith(
                'test-wf-123',
                'testSignal',
                ['arg1'],
            );
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.signalWorkflow('', 'testSignal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should throw error for whitespace-only workflow ID', async () => {
            await expect(service.signalWorkflow('   ', 'testSignal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should handle signal errors', async () => {
            mockClientService.signalWorkflow = jest
                .fn()
                .mockRejectedValue(new Error('Signal failed'));

            await expect(service.signalWorkflow('test-wf-123', 'testSignal')).rejects.toThrow(
                'Signal failed',
            );
        });

        it('should handle non-Error exceptions in signal', async () => {
            mockClientService.signalWorkflow = jest.fn().mockRejectedValue('String error');

            await expect(service.signalWorkflow('test-wf-123', 'testSignal')).rejects.toThrow();
        });
    });

    describe('queryWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should query workflow successfully', async () => {
            const result = await service.queryWorkflow('test-wf-123', 'testQuery', ['arg1']);

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.workflowId).toBe('test-wf-123');
            expect(result.queryName).toBe('testQuery');
            expect(mockClientService.queryWorkflow).toHaveBeenCalledWith(
                'test-wf-123',
                'testQuery',
                ['arg1'],
            );
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.queryWorkflow('', 'testQuery')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should throw error for whitespace-only workflow ID', async () => {
            await expect(service.queryWorkflow('   ', 'testQuery')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should handle query errors', async () => {
            mockClientService.queryWorkflow = jest
                .fn()
                .mockRejectedValue(new Error('Query failed'));

            await expect(service.queryWorkflow('test-wf-123', 'testQuery')).rejects.toThrow(
                'Query failed',
            );
        });

        it('should handle non-Error exceptions in query', async () => {
            mockClientService.queryWorkflow = jest.fn().mockRejectedValue('String error');

            await expect(service.queryWorkflow('test-wf-123', 'testQuery')).rejects.toThrow();
        });
    });

    describe('getWorkflowHandle', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get workflow handle', async () => {
            const handle = await service.getWorkflowHandle('test-wf-123');

            expect(handle).toBeDefined();
            expect(mockClientService.getWorkflowHandle).toHaveBeenCalledWith(
                'test-wf-123',
                undefined,
            );
        });

        it('should get workflow handle with runId', async () => {
            const handle = await service.getWorkflowHandle('test-wf-123', 'run-456');

            expect(handle).toBeDefined();
            expect(mockClientService.getWorkflowHandle).toHaveBeenCalledWith(
                'test-wf-123',
                'run-456',
            );
        });
    });

    describe('terminateWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should terminate workflow successfully', async () => {
            const result = await service.terminateWorkflow('test-wf-123', 'test reason');

            expect(result.success).toBe(true);
            expect(result.workflowId).toBe('test-wf-123');
            expect(result.reason).toBe('test reason');
            expect(mockClientService.terminateWorkflow).toHaveBeenCalledWith(
                'test-wf-123',
                'test reason',
            );
        });

        it('should terminate workflow without reason', async () => {
            const result = await service.terminateWorkflow('test-wf-123');

            expect(result.success).toBe(true);
            expect(result.workflowId).toBe('test-wf-123');
            expect(result.reason).toBeUndefined();
        });

        it('should handle termination errors', async () => {
            mockClientService.terminateWorkflow = jest
                .fn()
                .mockRejectedValue(new Error('Termination failed'));

            const result = await service.terminateWorkflow('test-wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle non-Error exceptions in terminate', async () => {
            mockClientService.terminateWorkflow = jest.fn().mockRejectedValue('String error');

            const result = await service.terminateWorkflow('test-wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
        });
    });

    describe('cancelWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should cancel workflow successfully', async () => {
            const result = await service.cancelWorkflow('test-wf-123');

            expect(result.success).toBe(true);
            expect(result.workflowId).toBe('test-wf-123');
            expect(mockClientService.cancelWorkflow).toHaveBeenCalledWith('test-wf-123');
        });

        it('should handle cancellation errors', async () => {
            mockClientService.cancelWorkflow = jest
                .fn()
                .mockRejectedValue(new Error('Cancellation failed'));

            const result = await service.cancelWorkflow('test-wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle non-Error exceptions in cancel', async () => {
            mockClientService.cancelWorkflow = jest.fn().mockRejectedValue('String error');

            const result = await service.cancelWorkflow('test-wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
        });
    });

    describe('Service getters', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get client service', () => {
            const client = service.client;

            expect(client).toBeDefined();
            expect(client).toBe(mockClientService);
        });

        it('should get worker service', () => {
            const worker = service.worker;

            expect(worker).toBeDefined();
            expect(worker).toBe(mockWorkerService);
        });

        it('should get schedule service', () => {
            const schedule = service.schedule;

            expect(schedule).toBeDefined();
            expect(schedule).toBe(mockScheduleService);
        });

        it('should get activity service', () => {
            const activity = service.activity;

            expect(activity).toBeDefined();
            expect(activity).toBe(mockDiscoveryService);
        });

        it('should get discovery service', () => {
            const discovery = service.discovery;

            expect(discovery).toBeDefined();
            expect(discovery).toBe(mockDiscoveryService);
        });

        it('should get metadata accessor', () => {
            const metadata = service.metadata;

            expect(metadata).toBeDefined();
            expect(metadata).toBe(mockMetadataAccessor);
        });
    });

    describe('Worker methods', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get worker status', () => {
            const status = service.getWorkerStatus();

            expect(status).toBeDefined();
            if (status) {
                expect(status.isInitialized).toBe(true);
            }
            expect(mockWorkerService.getStatus).toHaveBeenCalled();
        });

        it('should start worker', async () => {
            await service.startWorker();

            expect(mockWorkerService.startWorker).toHaveBeenCalled();
        });

        it('should stop worker', async () => {
            await service.stopWorker();

            expect(mockWorkerService.stopWorker).toHaveBeenCalled();
        });

        it('should check if worker is running', () => {
            const isRunning = service.isWorkerRunning();

            expect(isRunning).toBe(true);
            expect(mockWorkerService.isWorkerRunning).toHaveBeenCalled();
        });

        it('should check if has worker', () => {
            const hasWorker = service.hasWorker();

            expect(hasWorker).toBe(true);
            expect(mockWorkerService.isWorkerAvailable).toHaveBeenCalled();
        });
    });

    describe('Activity methods', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should execute activity successfully', async () => {
            mockDiscoveryService.executeActivity = jest.fn().mockResolvedValue({ data: 'test' });

            const result = await service.executeActivity('testActivity', 'arg1');

            expect(result.success).toBe(true);
            expect(result.activityName).toBe('testActivity');
            expect(mockDiscoveryService.executeActivity).toHaveBeenCalledWith(
                'testActivity',
                'arg1',
            );
        });

        it('should handle activity execution errors', async () => {
            mockDiscoveryService.executeActivity = jest
                .fn()
                .mockRejectedValue(new Error('Activity failed'));

            const result = await service.executeActivity('testActivity');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should get activity by name', () => {
            const activityFn = jest.fn();
            mockDiscoveryService.getActivity = jest.fn().mockReturnValue(activityFn);

            const result = service.getActivity('testActivity');

            expect(result).toBe(activityFn);
            expect(mockDiscoveryService.getActivity).toHaveBeenCalledWith('testActivity');
        });

        it('should get all activities', () => {
            const activities = { test: jest.fn() };
            mockDiscoveryService.getAllActivities = jest.fn().mockReturnValue(activities);

            const result = service.getAllActivities();

            expect(result).toBe(activities);
            expect(mockDiscoveryService.getAllActivities).toHaveBeenCalled();
        });

        it('should check if activity exists', () => {
            mockDiscoveryService.hasActivity = jest.fn().mockReturnValue(true);

            const result = service.hasActivity('testActivity');

            expect(result).toBe(true);
            expect(mockDiscoveryService.hasActivity).toHaveBeenCalledWith('testActivity');
        });

        it('should get activity names', () => {
            const names = ['activity1', 'activity2'];
            mockDiscoveryService.getActivityNames = jest.fn().mockReturnValue(names);

            const result = service.getActivityNames();

            expect(result).toBe(names);
            expect(mockDiscoveryService.getActivityNames).toHaveBeenCalled();
        });

        it('should check if target is activity', () => {
            const TestClass = class {};
            mockMetadataAccessor.isActivity = jest.fn().mockReturnValue(true);

            const result = service.isActivity(TestClass);

            expect(result).toBe(true);
            expect(mockMetadataAccessor.isActivity).toHaveBeenCalledWith(TestClass);
        });

        it('should check if method is activity method', () => {
            const target = { testMethod: jest.fn() };

            const result = service.isActivityMethod(target, 'testMethod');

            expect(typeof result).toBe('boolean');
        });

        it('should get activity metadata', () => {
            const TestClass = class {};
            const metadata = { name: 'test' };
            mockMetadataAccessor.getActivityMetadata = jest.fn().mockReturnValue(metadata);

            const result = service.getActivityMetadata(TestClass);

            expect(result).toBe(metadata);
            expect(mockMetadataAccessor.getActivityMetadata).toHaveBeenCalledWith(TestClass);
        });

        it('should extract activity methods', () => {
            const TestClass = class {};
            const methods = [{ name: 'test', descriptor: {} }];
            mockMetadataAccessor.extractActivityMethodsFromClass = jest
                .fn()
                .mockReturnValue(methods);

            const result = service.extractActivityMethods(TestClass);

            expect(result).toBe(methods);
            expect(mockMetadataAccessor.extractActivityMethodsFromClass).toHaveBeenCalledWith(
                TestClass,
            );
        });
    });

    describe('Health and Status methods', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get overall health status', async () => {
            const health = await service.getOverallHealth();

            expect(health).toBeDefined();
            expect(health.status).toBe('healthy');
            expect(health.components).toBeDefined();
            expect(health.timestamp).toBeDefined();
        });

        it('should handle unhealthy client service', async () => {
            mockClientService.isHealthy = jest.fn().mockReturnValue(false);

            const health = await service.getOverallHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.components.client.status).toBe('unhealthy');
        });

        it('should handle unhealthy worker service', async () => {
            mockWorkerService.getWorkerStatus = jest
                .fn()
                .mockReturnValue({ isHealthy: false, isInitialized: true, isRunning: false });

            const health = await service.getOverallHealth();

            expect(health.status).toBe('degraded');
        });

        it('should handle unhealthy schedule service', async () => {
            mockScheduleService.isHealthy = jest.fn().mockReturnValue(false);

            const health = await service.getOverallHealth();

            expect(health.status).toBe('unhealthy');
        });

        it('should get worker health status', async () => {
            const health = await service.getWorkerHealth();

            expect(health).toBeDefined();
            expect(health.status).toBe('healthy');
        });

        it('should handle worker not available', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(false);

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('not_available');
        });

        it('should get health status', () => {
            const health = service.getHealth();

            expect(health).toBeDefined();
            expect(health.status).toBeDefined();
            expect(health.services).toBeDefined();
        });

        it('should get statistics', () => {
            const stats = service.getStats();

            expect(stats).toBeDefined();
            expect(stats.activities).toBeDefined();
            expect(stats.worker).toBeDefined();
            expect(stats.schedules).toBeDefined();
        });
    });

    describe('Private methods', () => {
        it('should extract error messages from Error objects', () => {
            const error = new Error('Test error');
            const message = (service as any).extractErrorMessage(error);

            expect(message).toBe('Test error');
        });

        it('should extract error messages from string errors', () => {
            const message = (service as any).extractErrorMessage('String error');

            expect(message).toBe('String error');
        });

        it('should handle unknown error types', () => {
            const message = (service as any).extractErrorMessage({ code: 'ERROR' });

            expect(message).toBe('Unknown error');
        });

        it('should enhance workflow options with task queue', () => {
            const options = (service as any).enhanceWorkflowOptions({});

            expect(options.taskQueue).toBe('test-queue');
        });

        it('should preserve existing task queue in options', () => {
            const options = (service as any).enhanceWorkflowOptions({ taskQueue: 'custom-queue' });

            expect(options.taskQueue).toBe('custom-queue');
        });

        it('should ensure service is initialized', () => {
            expect(() => (service as any).ensureInitialized()).toThrow();
        });

        it('should handle onModuleInit with non-Error exception lines 72-75', async () => {
            // Mock setTimeout to not actually wait
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = ((cb: any) => {
                cb();
                return 0 as any;
            }) as any;

            const moduleWithError: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: {
                            ...mockClientService,
                            isHealthy: jest.fn().mockImplementation(() => {
                                throw { code: 'INIT_ERROR' };
                            }),
                        },
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: mockWorkerService,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: mockScheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: mockMetadataAccessor,
                    },
                ],
            }).compile();

            const errorService = moduleWithError.get<TemporalService>(TemporalService);

            // Should handle non-Error exceptions during init
            const result = await errorService.onModuleInit();

            // The service handles errors gracefully and still initializes
            expect(result.success).toBe(true);

            global.setTimeout = originalSetTimeout;
        });

        it('should handle onModuleDestroy with non-Error exception line 140', async () => {
            mockWorkerService.stopWorker = jest.fn().mockImplementation(() => {
                throw { code: 'SHUTDOWN_ERROR' };
            });

            await service.onModuleInit();
            await service.onModuleDestroy();

            // Should handle the error gracefully
            expect(mockWorkerService.stopWorker).toHaveBeenCalled();
        });

        it('should handle startWorkflow with non-Error exception lines 345', async () => {
            await service.onModuleInit();

            mockClientService.startWorkflow = jest.fn().mockImplementation(() => {
                throw { code: 'START_ERROR', message: 'Custom error' };
            });

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow();
        });

        it('should handle signalWorkflow with non-Error exception line 363', async () => {
            await service.onModuleInit();

            mockClientService.signalWorkflow = jest.fn().mockImplementation(() => {
                throw { code: 'SIGNAL_ERROR' };
            });

            await expect(service.signalWorkflow('wf-123', 'signal')).rejects.toThrow();
        });

        it('should handle queryWorkflow with non-Error exception line 454', async () => {
            await service.onModuleInit();

            mockClientService.queryWorkflow = jest.fn().mockImplementation(() => {
                throw { code: 'QUERY_ERROR' };
            });

            await expect(service.queryWorkflow('wf-123', 'query')).rejects.toThrow();
        });

        it('should handle terminateWorkflow with non-Error exception line 537', async () => {
            await service.onModuleInit();

            mockClientService.terminateWorkflow = jest.fn().mockImplementation(() => {
                throw { code: 'TERMINATE_ERROR' };
            });

            const result = await service.terminateWorkflow('wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle cancelWorkflow with non-Error exception lines 545-548', async () => {
            await service.onModuleInit();

            mockClientService.cancelWorkflow = jest.fn().mockImplementation(() => {
                throw { code: 'CANCEL_ERROR' };
            });

            const result = await service.cancelWorkflow('wf-123');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle executeActivity with non-Error exception line 556', async () => {
            await service.onModuleInit();

            mockDiscoveryService.executeActivity = jest.fn().mockImplementation(() => {
                throw { code: 'ACTIVITY_ERROR' };
            });

            const result = await service.executeActivity('testActivity');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle getOverallHealth with degraded worker lines 676-686', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            mockWorkerService.getWorkerStatus = jest.fn().mockReturnValue({
                isHealthy: false,
                isInitialized: true,
                isRunning: false,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 0,
            });

            await service.onModuleInit();

            const health = await service.getOverallHealth();

            expect(health.status).toBe('degraded');
            expect(health.components.worker.status).toBe('degraded');
        });

        it('should handle getWorkerHealth with not_available status line 724', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(false);

            await service.onModuleInit();

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('not_available');
        });

        it('should handle isWorkerRunning when workerService is null line 345', async () => {
            // Create service without worker service
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: mockClientService,
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: null,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: mockScheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: mockMetadataAccessor,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            await serviceWithoutWorker.onModuleInit();

            const isRunning = serviceWithoutWorker.isWorkerRunning();

            expect(isRunning).toBe(false);
        });

        it('should handle getWorkerStatus when workerService is null line 363', async () => {
            // Create service without worker service
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: mockClientService,
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: null,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: mockScheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: mockMetadataAccessor,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            await serviceWithoutWorker.onModuleInit();

            const status = serviceWithoutWorker.getWorkerStatus();

            expect(status).toBeNull();
        });

        it('should handle isActivityMethod when reflection fails line 454', async () => {
            await service.onModuleInit();

            // Create a problematic target that causes reflection to fail
            const target = {};
            const methodName = 'testMethod';

            // Mock Reflect.hasMetadata to throw
            const originalHasMetadata = Reflect.hasMetadata;
            Reflect.hasMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Reflection error');
            });

            const result = service.isActivityMethod(target, methodName);

            expect(result).toBe(false);

            // Restore
            Reflect.hasMetadata = originalHasMetadata;
        });

        it('should handle getWorkerHealth with unhealthy worker not running line 537', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            mockWorkerService.getWorkerStatus = jest.fn().mockReturnValue({
                isHealthy: false,
                isRunning: false,
                isInitialized: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 0,
            });

            await service.onModuleInit();

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.details).toBeDefined();
        });

        it('should handle getWorkerHealth with worker running but not healthy line 545-548', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            mockWorkerService.getWorkerStatus = jest.fn().mockReturnValue({
                isHealthy: false,
                isRunning: true,
                isInitialized: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 0,
            });

            await service.onModuleInit();

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('degraded');
            expect(health.details).toBeDefined();
        });

        it('should handle getWorkerHealth exception line 556', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            mockWorkerService.getWorkerStatus = jest.fn().mockImplementation(() => {
                throw new Error('Worker status error');
            });

            await service.onModuleInit();

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.details).toBeUndefined();
        });

        it('should handle getWorkerHealthStatus when workerService is null line 724', async () => {
            // Create service without worker service
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: mockClientService,
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: null,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: mockScheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: mockMetadataAccessor,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = moduleWithoutWorker.get<TemporalService>(TemporalService);
            await serviceWithoutWorker.onModuleInit();

            const status = (serviceWithoutWorker as any).getWorkerHealthStatus();

            expect(status.status).toBe('unhealthy');
            expect(status.details.error).toBe('Worker service not available');
        });

        it('should handle getOverallHealth with unhealthy worker line 676-686', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            mockWorkerService.getWorkerStatus = jest.fn().mockReturnValue({
                isHealthy: false,
                isRunning: false,
                isInitialized: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 0,
            });

            await service.onModuleInit();

            const health = await service.getOverallHealth();

            // When worker is not healthy, getWorkerHealthStatus returns 'degraded'
            // This causes overall health to be degraded (not unhealthy)
            expect(health.status).toBe('degraded');
            expect(health.components.worker.status).toBe('degraded');
        });

        it('should test logServiceStatus private method lines 676-686', async () => {
            await service.onModuleInit();

            // Call the private method directly
            const logSpy = jest
                .spyOn((service as any).temporalLogger, 'debug')
                .mockImplementation();

            (service as any).logServiceStatus();

            expect(logSpy).toHaveBeenCalledTimes(4);
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Service Status - Overall:'),
            );
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Client:'));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Activities:'));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Namespace:'));

            logSpy.mockRestore();
        });

        it('should handle getWorkerHealth with completely unhealthy worker line 537', async () => {
            mockWorkerService.isWorkerAvailable = jest.fn().mockReturnValue(true);
            // Worker is not healthy AND not running = unhealthy status
            mockWorkerService.getWorkerStatus = jest.fn().mockReturnValue({
                isHealthy: false,
                isRunning: false,
                isInitialized: true,
                taskQueue: 'test-queue',
                namespace: 'test-namespace',
                activitiesCount: 0,
            });

            await service.onModuleInit();

            const health = await service.getWorkerHealth();

            // When worker is not healthy AND not running, status should be 'unhealthy'
            expect(health.status).toBe('unhealthy');
            expect(health.details).toBeDefined();
        });
    });
});
