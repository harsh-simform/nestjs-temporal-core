import { Test, TestingModule } from '@nestjs/testing';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalService } from '../../src/services/temporal.service';
import { DiscoveryStats, WorkerStatus } from '../../src/interfaces';

describe('TemporalService', () => {
    let service: TemporalService;
    let clientService: jest.Mocked<TemporalClientService>;
    let scheduleService: jest.Mocked<TemporalScheduleService>;
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

        const mockScheduleService = {
            createCronSchedule: jest.fn(),
            createIntervalSchedule: jest.fn(),
            triggerSchedule: jest.fn(),
            pauseSchedule: jest.fn(),
            resumeSchedule: jest.fn(),
            deleteSchedule: jest.fn(),
            getScheduleStats: jest.fn(),
        };

        const mockDiscoveryService = {
            getScheduledWorkflows: jest.fn(),
            getScheduleIds: jest.fn(),
            getScheduledWorkflow: jest.fn(),
            hasSchedule: jest.fn(),
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
                    provide: TemporalScheduleService,
                    useValue: mockScheduleService,
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
        scheduleService = module.get(TemporalScheduleService);
        discoveryService = module.get(TemporalDiscoveryService);

        workerManager = module.get(TemporalWorkerManagerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getClient', () => {
        it('should return client service', () => {
            const result = service.getClient();
            expect(result).toBe(clientService);
        });
    });

    describe('getScheduleService', () => {
        it('should return schedule service', () => {
            const result = service.getScheduleService();
            expect(result).toBe(scheduleService);
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
                        provide: TemporalScheduleService,
                        useValue: scheduleService,
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

            const serviceWithoutWorker = moduleWithoutWorker.get(TemporalService);
            const result = serviceWithoutWorker.getWorkerManager();
            expect(result).toBeUndefined();
        });
    });

    describe('startWorkflow', () => {
        it('should start workflow with enhanced options', async () => {
            const mockHandle: any = {
                result: jest.fn().mockResolvedValue('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
            };

            clientService.startWorkflow.mockResolvedValue({
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: mockHandle,
            });

            const result = await service.startWorkflow('test-workflow', ['arg1', 'arg2'], {
                taskQueue: 'test-queue',
            });

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'test-workflow',
                ['arg1', 'arg2'],
                { taskQueue: 'test-queue' },
            );
            expect(result.workflowId).toBe('test-workflow-id');
            expect(result.firstExecutionRunId).toBe('test-run-id');
        });

        it('should start workflow with default task queue if not provided', async () => {
            const mockHandle: any = {
                result: jest.fn().mockResolvedValue('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
            };

            clientService.startWorkflow.mockResolvedValue({
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: mockHandle,
            });

            const result = await service.startWorkflow('test-workflow', ['arg1', 'arg2'], {});

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'test-workflow',
                ['arg1', 'arg2'],
                { taskQueue: 'test-queue' },
            );
            expect(result.workflowId).toBe('test-workflow-id');
        });
    });

    describe('signalWorkflow', () => {
        it('should send signal to workflow', async () => {
            await service.signalWorkflow('test-workflow-id', 'test-signal', ['arg1']);

            expect(clientService.signalWorkflow).toHaveBeenCalledWith(
                'test-workflow-id',
                'test-signal',
                ['arg1'],
            );
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.signalWorkflow('', 'test-signal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });
    });

    describe('queryWorkflow', () => {
        it('should query workflow', async () => {
            clientService.queryWorkflow.mockResolvedValue('test-result');

            const result = await service.queryWorkflow('test-workflow-id', 'test-query', ['arg1']);

            expect(clientService.queryWorkflow).toHaveBeenCalledWith(
                'test-workflow-id',
                'test-query',
                ['arg1'],
            );
            expect(result).toBe('test-result');
        });

        it('should throw error for empty workflow ID', async () => {
            await expect(service.queryWorkflow('', 'test-query')).rejects.toThrow(
                'Workflow ID is required',
            );
        });
    });

    describe('hasWorker', () => {
        it('should return true when worker manager is available', () => {
            const result = service.hasWorker();
            expect(result).toBe(true);
        });

        it('should return false when worker manager is not available', () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined,
            );
            const result = serviceWithoutWorker.hasWorker();
            expect(result).toBe(false);
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
                activitiesCount: 1,
            };
            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = service.getWorkerStatus();
            expect(result).toBe(mockStatus);
        });

        it('should return null when worker manager not available', () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined,
            );
            const result = serviceWithoutWorker.getWorkerStatus();
            expect(result).toBeNull();
        });
    });

    describe('getDiscoveryStats', () => {
        it('should return discovery stats', () => {
            const mockStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            discoveryService.getStats.mockReturnValue(mockStats);

            const result = service.getDiscoveryStats();
            expect(result).toBe(mockStats);
        });
    });

    describe('getScheduleStats', () => {
        it('should return schedule stats', () => {
            const mockStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            scheduleService.getScheduleStats.mockReturnValue(mockStats);

            const result = service.getScheduleStats();
            expect(result).toBe(mockStats);
        });
    });

    describe('terminateWorkflow', () => {
        it('should terminate workflow', async () => {
            await service.terminateWorkflow('test-workflow-id', 'test reason');

            expect(clientService.terminateWorkflow).toHaveBeenCalledWith(
                'test-workflow-id',
                'test reason',
            );
        });

        it('should terminate workflow without reason', async () => {
            await service.terminateWorkflow('test-workflow-id');

            expect(clientService.terminateWorkflow).toHaveBeenCalledWith(
                'test-workflow-id',
                undefined,
            );
        });
    });

    describe('cancelWorkflow', () => {
        it('should cancel workflow', async () => {
            await service.cancelWorkflow('test-workflow-id');

            expect(clientService.cancelWorkflow).toHaveBeenCalledWith('test-workflow-id');
        });
    });

    describe('triggerSchedule', () => {
        it('should trigger schedule when it exists', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.triggerSchedule('test-schedule');

            expect(scheduleService.triggerSchedule).toHaveBeenCalledWith('test-schedule');
        });

        it('should throw error when schedule does not exist', async () => {
            discoveryService.hasSchedule.mockReturnValue(false);

            await expect(service.triggerSchedule('nonexistent-schedule')).rejects.toThrow(
                "Schedule 'nonexistent-schedule' not found",
            );
        });
    });

    describe('pauseSchedule', () => {
        it('should pause schedule when it exists', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.pauseSchedule('test-schedule', 'test note');

            expect(scheduleService.pauseSchedule).toHaveBeenCalledWith(
                'test-schedule',
                'test note',
            );
        });

        it('should pause schedule without note', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.pauseSchedule('test-schedule');

            expect(scheduleService.pauseSchedule).toHaveBeenCalledWith('test-schedule', undefined);
        });

        it('should throw error when schedule does not exist', async () => {
            discoveryService.hasSchedule.mockReturnValue(false);

            await expect(service.pauseSchedule('nonexistent-schedule')).rejects.toThrow(
                "Schedule 'nonexistent-schedule' not found",
            );
        });
    });

    describe('resumeSchedule', () => {
        it('should resume schedule when it exists', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.resumeSchedule('test-schedule', 'test note');

            expect(scheduleService.resumeSchedule).toHaveBeenCalledWith(
                'test-schedule',
                'test note',
            );
        });

        it('should resume schedule without note', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.resumeSchedule('test-schedule');

            expect(scheduleService.resumeSchedule).toHaveBeenCalledWith('test-schedule', undefined);
        });

        it('should throw error when schedule does not exist', async () => {
            discoveryService.hasSchedule.mockReturnValue(false);

            await expect(service.resumeSchedule('nonexistent-schedule')).rejects.toThrow(
                "Schedule 'nonexistent-schedule' not found",
            );
        });
    });

    describe('deleteSchedule', () => {
        it('should delete schedule when force is true', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.deleteSchedule('test-schedule', true);

            expect(scheduleService.deleteSchedule).toHaveBeenCalledWith('test-schedule');
        });

        it('should not delete schedule when force is false', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.deleteSchedule('test-schedule', false);

            expect(scheduleService.deleteSchedule).not.toHaveBeenCalled();
        });

        it('should not delete schedule when force is undefined', async () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            await service.deleteSchedule('test-schedule');

            expect(scheduleService.deleteSchedule).not.toHaveBeenCalled();
        });

        it('should throw error when schedule does not exist', async () => {
            discoveryService.hasSchedule.mockReturnValue(false);

            await expect(service.deleteSchedule('nonexistent-schedule', true)).rejects.toThrow(
                "Schedule 'nonexistent-schedule' not found",
            );
        });
    });

    describe('getScheduleIds', () => {
        it('should return schedule IDs', () => {
            const mockIds = ['schedule1', 'schedule2'];
            discoveryService.getScheduleIds.mockReturnValue(mockIds);

            const result = service.getScheduleIds();
            expect(result).toBe(mockIds);
        });
    });

    describe('getScheduleInfo', () => {
        it('should return schedule info', () => {
            const mockInfo: any = { scheduleId: 'test', workflowName: 'TestWorkflow' };
            discoveryService.getScheduledWorkflow.mockReturnValue(mockInfo);

            const result = service.getScheduleInfo('test-schedule');
            expect(result).toBe(mockInfo);
        });
    });

    describe('hasSchedule', () => {
        it('should return true when schedule exists', () => {
            discoveryService.hasSchedule.mockReturnValue(true);

            const result = service.hasSchedule('test-schedule');
            expect(result).toBe(true);
        });

        it('should return false when schedule does not exist', () => {
            discoveryService.hasSchedule.mockReturnValue(false);

            const result = service.hasSchedule('test-schedule');
            expect(result).toBe(false);
        });
    });

    describe('restartWorker', () => {
        it('should restart worker when available', async () => {
            await service.restartWorker();

            expect(workerManager.restartWorker).toHaveBeenCalled();
        });

        it('should throw error when worker manager not available', async () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined,
            );

            await expect(serviceWithoutWorker.restartWorker()).rejects.toThrow(
                'Worker manager not available',
            );
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
                activitiesCount: 1,
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
                activitiesCount: 1,
            };
            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('degraded');
            expect(result.details).toBe(mockStatus);
        });

        it('should return unhealthy status when worker is not running', async () => {
            const mockStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };
            workerManager.getWorkerStatus.mockReturnValue(mockStatus);

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
            expect(result.details).toBe(mockStatus);
        });

        it('should return not_available when worker manager not available', async () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined,
            );

            const result = await serviceWithoutWorker.getWorkerHealth();

            expect(result.status).toBe('not_available');
        });

        it('should return unhealthy when error occurs', async () => {
            const error = new Error('Worker health check failed');
            workerManager.getWorkerStatus.mockImplementation(() => {
                throw error;
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
            expect(result.details).toEqual({ error: 'Worker health check failed' });
        });
    });

    describe('getSystemStatus', () => {
        it('should return complete system status', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getSystemStatus();

            expect(result.client.available).toBe(true);
            expect(result.client.healthy).toBe(true);
            expect(result.worker.available).toBe(true);
            expect(result.worker.status).toBe(mockWorkerStatus);
            expect(result.worker.health).toBe('healthy');
            expect(result.discovery).toBe(mockDiscoveryStats);
            expect(result.schedules).toBe(mockScheduleStats);
        });

        it('should handle service without worker', async () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined,
            );

            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);

            const result = await serviceWithoutWorker.getSystemStatus();

            expect(result.worker.available).toBe(false);
            expect(result.worker.status).toBeUndefined();
        });
    });

    describe('getOverallHealth', () => {
        it('should return healthy when all components are healthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('healthy');
            expect(result.components.client.healthy).toBe(true);
            expect(result.components.worker.available).toBe(true);
        });

        it('should return unhealthy when client is unhealthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(false);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should return degraded when worker is unhealthy but available', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return degraded when no scheduled workflows found but controllers exist', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 2,
                scheduled: 0,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return degraded when schedule errors exist', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 1 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'bundle',
                activitiesCount: 1,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
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

    describe('getWorkflowInfo', () => {
        it('should return workflow info when found', () => {
            const mockWorkflows: any = [
                { workflowName: 'WorkflowA', scheduleId: 'schedule1' },
                { workflowName: 'WorkflowB', scheduleId: 'schedule2' },
            ];
            discoveryService.getScheduledWorkflows.mockReturnValue(mockWorkflows);

            const result = service.getWorkflowInfo('WorkflowA');
            expect(result).toBe(mockWorkflows[0]);
        });

        it('should return undefined when workflow not found', () => {
            const mockWorkflows: any = [{ workflowName: 'WorkflowA', scheduleId: 'schedule1' }];
            discoveryService.getScheduledWorkflows.mockReturnValue(mockWorkflows);

            const result = service.getWorkflowInfo('NonexistentWorkflow');
            expect(result).toBeUndefined();
        });
    });

    describe('hasWorkflow', () => {
        it('should return true when workflow exists', () => {
            discoveryService.hasWorkflow.mockReturnValue(true);

            const result = service.hasWorkflow('TestWorkflow');
            expect(result).toBe(true);
        });

        it('should return false when workflow does not exist', () => {
            discoveryService.hasWorkflow.mockReturnValue(false);

            const result = service.hasWorkflow('NonexistentWorkflow');
            expect(result).toBe(false);
        });
    });

    describe('validateWorkflowExists', () => {
        it('should throw error for empty workflow ID', async () => {
            await expect(service.signalWorkflow('', 'signal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should throw error for whitespace-only workflow ID', async () => {
            await expect(service.signalWorkflow('   ', 'signal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });
    });

    describe('enhanceWorkflowOptions', () => {
        it('should use provided task queue', async () => {
            const mockHandle: any = {
                result: jest.fn().mockResolvedValue('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
            };

            clientService.startWorkflow.mockResolvedValue({
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: mockHandle,
            });

            await service.startWorkflow('test-workflow', [], { taskQueue: 'custom-queue' });

            expect(clientService.startWorkflow).toHaveBeenCalledWith('test-workflow', [], {
                taskQueue: 'custom-queue',
            });
        });

        it('should use default task queue from options when not provided', async () => {
            const mockHandle: any = {
                result: jest.fn().mockResolvedValue('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
            };

            clientService.startWorkflow.mockResolvedValue({
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: mockHandle,
            });

            await service.startWorkflow('test-workflow', [], {});

            expect(clientService.startWorkflow).toHaveBeenCalledWith('test-workflow', [], {
                taskQueue: 'test-queue',
            });
        });

        it('should use default task queue when none provided', async () => {
            // Create service without task queue in options
            const optionsWithoutTaskQueue = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'default',
                },
            };

            const serviceWithoutTaskQueue = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                optionsWithoutTaskQueue,
                workerManager,
            );

            const mockHandle: any = {
                result: jest.fn().mockResolvedValue('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
            };

            clientService.startWorkflow.mockResolvedValue({
                result: Promise.resolve('test-result'),
                workflowId: 'test-workflow-id',
                firstExecutionRunId: 'test-run-id',
                handle: mockHandle,
            });

            await serviceWithoutTaskQueue.startWorkflow('test-workflow', [], {});

            expect(clientService.startWorkflow).toHaveBeenCalledWith('test-workflow', [], {
                taskQueue: 'default-task-queue',
            });
        });
    });

    describe('Schedule Operations', () => {
        it('should delete schedule when force is true', async () => {
            const scheduleId = 'test-schedule';
            jest.spyOn(service, 'hasSchedule').mockReturnValue(true);
            jest.spyOn(scheduleService, 'deleteSchedule').mockResolvedValue();

            await service.deleteSchedule(scheduleId, true);

            expect(scheduleService.deleteSchedule).toHaveBeenCalledWith(scheduleId);
        });

        it('should not delete schedule when force is false', async () => {
            const scheduleId = 'test-schedule';
            jest.spyOn(service, 'hasSchedule').mockReturnValue(true);

            await service.deleteSchedule(scheduleId, false);

            expect(scheduleService.deleteSchedule).not.toHaveBeenCalled();
        });

        it('should throw error when schedule does not exist for delete', async () => {
            const scheduleId = 'non-existent-schedule';
            jest.spyOn(service, 'hasSchedule').mockReturnValue(false);

            await expect(service.deleteSchedule(scheduleId, true)).rejects.toThrow(
                "Schedule 'non-existent-schedule' not found",
            );
        });
    });

    describe('System Status', () => {
        it('should return system status with worker available', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            jest.spyOn(service, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const status = await service.getSystemStatus();

            expect(status.worker.available).toBe(true);
            expect(status.worker.status?.isHealthy).toBe(true);
        });

        it('should return system status without worker', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const status = await service.getSystemStatus();

            expect(status.worker.available).toBe(false);
            expect(status.worker.status).toBeUndefined();
        });
    });

    describe('Overall Health', () => {
        it('should return healthy when all components are healthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('healthy');
            expect(result.components.client.healthy).toBe(true);
            expect(result.components.worker.available).toBe(true);
        });

        it('should return unhealthy when client is not healthy', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(false);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should return degraded when worker has issues', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return degraded when discovery has no scheduled workflows', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 0,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 0, active: 0, inactive: 0, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
            expect(result.components.discovery.status).toBe('inactive');
        });

        it('should return degraded status when schedules have errors', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 1 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(true);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return unhealthy status when multiple components have issues', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 5, active: 3, inactive: 2, errors: 0 };
            const mockWorkerStatus: WorkerStatus = {
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'test-queue',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            };

            clientService.getRawClient.mockReturnValue({} as any);
            clientService.isHealthy.mockReturnValue(false);
            discoveryService.getStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            workerManager.getWorkerStatus.mockReturnValue(mockWorkerStatus);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('unhealthy');
        });
    });

    describe('Workflow Operations', () => {
        it('should enhance workflow options with default task queue', async () => {
            const options = { workflowId: 'test-workflow' };
            const enhancedOptions = (service as any).enhanceWorkflowOptions(options);

            expect(enhancedOptions.taskQueue).toBe('test-queue'); // From mock options
            expect(enhancedOptions.workflowId).toBe('test-workflow');
        });

        it('should use provided task queue when available', async () => {
            const options = { taskQueue: 'custom-queue', workflowId: 'test-workflow' };
            const enhancedOptions = (service as any).enhanceWorkflowOptions(options);

            expect(enhancedOptions.taskQueue).toBe('custom-queue');
            expect(enhancedOptions.workflowId).toBe('test-workflow');
        });

        it('should validate workflow ID is required', async () => {
            await expect(service.signalWorkflow('', 'test-signal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should validate workflow ID is not empty string', async () => {
            await expect(service.signalWorkflow('   ', 'test-signal')).rejects.toThrow(
                'Workflow ID is required',
            );
        });
    });

    describe('Initialization Summary', () => {
        it('should log initialization summary', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 2,
                scheduled: 1,
                signals: 1,
                queries: 1,
                methods: 1,
                workflows: 1,
                childWorkflows: 1,
            };
            const mockScheduleStats = { total: 3, active: 2, inactive: 1, errors: 0 };
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            jest.spyOn(discoveryService, 'getStats').mockReturnValue(mockDiscoveryStats);
            jest.spyOn(scheduleService, 'getScheduleStats').mockReturnValue(mockScheduleStats);
            const logSpy = jest.spyOn(service['logger'], 'log');
            await (service as any).logInitializationSummary();
            expect(logSpy).toHaveBeenCalledWith('Temporal Service initialized successfully');
            expect(logSpy).toHaveBeenCalledWith('Discovery: 2 controllers, 1 scheduled workflows');
            expect(logSpy).toHaveBeenCalledWith('Schedules: 2 active, 0 errors');
            expect(logSpy).toHaveBeenCalledWith('Worker: available');
        });

        it('should log initialization summary without worker', async () => {
            const mockDiscoveryStats: DiscoveryStats = {
                controllers: 1,
                scheduled: 0,
                signals: 0,
                queries: 0,
                methods: 0,
                workflows: 0,
                childWorkflows: 0,
            };
            const mockScheduleStats = { total: 0, active: 0, inactive: 0, errors: 0 };
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);
            jest.spyOn(discoveryService, 'getStats').mockReturnValue(mockDiscoveryStats);
            jest.spyOn(scheduleService, 'getScheduleStats').mockReturnValue(mockScheduleStats);
            const logSpy = jest.spyOn(service['logger'], 'log');
            await (service as any).logInitializationSummary();
            expect(logSpy).toHaveBeenCalledWith('Temporal Service initialized successfully');
            expect(logSpy).toHaveBeenCalledWith('Worker: not available');
        });
    });

    describe('System Status Edge Cases', () => {
        it('should return system status with worker', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            jest.spyOn(service, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const result = await service.getSystemStatus();

            expect(result.worker.available).toBe(true);
            expect(result.worker.status).toBeDefined();
            expect(result.worker.health).toBe('healthy');
        });

        it('should return system status without worker', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const result = await service.getSystemStatus();

            expect(result.worker.available).toBe(false);
            expect(result.worker.status).toBeUndefined();
            expect(result.worker.health).toBeUndefined();
        });

        it('should return system status with unhealthy worker', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            jest.spyOn(service, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'test',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const result = await service.getSystemStatus();

            expect(result.worker.available).toBe(true);
            expect(result.worker.health).toBe('unhealthy');
        });
    });

    describe('Worker Health Edge Cases', () => {
        it('should return not_available when worker manager is not available', async () => {
            const serviceWithoutWorker = new TemporalService(
                clientService,
                scheduleService,
                discoveryService,
                mockOptions,
                undefined, // No worker manager
            );

            const result = await serviceWithoutWorker.getWorkerHealth();

            expect(result.status).toBe('not_available');
        });

        it('should return healthy when worker is healthy', async () => {
            jest.spyOn(workerManager, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'test',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('healthy');
        });

        it('should return degraded when worker is running but not healthy', async () => {
            jest.spyOn(workerManager, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: false,
                taskQueue: 'test',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('degraded');
        });

        it('should return unhealthy when worker is not running', async () => {
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            jest.spyOn(service, 'getWorkerStatus').mockReturnValue({
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'test',
                namespace: 'default',
                workflowSource: 'none',
                activitiesCount: 0,
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should handle worker health check errors', async () => {
            jest.spyOn(workerManager, 'getWorkerStatus').mockImplementation(() => {
                throw new Error('Worker status error');
            });

            const result = await service.getWorkerHealth();

            expect(result.status).toBe('unhealthy');
            expect(result.details).toEqual({ error: 'Worker status error' });
        });
    });

    describe('onModuleInit', () => {
        it('should call logInitializationSummary', async () => {
            const logSpy = jest.spyOn(service as any, 'logInitializationSummary').mockResolvedValue(undefined);

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
        });
    });

    describe('getOverallHealth additional branches', () => {
        it('should set status to degraded when discovery has 0 scheduled but controllers > 0', async () => {
            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);

            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 0,
                scheduled: 0,
                signals: 0,
                queries: 0,
                workflows: 0,
                childWorkflows: 0,
            });

            scheduleService.getScheduleStats.mockReturnValue({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });

            // Mock no worker available to avoid worker health checks
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should set status to degraded when schedule has errors > 0', async () => {
            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);

            discoveryService.getStats.mockReturnValue({
                controllers: 0,
                methods: 0,
                scheduled: 1, // Set scheduled > 0 to avoid discovery health issues
                signals: 0,
                queries: 0,
                workflows: 0,
                childWorkflows: 0,
            });

            scheduleService.getScheduleStats.mockReturnValue({
                total: 1,
                active: 1,
                inactive: 0,
                errors: 1,
            });

            // Mock no worker available to avoid worker health checks
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('degraded');
        });

        it('should set status to unhealthy when discovery has issues and schedule has errors', async () => {
            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);

            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 0,
                scheduled: 0,
                signals: 0,
                queries: 0,
                workflows: 0,
                childWorkflows: 0,
            });

            scheduleService.getScheduleStats.mockReturnValue({
                total: 1,
                active: 1,
                inactive: 0,
                errors: 1,
            });

            // Mock no worker available to avoid worker health checks
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const result = await service.getOverallHealth();

            expect(result.status).toBe('unhealthy');
        });

        it('should trigger line 380 - discovery health check with no scheduled but controllers', async () => {
            // Mock discovery stats with 0 scheduled workflows but controllers > 0
            discoveryService.getStats.mockReturnValue({
                scheduled: 0, // No scheduled workflows
                signals: 0,
                queries: 0,
                workflows: 0,
                childWorkflows: 0,
                controllers: 5, // But controllers exist
                methods: 10,
            });

            scheduleService.getScheduleStats.mockReturnValue({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });

            // Mock client as healthy
            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);
            
            // Mock no worker available to avoid worker health checks
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const result = await service.getOverallHealth();

            // This should trigger line 380: overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
            expect(result.status).toBe('degraded');
        });
    });
});
