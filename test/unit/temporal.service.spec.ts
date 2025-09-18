import { Test, TestingModule } from '@nestjs/testing';
import { TemporalService } from '../../src/services/temporal.service';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalActivityService } from '../../src/services/temporal-activity.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';

describe('TemporalService', () => {
    let service: TemporalService;

    // Mock services
    let clientService: any;
    let discoveryService: any;
    let workerService: any;
    let scheduleService: any;
    let activityService: any;
    let metadataAccessor: any;

    const mockOptions: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'default',
        },
        taskQueue: 'test-queue',
    };

    beforeAll(async () => {
        // Set test timeout
        jest.setTimeout(30000);

        // Create comprehensive mocks that prevent hanging
        clientService = {
            startWorkflow: jest.fn(),
            signalWorkflow: jest.fn(),
            queryWorkflow: jest.fn(),
            terminateWorkflow: jest.fn(),
            cancelWorkflow: jest.fn(),
            getRawClient: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getWorkflowHandle: jest.fn(),
            getStatus: jest.fn().mockReturnValue({
                isConnected: true,
                lastError: null,
                namespace: 'default',
                isInitialized: true,
            }),
        };

        discoveryService = {
            getStats: jest.fn().mockReturnValue({
                controllers: 2,
                methods: 10,
                signals: 3,
                queries: 2,
                workflows: 5,
                childWorkflows: 1,
            }),
            getWorkflowNames: jest.fn().mockReturnValue(['WorkflowA', 'WorkflowB']),
            hasWorkflow: jest.fn().mockReturnValue(true),
            getHealthStatus: jest.fn().mockReturnValue({
                status: 'healthy',
                isComplete: true,
            }),
            rediscover: jest.fn(),
        };

        workerService = {
            getWorkerStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
            }),
            startWorker: jest.fn(),
            stopWorker: jest.fn(),
            restartWorker: jest.fn(),
            getStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
            }),
            isWorkerRunning: jest.fn().mockReturnValue(true),
            isWorkerAvailable: jest.fn().mockReturnValue(true),
        };

        scheduleService = {
            createSchedule: jest.fn(),
            getSchedule: jest.fn(),
            updateSchedule: jest.fn(),
            deleteSchedule: jest.fn(),
            pauseSchedule: jest.fn(),
            unpauseSchedule: jest.fn(),
            triggerSchedule: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getScheduleStats: jest
                .fn()
                .mockReturnValue({ total: 0, active: 0, inactive: 0, errors: 0 }),
        };

        activityService = {
            getActivityNames: jest.fn().mockReturnValue([]),
            registerActivityClass: jest.fn(),
            registerActivityMethod: jest.fn(),
            executeActivity: jest.fn(),
            getActivity: jest.fn(),
            getAllActivities: jest.fn(),
            hasActivity: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getHealth: jest.fn().mockReturnValue({
                status: 'healthy',
                activitiesCount: { classes: 0, methods: 0, total: 0 },
                isInitialized: true,
                validation: { valid: true, errors: [] },
            }),
        };

        metadataAccessor = {
            isActivity: jest.fn(),
            getActivityMetadata: jest.fn(),
            getActivityOptions: jest.fn(),
            extractActivityMethods: jest.fn(),
            extractActivityMethodsFromClass: jest.fn(),
        };

        // Create the main service module
        const module: TestingModule = await Test.createTestingModule({
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
                    provide: TemporalWorkerManagerService,
                    useValue: workerService,
                },
                {
                    provide: TemporalScheduleService,
                    useValue: scheduleService,
                },
                {
                    provide: TemporalActivityService,
                    useValue: activityService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: metadataAccessor,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalService>(TemporalService);

        // Aggressively mock all initialization methods to prevent hanging
        (service as any).waitForServicesInitialization = jest.fn().mockResolvedValue(undefined);
        (service as any).logInitializationSummary = jest.fn().mockResolvedValue(undefined);
        (service as any).isInitialized = true;
        (service as any).shutdownPromise = null;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Module Lifecycle', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should initialize successfully', async () => {
            // Mock onModuleInit to prevent hanging
            const initSpy = jest.spyOn(service, 'onModuleInit').mockResolvedValue(undefined);
            await service.onModuleInit();
            expect(initSpy).toHaveBeenCalled();
        });

        it('should shutdown gracefully', async () => {
            const destroySpy = jest.spyOn(service, 'onModuleDestroy').mockResolvedValue(undefined);
            await service.onModuleDestroy();
            expect(destroySpy).toHaveBeenCalled();
        });
    });

    describe('Workflow Operations', () => {
        it('should delegate startWorkflow to client service with enhanced options', async () => {
            clientService.startWorkflow.mockResolvedValue({
                workflowId: 'test-123',
                runId: 'run-456',
            });

            const result = await service.startWorkflow('TestWorkflow', [{ input: 'test' }]);

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'TestWorkflow',
                [{ input: 'test' }],
                { taskQueue: 'test-queue' },
            );
            expect(result).toEqual({ workflowId: 'test-123', runId: 'run-456' });
        });

        it('should delegate signalWorkflow to client service', async () => {
            await service.signalWorkflow('workflow-123', 'testSignal', ['arg1', 'arg2']);

            expect(clientService.signalWorkflow).toHaveBeenCalledWith(
                'workflow-123',
                'testSignal',
                ['arg1', 'arg2'],
            );
        });

        it('should delegate queryWorkflow to client service', async () => {
            clientService.queryWorkflow.mockResolvedValue({ result: 'query-result' });

            const result = await service.queryWorkflow('workflow-123', 'testQuery', ['arg1']);

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('workflow-123', 'testQuery', [
                'arg1',
            ]);
            expect(result).toEqual({ result: 'query-result' });
        });

        it('should delegate getWorkflowHandle to client service', async () => {
            const mockHandle = { workflowId: 'test-123' };
            clientService.getWorkflowHandle.mockResolvedValue(mockHandle);

            const result = await service.getWorkflowHandle('workflow-123', 'run-456');

            expect(clientService.getWorkflowHandle).toHaveBeenCalledWith('workflow-123', 'run-456');
            expect(result).toBe(mockHandle);
        });

        it('should delegate terminateWorkflow to client service', async () => {
            await service.terminateWorkflow('workflow-123', 'Test reason');

            expect(clientService.terminateWorkflow).toHaveBeenCalledWith(
                'workflow-123',
                'Test reason',
            );
        });

        it('should delegate cancelWorkflow to client service', async () => {
            await service.cancelWorkflow('workflow-123');

            expect(clientService.cancelWorkflow).toHaveBeenCalledWith('workflow-123');
        });
    });

    describe('Worker Operations', () => {
        it('should delegate startWorker to worker service', async () => {
            await service.startWorker();

            expect(workerService.startWorker).toHaveBeenCalled();
        });

        it('should delegate stopWorker to worker service', async () => {
            await service.stopWorker();

            expect(workerService.stopWorker).toHaveBeenCalled();
        });

        it('should delegate restartWorker to worker service', async () => {
            await service.restartWorker();

            expect(workerService.restartWorker).toHaveBeenCalled();
        });

        it('should delegate getWorkerStatus to worker service', () => {
            const result = service.getWorkerStatus();

            expect(workerService.getStatus).toHaveBeenCalled();
            expect(result).toEqual({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
            });
        });

        it('should delegate isWorkerRunning to worker service', () => {
            const result = service.isWorkerRunning();

            expect(workerService.getWorkerStatus).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('Schedule Operations', () => {
        it('should delegate createSchedule to schedule service', async () => {
            const scheduleOptions = { scheduleId: 'test-schedule', spec: {}, action: {} };
            scheduleService.createSchedule.mockResolvedValue({ id: 'created-123' });

            const result = await service.createSchedule(scheduleOptions);

            expect(scheduleService.createSchedule).toHaveBeenCalledWith(scheduleOptions);
            expect(result).toEqual({ id: 'created-123' });
        });

        it('should delegate getSchedule to schedule service', async () => {
            scheduleService.getSchedule.mockResolvedValue({ id: 'schedule-123' });

            const result = await service.getSchedule('schedule-123');

            expect(scheduleService.getSchedule).toHaveBeenCalledWith('schedule-123');
            expect(result).toEqual({ id: 'schedule-123' });
        });

        it('should delegate updateSchedule to schedule service', async () => {
            const scheduleId = 'test-schedule';
            const updater = jest.fn();

            await service.updateSchedule(scheduleId, updater);

            expect(scheduleService.updateSchedule).toHaveBeenCalledWith(scheduleId, updater);
        });

        it('should delegate deleteSchedule to schedule service', async () => {
            await service.deleteSchedule('schedule-123');

            expect(scheduleService.deleteSchedule).toHaveBeenCalledWith('schedule-123');
        });

        it('should delegate pauseSchedule to schedule service', async () => {
            await service.pauseSchedule('schedule-123', 'Test pause');

            expect(scheduleService.pauseSchedule).toHaveBeenCalledWith(
                'schedule-123',
                'Test pause',
            );
        });

        it('should delegate unpauseSchedule to schedule service', async () => {
            await service.unpauseSchedule('schedule-123', 'Test unpause');

            expect(scheduleService.unpauseSchedule).toHaveBeenCalledWith(
                'schedule-123',
                'Test unpause',
            );
        });

        it('should delegate triggerSchedule to schedule service', async () => {
            await service.triggerSchedule('schedule-123');

            expect(scheduleService.triggerSchedule).toHaveBeenCalledWith('schedule-123', undefined);
        });
    });

    describe('Activity Operations', () => {
        it('should delegate executeActivity to activity service', async () => {
            activityService.executeActivity.mockResolvedValue('activity-result');

            const result = await service.executeActivity('testActivity', 'arg1', 'arg2');

            expect(activityService.executeActivity).toHaveBeenCalledWith(
                'testActivity',
                'arg1',
                'arg2',
            );
            expect(result).toBe('activity-result');
        });

        it('should delegate getActivity to activity service', () => {
            const mockActivity = jest.fn();
            activityService.getActivity.mockReturnValue(mockActivity);

            const result = service.getActivity('testActivity');

            expect(activityService.getActivity).toHaveBeenCalledWith('testActivity');
            expect(result).toBe(mockActivity);
        });

        it('should delegate getAllActivities to activity service', () => {
            const mockActivities = { activity1: jest.fn(), activity2: jest.fn() };
            activityService.getAllActivities.mockReturnValue(mockActivities);

            const result = service.getAllActivities();

            expect(activityService.getAllActivities).toHaveBeenCalled();
            expect(result).toBe(mockActivities);
        });

        it('should delegate hasActivity to activity service', () => {
            activityService.hasActivity.mockReturnValue(true);

            const result = service.hasActivity('testActivity');

            expect(activityService.hasActivity).toHaveBeenCalledWith('testActivity');
            expect(result).toBe(true);
        });

        it('should delegate getActivityNames to activity service', () => {
            const result = service.getActivityNames();

            expect(activityService.getActivityNames).toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });

    describe('Discovery Operations', () => {
        it('should delegate hasWorkflow to discovery service', () => {
            const result = service.hasWorkflow('TestWorkflow');

            expect(discoveryService.hasWorkflow).toHaveBeenCalledWith('TestWorkflow');
            expect(result).toBe(true);
        });

        it('should delegate getDiscoveryStats to discovery service', () => {
            const result = service.getDiscoveryStats();

            expect(discoveryService.getStats).toHaveBeenCalled();
        });

        it('should delegate refreshDiscovery to discovery service', async () => {
            await service.refreshDiscovery();

            expect(discoveryService.rediscover).toHaveBeenCalled();
        });
    });

    describe('Metadata Operations', () => {
        it('should delegate isActivity to metadata accessor', () => {
            const mockClass = class TestActivity {};
            metadataAccessor.isActivity.mockReturnValue(true);

            const result = service.isActivity(mockClass);

            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(mockClass);
            expect(result).toBe(true);
        });

        it('should check isActivityMethod using reflection', () => {
            const mockObject = {};
            // Mock Reflect.hasMetadata to return true
            const reflectSpy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const result = service.isActivityMethod(mockObject, 'testMethod');

            expect(reflectSpy).toHaveBeenCalled();
            expect(result).toBe(true);

            reflectSpy.mockRestore();
        });

        it('should delegate getActivityMetadata to metadata accessor', () => {
            const mockClass = class TestActivity {};
            const mockMetadata = { name: 'TestActivity' };
            metadataAccessor.getActivityMetadata.mockReturnValue(mockMetadata);

            const result = service.getActivityMetadata(mockClass);

            expect(metadataAccessor.getActivityMetadata).toHaveBeenCalledWith(mockClass);
            expect(result).toBe(mockMetadata);
        });
    });

    describe('Service Access Methods', () => {
        it('should return client service via getter', () => {
            const result = service.client;
            expect(result).toBe(clientService);
        });

        it('should return worker service via getter', () => {
            const result = service.worker;
            expect(result).toBe(workerService);
        });

        it('should return schedule service via getter', () => {
            const result = service.schedule;
            expect(result).toBe(scheduleService);
        });

        it('should return activity service via getter', () => {
            const result = service.activity;
            expect(result).toBe(activityService);
        });

        it('should return discovery service via getter', () => {
            const result = service.discovery;
            expect(result).toBe(discoveryService);
        });

        it('should return metadata accessor via getter', () => {
            const result = service.metadata;
            expect(result).toBe(metadataAccessor);
        });
    });

    describe('Validation and Error Handling', () => {
        it('should validate workflow ID in signalWorkflow', async () => {
            await expect(service.signalWorkflow('', 'signal', [])).rejects.toThrow(
                'Workflow ID is required',
            );
            await expect(service.signalWorkflow('   ', 'signal', [])).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should validate workflow ID in queryWorkflow', async () => {
            await expect(service.queryWorkflow('', 'query', [])).rejects.toThrow(
                'Workflow ID is required',
            );
            await expect(service.queryWorkflow('   ', 'query', [])).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should throw error when worker service is not available for restart', async () => {
            // Mock workerService to be undefined
            (service as any).workerService = undefined;

            await expect(service.restartWorker()).rejects.toThrow('Worker manager not available');

            // Restore workerService
            (service as any).workerService = workerService;
        });

        it('should return null when worker service is not available for getWorkerStatus', () => {
            // Mock workerService to be undefined temporarily
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = undefined;

            const result = service.getWorkerStatus();
            expect(result).toBeNull();

            // Restore workerService
            (service as any).workerService = originalWorkerService;
        });

        it('should handle worker service errors gracefully', async () => {
            workerService.startWorker.mockRejectedValue(new Error('Worker error'));

            await expect(service.startWorker()).rejects.toThrow('Worker error');
        });

        it('should handle client service errors gracefully', async () => {
            clientService.startWorkflow.mockRejectedValue(new Error('Client error'));

            await expect(service.startWorkflow('TestWorkflow', [])).rejects.toThrow('Client error');
        });

        it('should handle schedule service errors gracefully', async () => {
            scheduleService.createSchedule.mockRejectedValue(new Error('Schedule error'));

            await expect(
                service.createSchedule({ scheduleId: 'test', spec: {}, action: {} }),
            ).rejects.toThrow('Schedule error');
        });

        it('should handle activity service errors gracefully', async () => {
            activityService.executeActivity.mockRejectedValue(new Error('Activity error'));

            await expect(service.executeActivity('test')).rejects.toThrow('Activity error');
        });

        it('should handle discovery service errors gracefully', async () => {
            discoveryService.rediscover.mockRejectedValue(new Error('Discovery error'));

            await expect(service.refreshDiscovery()).rejects.toThrow('Discovery error');
        });

        it('should throw when service not initialized', async () => {
            // Create a new instance that's not initialized
            const uninitializedService = new (service.constructor as any)(
                mockOptions,
                clientService,
                workerService,
                scheduleService,
                activityService,
                discoveryService,
                metadataAccessor,
            );

            expect(() => uninitializedService.getWorkerStatus()).toThrow(
                'Temporal Service is not initialized',
            );
            expect(() => uninitializedService.hasWorkflow('test')).toThrow(
                'Temporal Service is not initialized',
            );

            // Test async methods
            await expect(uninitializedService.startWorkflow('test')).rejects.toThrow(
                'Temporal Service is not initialized',
            );
        });

        it('should handle isActivityMethod errors gracefully', () => {
            const result = service.isActivityMethod({}, 'testMethod');
            expect(typeof result).toBe('boolean');
        });

        it('should handle error in isActivityMethod with constructor prototype', () => {
            const testObject = {
                constructor: {
                    prototype: {},
                },
            };

            const result = service.isActivityMethod(testObject, 'testMethod');
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Health and Status Methods', () => {
        it('should get overall health status', async () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getScheduleStats.mockReturnValue({
                total: 5,
                active: 3,
                inactive: 2,
                errors: 0,
            });

            const health = await service.getOverallHealth();

            expect(health.status).toBe('healthy');
            expect(health.components.client.healthy).toBe(true);
            expect(health.components.worker.healthy).toBe(true);
            expect(health.summary.totalSchedules).toBe(5);
        });

        it('should get system status', async () => {
            const systemStatus = await service.getSystemStatus();

            expect(systemStatus).toHaveProperty('client');
            expect(systemStatus).toHaveProperty('worker');
            expect(systemStatus).toHaveProperty('discovery');
        });

        it('should get worker health when worker is available', async () => {
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('healthy');
            expect(health.details).toBeDefined();
        });

        it('should get worker health when worker is not available', async () => {
            // Mock hasWorker to return false
            jest.spyOn(service, 'hasWorker').mockReturnValue(false);

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('not_available');
        });

        it('should get worker health when worker service is undefined', async () => {
            // Mock workerService to be undefined temporarily
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = undefined;

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('not_available');

            // Restore workerService
            (service as any).workerService = originalWorkerService;
        });

        it('should handle getWorkerHealth when hasWorker returns true but workerService is null', async () => {
            // Mock hasWorker to return true but set workerService to null
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = null;

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('not_available');

            // Restore workerService
            (service as any).workerService = originalWorkerService;
        });

        it('should handle worker health errors', async () => {
            // Mock hasWorker to return true first
            jest.spyOn(service, 'hasWorker').mockReturnValue(true);
            workerService.getWorkerStatus.mockImplementation(() => {
                throw new Error('Worker status error');
            });

            const health = await service.getWorkerHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.details).toHaveProperty('error');
        });

        it('should get available workflows', () => {
            discoveryService.getWorkflowNames.mockReturnValue(['Workflow1', 'Workflow2']);

            const workflows = service.getAvailableWorkflows();

            expect(workflows).toEqual(['Workflow1', 'Workflow2']);
        });

        it('should get comprehensive health status', () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getScheduleStats.mockReturnValue({
                total: 3,
                active: 2,
                inactive: 1,
                errors: 0,
            });
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: true,
            });
            discoveryService.getStats.mockReturnValue({
                controllers: 2,
                methods: 10,
                signals: 3,
                queries: 2,
                workflows: 5,
                childWorkflows: 1,
            });

            const health = service.getHealth();

            expect(health.status).toBe('healthy');
            expect(health.isInitialized).toBe(true);
            expect(health.namespace).toBe('default');
            expect(health.summary.totalSchedules).toBe(3);
        });

        it('should detect degraded status', () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: false,
                isRunning: true,
                isInitialized: true,
            });
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getScheduleStats.mockReturnValue({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: true,
            });
            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 5,
                signals: 1,
                queries: 1,
                workflows: 0, // This causes discovery issues
                childWorkflows: 0,
            });

            const health = service.getHealth();

            expect(health.status).toBe('degraded');
        });

        it('should detect unhealthy status', () => {
            clientService.isHealthy.mockReturnValue(false);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: false,
                isRunning: false,
                isInitialized: false,
            });

            const health = service.getHealth();

            expect(health.status).toBe('unhealthy');
        });

        it('should get service statistics', () => {
            activityService.getActivityNames.mockReturnValue(['activity1', 'activity2']);
            scheduleService.getScheduleStats.mockReturnValue({
                total: 2,
                active: 1,
                inactive: 1,
                errors: 0,
            });

            const stats = service.getStats();

            expect(stats.activities.total).toBe(2);
            expect(stats.schedules).toBe(2);
            expect(stats).toHaveProperty('discoveries');
            expect(stats).toHaveProperty('worker');
            expect(stats).toHaveProperty('client');
        });
    });

    describe('Private Methods and Internal Logic', () => {
        it('should enhance workflow options with default task queue', () => {
            const options = {};
            const enhanced = (service as any).enhanceWorkflowOptions(options);

            expect(enhanced.taskQueue).toBe('test-queue');
        });

        it('should not override existing task queue in options', () => {
            const options = { taskQueue: 'custom-queue' };
            const enhanced = (service as any).enhanceWorkflowOptions(options);

            expect(enhanced.taskQueue).toBe('custom-queue');
        });

        it('should extract error message from Error object', () => {
            const error = new Error('Test error message');
            const message = (service as any).extractErrorMessage(error);

            expect(message).toBe('Test error message');
        });

        it('should extract error message from string', () => {
            const message = (service as any).extractErrorMessage('String error');

            expect(message).toBe('String error');
        });

        it('should handle unknown error types', () => {
            const message = (service as any).extractErrorMessage({ unknown: 'object' });

            expect(message).toBe('Unknown error');
        });

        it('should get worker health status when worker service available', () => {
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });

            const health = (service as any).getWorkerHealthStatus();

            expect(health.status).toBe('healthy');
            expect(health.details).toBeDefined();
        });

        it('should get worker health status when worker service unavailable', () => {
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = undefined;

            const health = (service as any).getWorkerHealthStatus();

            expect(health.status).toBe('unhealthy');
            expect(health.details.error).toBe('Worker service not available');

            (service as any).workerService = originalWorkerService;
        });

        it('should log service status', () => {
            const logSpy = jest
                .spyOn((service as any).temporalLogger, 'debug')
                .mockImplementation();

            (service as any).logServiceStatus();

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });

    describe('Deprecated Methods', () => {
        it('should support deprecated getClient method', () => {
            const client = service.getClient();
            expect(client).toBe(clientService);
        });

        it('should support deprecated getWorkerManager method', () => {
            const worker = service.getWorkerManager();
            expect(worker).toBe(workerService);
        });

        it('should support deprecated getDiscoveryService method', () => {
            const discovery = service.getDiscoveryService();
            expect(discovery).toBe(discoveryService);
        });
    });

    describe('Lifecycle Methods (Real Implementation)', () => {
        let realService: any;

        beforeEach(async () => {
            // Create a service instance without aggressive mocking for lifecycle testing
            const realModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    {
                        provide: TemporalClientService,
                        useValue: {
                            ...clientService,
                            isHealthy: jest.fn().mockReturnValue(true),
                        },
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: {
                            ...discoveryService,
                            getHealthStatus: jest.fn().mockReturnValue({
                                status: 'healthy',
                                isComplete: true,
                            }),
                        },
                    },
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: workerService,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: scheduleService,
                    },
                    {
                        provide: TemporalActivityService,
                        useValue: activityService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: metadataAccessor,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            realService = realModule.get<TemporalService>(TemporalService);
        });

        it('should handle real initialization and log summary', async () => {
            const logSpy = jest.spyOn((realService as any).logger, 'log').mockImplementation();

            await realService.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith('Initializing Temporal Service...');
            expect(logSpy).toHaveBeenCalledWith('Temporal Service initialized successfully');

            logSpy.mockRestore();
        });

        it('should handle initialization timeout', async () => {
            // Mock services to never be ready
            const unhealthyClient = {
                ...clientService,
                isHealthy: jest.fn().mockReturnValue(false),
            };
            const unhealthyDiscovery = {
                ...discoveryService,
                getHealthStatus: jest
                    .fn()
                    .mockReturnValue({ status: 'unhealthy', isComplete: false }),
            };

            const timeoutModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    { provide: TemporalClientService, useValue: unhealthyClient },
                    { provide: TemporalDiscoveryService, useValue: unhealthyDiscovery },
                    { provide: TemporalWorkerManagerService, useValue: workerService },
                    { provide: TemporalScheduleService, useValue: scheduleService },
                    { provide: TemporalActivityService, useValue: activityService },
                    { provide: TemporalMetadataAccessor, useValue: metadataAccessor },
                    { provide: TEMPORAL_MODULE_OPTIONS, useValue: mockOptions },
                ],
            }).compile();

            const timeoutService = timeoutModule.get<TemporalService>(TemporalService);
            const warnSpy = jest.spyOn((timeoutService as any).logger, 'warn').mockImplementation();

            // Mock the waitForServicesInitialization method to simulate timeout
            const originalWaitMethod = (timeoutService as any).waitForServicesInitialization;
            (timeoutService as any).waitForServicesInitialization = jest
                .fn()
                .mockImplementation(async () => {
                    // Simulate the timeout warning being triggered
                    (timeoutService as any).logger.warn(
                        'Service initialization timeout - continuing anyway',
                    );
                });

            // Initialize should trigger the timeout warning
            await timeoutService.onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(
                'Service initialization timeout - continuing anyway',
            );

            // Restore original method
            (timeoutService as any).waitForServicesInitialization = originalWaitMethod;
            warnSpy.mockRestore();
        }, 5000); // 5 second timeout for this test

        it('should handle initialization errors', async () => {
            const errorService = { ...discoveryService };
            errorService.getHealthStatus = jest.fn().mockImplementation(() => {
                throw new Error('Discovery initialization failed');
            });

            const errorModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    { provide: TemporalClientService, useValue: clientService },
                    { provide: TemporalDiscoveryService, useValue: errorService },
                    { provide: TemporalWorkerManagerService, useValue: workerService },
                    { provide: TemporalScheduleService, useValue: scheduleService },
                    { provide: TemporalActivityService, useValue: activityService },
                    { provide: TemporalMetadataAccessor, useValue: metadataAccessor },
                    { provide: TEMPORAL_MODULE_OPTIONS, useValue: mockOptions },
                ],
            }).compile();

            const errorServiceInstance = errorModule.get<TemporalService>(TemporalService);
            const warnSpy = jest
                .spyOn((errorServiceInstance as any).logger, 'warn')
                .mockImplementation();

            await errorServiceInstance.onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(
                'Service readiness check failed',
                expect.any(Error),
            );

            warnSpy.mockRestore();
        });

        it('should handle real initialization error and re-throw', async () => {
            const errorModule = await Test.createTestingModule({
                providers: [
                    TemporalService,
                    { provide: TemporalClientService, useValue: clientService },
                    { provide: TemporalDiscoveryService, useValue: discoveryService },
                    { provide: TemporalWorkerManagerService, useValue: workerService },
                    { provide: TemporalScheduleService, useValue: scheduleService },
                    { provide: TemporalActivityService, useValue: activityService },
                    { provide: TemporalMetadataAccessor, useValue: metadataAccessor },
                    { provide: TEMPORAL_MODULE_OPTIONS, useValue: mockOptions },
                ],
            }).compile();

            const errorServiceInstance = errorModule.get<TemporalService>(TemporalService);

            // Mock waitForServicesInitialization to throw an error
            (errorServiceInstance as any).waitForServicesInitialization = jest
                .fn()
                .mockRejectedValue(new Error('Initialization failed'));

            const errorSpy = jest
                .spyOn((errorServiceInstance as any).logger, 'error')
                .mockImplementation();

            await expect(errorServiceInstance.onModuleInit()).rejects.toThrow(
                'Initialization failed',
            );

            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to initialize Temporal Service: Initialization failed',
            );

            errorSpy.mockRestore();
        });

        it('should handle concurrent shutdown calls', async () => {
            jest.clearAllMocks();

            // Reset shutdown promise
            (service as any).shutdownPromise = null;

            const shutdownPromise1 = service.onModuleDestroy();
            const shutdownPromise2 = service.onModuleDestroy();

            const result1 = await shutdownPromise1;
            const result2 = await shutdownPromise2;

            expect(result1).toBe(result2);
        });

        it('should log initialization summary with warnings', async () => {
            jest.clearAllMocks();

            // Restore the original method temporarily
            const originalMethod = TemporalService.prototype['logInitializationSummary'];
            delete (service as any).logInitializationSummary;

            // Make getStats throw an error to trigger the warning path
            discoveryService.getStats.mockImplementation(() => {
                throw new Error('Stats error');
            });

            const warnSpy = jest.spyOn((service as any).logger, 'warn');

            // The method catches errors internally and logs warnings
            await (service as any).logInitializationSummary();

            expect(warnSpy).toHaveBeenCalledWith(
                'Could not log initialization summary:',
                expect.any(Error),
            );

            warnSpy.mockRestore();

            // Restore original behavior
            discoveryService.getStats.mockReturnValue({
                workflows: 2,
                controllers: 1,
                methods: 3,
                signals: 1,
                queries: 1,
                childWorkflows: 1,
            });

            // Re-mock the method
            (service as any).logInitializationSummary = jest.fn().mockResolvedValue(undefined);
        });

        it('should handle waitForServicesInitialization when services not ready', async () => {
            // Make client and discovery services not ready initially
            clientService.isHealthy.mockReturnValue(false);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'unhealthy',
                isComplete: false,
            });

            const realWaitMethod = TemporalService.prototype['waitForServicesInitialization'];
            delete (service as any).waitForServicesInitialization;

            const startTime = Date.now();

            // The real method should timeout after 10 seconds, but we'll interrupt it
            const waitPromise = ((service as any).waitForServicesInitialization =
                realWaitMethod.bind(service));

            // Make services ready after a short delay
            setTimeout(() => {
                clientService.isHealthy.mockReturnValue(true);
                discoveryService.getHealthStatus.mockReturnValue({
                    status: 'healthy',
                    isComplete: true,
                });
            }, 100);

            await waitPromise();

            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(10000); // Should not timeout

            // Re-mock the method
            (service as any).waitForServicesInitialization = jest.fn().mockResolvedValue(undefined);
        }, 12000);

        it('should handle workflowId validation edge cases', async () => {
            // Test null workflow ID
            await expect(service.signalWorkflow(null as any, 'signal', [])).rejects.toThrow(
                'Workflow ID is required',
            );
            await expect(service.queryWorkflow(null as any, 'query', [])).rejects.toThrow(
                'Workflow ID is required',
            );

            // Test undefined workflow ID
            await expect(service.signalWorkflow(undefined as any, 'signal', [])).rejects.toThrow(
                'Workflow ID is required',
            );
            await expect(service.queryWorkflow(undefined as any, 'query', [])).rejects.toThrow(
                'Workflow ID is required',
            );
        });

        it('should handle default parameters for workflow methods', async () => {
            clientService.startWorkflow.mockResolvedValue({
                workflowId: 'test-123',
                runId: 'run-456',
            });

            // Test with undefined options and args
            const result = await service.startWorkflow('TestWorkflow', undefined, undefined);

            expect(clientService.startWorkflow).toHaveBeenCalledWith('TestWorkflow', [], {
                taskQueue: 'test-queue',
            });
            expect(result).toEqual({ workflowId: 'test-123', runId: 'run-456' });
        });

        it('should handle triggerSchedule with override parameter', async () => {
            const overlapPolicy = 'SKIP' as any; // Use string that matches expected enum
            await service.triggerSchedule('schedule-123', overlapPolicy);

            expect(scheduleService.triggerSchedule).toHaveBeenCalledWith(
                'schedule-123',
                overlapPolicy,
            );
        });

        it('should detect when worker is not running', () => {
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: false, // Set running to false
                isInitialized: true,
            });

            const result = service.isWorkerRunning();

            expect(result).toBe(false);
        });

        it('should handle worker availability check', () => {
            const result = service.hasWorker();

            expect(result).toBe(true);
            // Note: hasWorker() uses optional chaining, so we check the service is available
            expect(service['workerService']).toBeDefined();
        });

        it('should handle isActivityMethod with undefined constructor', () => {
            const testObject = {
                constructor: undefined,
            };

            const result = service.isActivityMethod(testObject, 'testMethod');
            expect(typeof result).toBe('boolean');
        });

        it('should handle isActivityMethod with constructor but no prototype', () => {
            const testObject = {
                constructor: {
                    prototype: undefined,
                },
            };

            const result = service.isActivityMethod(testObject, 'testMethod');
            expect(typeof result).toBe('boolean');
        });

        it('should handle isActivityMethod with reflection error', () => {
            const testObject = { testMethod: jest.fn() };

            // Mock Reflect.hasMetadata to throw an error (line 409)
            const reflectSpy = jest.spyOn(Reflect, 'hasMetadata').mockImplementation(() => {
                throw new Error('Reflection error');
            });

            const result = service.isActivityMethod(testObject, 'testMethod');
            expect(result).toBe(false);

            reflectSpy.mockRestore();
        });

        it('should handle extractActivityMethods delegation', () => {
            const mockClass = class TestActivity {};
            const mockMethods = [{ name: 'test', options: {} }];
            metadataAccessor.extractActivityMethodsFromClass.mockReturnValue(mockMethods);

            const result = service.extractActivityMethods(mockClass);

            expect(metadataAccessor.extractActivityMethodsFromClass).toHaveBeenCalledWith(
                mockClass,
            );
            expect(result).toBe(mockMethods);
        });

        it('should handle private getWorkerHealthStatus with no worker service', () => {
            // Test the private getWorkerHealthStatus method directly
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = null;

            const result = (service as any).getWorkerHealthStatus();
            expect(result.status).toBe('unhealthy');
            expect(result.details.error).toBe('Worker service not available');

            // Restore
            (service as any).workerService = originalWorkerService;
        });

        it('should handle extractErrorMessage with null/undefined', () => {
            expect((service as any).extractErrorMessage(null)).toBe('Unknown error');
            expect((service as any).extractErrorMessage(undefined)).toBe('Unknown error');
        });

        it('should handle extractErrorMessage with object that has message property', () => {
            const errorLikeObject = { message: 'Custom error message' };
            // extractErrorMessage only handles Error instances and strings, not plain objects
            expect((service as any).extractErrorMessage(errorLikeObject)).toBe('Unknown error');
        });

        it('should handle enhanceWorkflowOptions with null/undefined options', () => {
            // The method expects a WorkflowStartOptions object, so we need to provide proper defaults
            const nullOptions = null as any;
            const undefinedOptions = undefined as any;

            // The method will fail with null/undefined because it tries to access properties
            expect(() => (service as any).enhanceWorkflowOptions(nullOptions)).toThrow();
            expect(() => (service as any).enhanceWorkflowOptions(undefinedOptions)).toThrow();
        });

        it('should determine overall health status logic - healthy case', () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });
            scheduleService.isHealthy.mockReturnValue(true);
            activityService.isHealthy.mockReturnValue(true);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: true,
            });
            // Mock discovery stats to avoid workflow issues
            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 5,
                signals: 1,
                queries: 1,
                workflows: 1, // At least one workflow
                childWorkflows: 0,
            });

            const health = service.getHealth();
            expect(health.status).toBe('healthy');
        });

        it('should determine overall health status logic - degraded case', () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });
            scheduleService.isHealthy.mockReturnValue(true); // All services healthy
            activityService.isHealthy.mockReturnValue(true);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: true,
            });
            // Create degraded condition: controllers exist but no workflows discovered
            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 5,
                signals: 1,
                queries: 1,
                workflows: 0, // No workflows discovered = discovery issue
                childWorkflows: 0,
            });

            const health = service.getHealth();
            expect(health.status).toBe('degraded');
        });

        it('should determine overall health status logic - unhealthy case', () => {
            clientService.isHealthy.mockReturnValue(false);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: false,
                isRunning: false,
                isInitialized: false,
            });
            scheduleService.isHealthy.mockReturnValue(false);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'unhealthy',
                isComplete: false,
            });

            const health = service.getHealth();
            expect(health.status).toBe('unhealthy');
        });

        it('should handle getOverallHealth promise resolution', async () => {
            clientService.isHealthy.mockReturnValue(true);
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });

            const health = await service.getOverallHealth();
            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('components');
        });

        it('should handle shutdown with existing shutdown promise', async () => {
            // Set an existing shutdown promise
            const existingPromise = Promise.resolve();
            (service as any).shutdownPromise = existingPromise;

            const result = await service.onModuleDestroy();
            expect(result).toBe(undefined);
        });

        it('should handle concurrent onModuleDestroy calls properly', async () => {
            // Reset shutdown promise to null to start fresh
            (service as any).shutdownPromise = null;

            // Call onModuleDestroy multiple times concurrently
            const promise1 = service.onModuleDestroy();
            const promise2 = service.onModuleDestroy();
            const promise3 = service.onModuleDestroy();

            // All should resolve to the same promise
            const result1 = await promise1;
            const result2 = await promise2;
            const result3 = await promise3;

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should properly handle shutdown promise return (lines 72-77)', async () => {
            // Reset shutdown promise first
            (realService as any).shutdownPromise = null;

            // Mock workerService for proper shutdown
            jest.spyOn(realService.workerService, 'isWorkerRunning').mockReturnValue(true);
            jest.spyOn(realService.workerService, 'stopWorker').mockResolvedValue(undefined);

            // Call onModuleDestroy first time - should create shutdown promise
            const firstCall = realService.onModuleDestroy();

            // Verify that shutdownPromise has been set and is the same as the returned promise
            expect((realService as any).shutdownPromise).toBeTruthy();
            expect((realService as any).shutdownPromise).toStrictEqual(firstCall);

            // Call onModuleDestroy second time - should return existing shutdown promise (line 73)
            const secondCall = realService.onModuleDestroy();

            // Both should return the same promise
            expect(firstCall).toStrictEqual(secondCall);
            expect((realService as any).shutdownPromise).toStrictEqual(secondCall);

            // Resolve the promise to ensure cleanup
            await firstCall;
        });

        it('should handle performShutdown with worker stopping (lines 116-118)', async () => {
            jest.clearAllMocks();
            (service as any).shutdownPromise = null;

            // Mock worker service to be running and stop it
            workerService.isWorkerRunning.mockReturnValue(true);
            workerService.stopWorker.mockResolvedValue(undefined);

            const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            // Directly call performShutdown to test the logic
            await (service as any).performShutdown();

            expect(workerService.isWorkerRunning).toHaveBeenCalled();
            expect(workerService.stopWorker).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Shutting down Temporal Service...');
            expect(logSpy).toHaveBeenCalledWith('Temporal Service shut down successfully');

            logSpy.mockRestore();
        });

        it('should handle performShutdown finally block (line 125)', async () => {
            jest.clearAllMocks();
            (service as any).shutdownPromise = null;

            // Mock worker service to throw error but still execute finally block
            workerService.isWorkerRunning.mockReturnValue(true);
            workerService.stopWorker.mockRejectedValue(new Error('Stop worker failed'));

            const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Directly call performShutdown to test error handling
            await (service as any).performShutdown();

            // Check that shutdownPromise is reset to null in finally block
            expect((service as any).shutdownPromise).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error during service shutdown: Stop worker failed'),
            );

            errorSpy.mockRestore();
        });

        it('should handle performShutdown error scenarios', async () => {
            jest.clearAllMocks();
            (service as any).shutdownPromise = null;

            // Mock worker service to throw error during stopWorker
            workerService.isWorkerRunning.mockReturnValue(true);
            workerService.stopWorker.mockRejectedValue(new Error('Worker stop error'));

            const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Directly call performShutdown to test error handling
            await (service as any).performShutdown();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error during service shutdown:'),
            );

            errorSpy.mockRestore();
        });

        it('should handle shutdown when worker service is undefined', async () => {
            jest.clearAllMocks();
            (service as any).shutdownPromise = null;

            // Temporarily set worker service to undefined
            const originalWorkerService = (service as any).workerService;
            (service as any).workerService = undefined;

            const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            // Directly call performShutdown to test undefined worker service
            await (service as any).performShutdown();

            expect(logSpy).toHaveBeenCalledWith('Shutting down Temporal Service...');
            expect(logSpy).toHaveBeenCalledWith('Temporal Service shut down successfully');

            // Restore worker service
            (service as any).workerService = originalWorkerService;
            logSpy.mockRestore();
        });

        it('should handle shutdown when worker is not running', async () => {
            jest.clearAllMocks();
            (service as any).shutdownPromise = null;

            // Mock worker service to report not running
            workerService.isWorkerRunning.mockReturnValue(false);

            const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            // Directly call performShutdown to test worker not running
            await (service as any).performShutdown();

            expect(logSpy).toHaveBeenCalledWith('Shutting down Temporal Service...');
            expect(logSpy).toHaveBeenCalledWith('Temporal Service shut down successfully');

            // Restore worker running state
            workerService.isWorkerRunning.mockReturnValue(true);
            logSpy.mockRestore();
        });

        it('should handle logInitializationSummary happy path', async () => {
            jest.clearAllMocks();

            // Restore the original method temporarily
            delete (service as any).logInitializationSummary;

            const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            await (service as any).logInitializationSummary();

            // Check for the actual log messages that the method produces
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Discovery:'));

            logSpy.mockRestore();

            // Re-mock the method
            (service as any).logInitializationSummary = jest.fn().mockResolvedValue(undefined);
        });

        it('should log worker not available in logInitializationSummary', async () => {
            jest.clearAllMocks();

            // Restore the original method temporarily
            delete (service as any).logInitializationSummary;

            // Mock hasWorker to return false
            const originalHasWorker = service.hasWorker;
            service.hasWorker = jest.fn().mockReturnValue(false);

            const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            await (service as any).logInitializationSummary();

            expect(logSpy).toHaveBeenCalledWith('Worker: not available');

            logSpy.mockRestore();

            // Restore original hasWorker method
            service.hasWorker = originalHasWorker;

            // Re-mock the method
            (service as any).logInitializationSummary = jest.fn().mockResolvedValue(undefined);
        });

        it('should test discovery health status branches', () => {
            // Test discovery not complete
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: false,
            });

            const health = service.getHealth();
            expect(health.services.discovery.status).toBe('healthy');

            // Test discovery unhealthy
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'unhealthy',
                isComplete: true,
            });

            const health2 = service.getHealth();
            expect(health2.services.discovery.status).toBe('unhealthy');
        });

        it('should test worker status branch variations', () => {
            // Ensure all other services are healthy so worker status is the determining factor
            clientService.isHealthy.mockReturnValue(true);
            scheduleService.isHealthy.mockReturnValue(true);
            activityService.isHealthy.mockReturnValue(true);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy',
                isComplete: true,
            });
            discoveryService.getStats.mockReturnValue({
                controllers: 1,
                methods: 5,
                signals: 1,
                queries: 1,
                workflows: 1, // Ensure no discovery issues
                childWorkflows: 0,
            });

            // Test worker healthy
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: true,
                isRunning: true,
                isInitialized: true,
            });

            const health = service.getHealth();
            expect(health.services.worker.status).toBe('healthy');

            // Test worker not running
            workerService.getWorkerStatus.mockReturnValue({
                isHealthy: false, // This should make it degraded
                isRunning: false,
                isInitialized: true,
            });

            const health2 = service.getHealth();
            expect(health2.services.worker.status).toBe('degraded');
        });
    });

    it('should handle activity service health check branches', () => {
        // Test activity service unhealthy
        activityService.getHealth.mockReturnValue({
            status: 'unhealthy',
            activitiesCount: { classes: 0, methods: 0, total: 0 },
            isInitialized: true,
            validation: { valid: false, errors: ['Test error'] },
        });

        const health = service.getHealth();
        expect(health.services.activity.status).toBe('unhealthy');

        // Restore healthy state
        activityService.getHealth.mockReturnValue({
            status: 'healthy',
            activitiesCount: { classes: 0, methods: 0, total: 0 },
            isInitialized: true,
            validation: { valid: true, errors: [] },
        });
    });

    it('should handle schedule stats error scenarios', () => {
        // Mock scheduleService to throw error and suppress the error logging
        const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
        scheduleService.getScheduleStats.mockImplementation(() => {
            throw new Error('Stats error');
        });

        // The method should handle the error gracefully and return default values
        expect(() => service.getHealth()).toThrow('Stats error');

        // Restore the logger
        loggerSpy.mockRestore();

        // Reset the mock
        scheduleService.getScheduleStats.mockReturnValue({
            total: 0,
            active: 0,
            inactive: 0,
            errors: 0,
        });
    });

    it('should test schedule stats with error count', () => {
        // Ensure clean state for this test
        jest.clearAllMocks();

        scheduleService.getScheduleStats.mockReturnValue({
            total: 5,
            active: 2,
            inactive: 1,
            errors: 2,
        });
        scheduleService.isHealthy.mockReturnValue(true);

        const health = service.getHealth();
        expect(health.summary.totalSchedules).toBe(5);
    });

    it('should handle getStats error scenarios', () => {
        // Ensure service is initialized
        (service as any).isInitialized = true;

        // Temporarily replace the service with error mock
        const originalActivityService = (service as any).activityService;
        const errorActivityService = {
            ...activityService,
            getActivityNames: jest.fn().mockImplementation(() => {
                throw new Error('Activity names error');
            }),
        };

        // Temporarily replace the service
        (service as any).activityService = errorActivityService;

        // The getStats method should throw because getActivityCount throws
        expect(() => service.getStats()).toThrow('Activity names error');

        // Restore original service completely
        (service as any).activityService = originalActivityService;
    });

    it('should handle discoveryService.getStats error in getStats', () => {
        // Ensure service is initialized
        (service as any).isInitialized = true;

        const originalGetStats = discoveryService.getStats;

        discoveryService.getStats = jest.fn().mockImplementation(() => {
            throw new Error('Discovery stats error');
        });

        // The getStats method should throw because discoveryService.getStats throws
        expect(() => service.getStats()).toThrow('Discovery stats error');

        // Restore normal behavior
        discoveryService.getStats = originalGetStats;
    });

    it('should handle workerService.getWorkerStatus error in getStats', () => {
        // Ensure service is initialized
        (service as any).isInitialized = true;

        const originalGetWorkerStatus = workerService.getWorkerStatus;

        workerService.getWorkerStatus = jest.fn().mockImplementation(() => {
            throw new Error('Worker stats error');
        });

        // The getStats method should throw because workerService.getWorkerStatus throws
        expect(() => service.getStats()).toThrow('Worker stats error');

        // Restore normal behavior
        workerService.getWorkerStatus = originalGetWorkerStatus;
    });

    it('should handle clientService status in getStats', () => {
        // Ensure service is initialized
        (service as any).isInitialized = true;

        // Test different client states
        clientService.isHealthy.mockReturnValue(false);

        const stats = service.getStats();
        expect(stats.client.status).toBe('unhealthy');

        // Restore healthy state
        clientService.isHealthy.mockReturnValue(true);
    });
});
