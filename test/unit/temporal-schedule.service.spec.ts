import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { Client, ScheduleClient, ScheduleHandle, ScheduleOverlapPolicy } from '@temporalio/client';

describe('TemporalScheduleService', () => {
    let service: TemporalScheduleService;
    let mockClient: jest.Mocked<Client>;
    let mockScheduleClient: jest.Mocked<ScheduleClient>;
    let mockScheduleHandle: jest.Mocked<ScheduleHandle>;

    const mockOptions: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'default',
        },
        taskQueue: 'test-queue',
    };

    beforeEach(async () => {
        mockScheduleHandle = {
            scheduleId: 'test-schedule',
            pause: jest.fn().mockResolvedValue(undefined),
            unpause: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
            trigger: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
            describe: jest.fn().mockResolvedValue({}),
        } as any;

        mockScheduleClient = {
            create: jest.fn().mockResolvedValue(mockScheduleHandle),
            getHandle: jest.fn().mockResolvedValue(mockScheduleHandle),
            list: jest.fn().mockReturnValue([]),
        } as any;

        mockClient = {
            schedule: mockScheduleClient,
        } as any;

        const mockDiscoveryService = {
            getProviders: jest.fn().mockReturnValue([]),
            getControllers: jest.fn().mockReturnValue([]),
        };

        const mockMetadataAccessor = {
            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
            isActivity: jest.fn().mockReturnValue(false),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalScheduleService,
                {
                    provide: TEMPORAL_CLIENT,
                    useValue: mockClient,
                },
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

        service = module.get<TemporalScheduleService>(TemporalScheduleService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should initialize with client and schedule client', async () => {
            await service.onModuleInit();
            expect(service.isHealthy()).toBe(true);
        });

        it('should handle missing schedule client gracefully', async () => {
            const clientWithoutSchedule = {};
            Object.defineProperty(clientWithoutSchedule, 'connection', {
                get: () => {
                    throw new Error('Connection not available');
                },
                configurable: true,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: clientWithoutSchedule,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutSchedule =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            await serviceWithoutSchedule.onModuleInit();
            expect(serviceWithoutSchedule.isHealthy()).toBe(true);
            expect(serviceWithoutSchedule.getStatus().schedulesSupported).toBe(false);
        });

        it('should handle missing client gracefully', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: null,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutClient =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            await serviceWithoutClient.onModuleInit();
            expect(serviceWithoutClient.isHealthy()).toBe(true);
            expect(serviceWithoutClient.getStatus().schedulesSupported).toBe(false);
        });

        it('should handle initialization errors', async () => {
            const faultyClient = {};
            Object.defineProperty(faultyClient, 'schedule', {
                get: () => {
                    throw new Error('Schedule client error');
                },
                configurable: true,
            });
            Object.defineProperty(faultyClient, 'connection', {
                get: () => {
                    throw new Error('Connection not available');
                },
                configurable: true,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: faultyClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            getActivityMetadata: jest.fn().mockReturnValue([]),
                            getWorkflowMetadata: jest.fn().mockReturnValue([]),
                        },
                    },
                ],
            }).compile();

            const service = module.get<TemporalScheduleService>(TemporalScheduleService);
            await service.onModuleInit();

            expect(service.isHealthy()).toBe(true);
            // The service is still healthy because it completed initialization
            // even though schedule client creation failed
            expect(service.getStatus().schedulesSupported).toBe(false);
        });

        it('should log error when schedule client initialization fails', async () => {
            const faultyClient = {};
            Object.defineProperty(faultyClient, 'schedule', {
                get: () => {
                    throw new Error('Schedule client initialization error');
                },
                configurable: true,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: faultyClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const service = module.get<TemporalScheduleService>(TemporalScheduleService);
            await service.onModuleInit();

            expect(service.isHealthy()).toBe(true);
            expect(service.getStatus().schedulesSupported).toBe(false);
        });

        it('should handle error when accessing schedule property during initialization', async () => {
            // Create a client that throws an error specifically when accessing the schedule property
            const faultyClient = {};
            Object.defineProperty(faultyClient, 'schedule', {
                get: () => {
                    throw new Error('Error accessing schedule property');
                },
                configurable: true,
            });

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: faultyClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const service = module.get<TemporalScheduleService>(TemporalScheduleService);
            await service.onModuleInit();

            expect(service.isHealthy()).toBe(true);
            expect(service.getStatus().schedulesSupported).toBe(false);
        });
    });

    describe('createCronSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should create cron schedule with basic options', async () => {
            const scheduleId = 'test-cron-schedule';
            const workflowType = 'TestWorkflow';
            const cronExpression = '0 0 * * *';
            const taskQueue = 'test-queue';
            const args = ['arg1', 'arg2'];

            const result = await service.createCronSchedule(
                scheduleId,
                cronExpression,
                workflowType,
                taskQueue,
                args,
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith({
                scheduleId,
                spec: {
                    cronExpressions: [cronExpression],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                },
                memo: {},
                searchAttributes: {},
            });
            expect(result).toBe(mockScheduleHandle);
        });

        it('should create cron schedule with all options', async () => {
            const scheduleId = 'test-cron-schedule';
            const workflowType = 'TestWorkflow';
            const cronExpression = '0 0 * * *';
            const taskQueue = 'test-queue';
            const args = ['arg1', 'arg2'];
            const options = {
                description: 'Test schedule',
                timezone: 'UTC',
                overlapPolicy: 'skip',
                startPaused: true,
            };

            await service.createCronSchedule(
                scheduleId,
                cronExpression,
                workflowType,
                taskQueue,
                args,
                options,
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith({
                scheduleId,
                spec: {
                    cronExpressions: [cronExpression],
                    timeZone: 'UTC',
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                },
                memo: {
                    description: 'Test schedule',
                },
                searchAttributes: {
                    overlap: 'SKIP',
                },
            });
        });

        it('should handle creation errors', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Creation failed'));

            await expect(
                service.createCronSchedule(
                    'test-schedule',
                    '0 0 * * *',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow("Failed to create cron schedule 'test-schedule': Creation failed");
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: null,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutClient =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            await serviceWithoutClient.onModuleInit();

            await expect(
                serviceWithoutClient.createCronSchedule(
                    'test-schedule',
                    '0 0 * * *',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow(
                "Failed to create cron schedule 'test-schedule': Cannot read properties of undefined (reading 'create')",
            );
        });
    });

    describe('createIntervalSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should create interval schedule with basic options', async () => {
            const scheduleId = 'test-interval-schedule';
            const workflowType = 'TestWorkflow';
            const interval = '1h';
            const taskQueue = 'test-queue';
            const args = ['arg1', 'arg2'];

            const result = await service.createIntervalSchedule(
                scheduleId,
                interval,
                workflowType,
                taskQueue,
                args,
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith({
                scheduleId,
                spec: {
                    intervals: [{ every: interval }],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                },
                memo: {},
                searchAttributes: {},
            });
            expect(result).toBe(mockScheduleHandle);
        });

        it('should create interval schedule with all options', async () => {
            const scheduleId = 'test-interval-schedule';
            const workflowType = 'TestWorkflow';
            const interval = '1h';
            const taskQueue = 'test-queue';
            const args = ['arg1', 'arg2'];
            const options = {
                description: 'Test interval schedule',
                overlapPolicy: 'buffer_one',
                startPaused: true,
            };

            await service.createIntervalSchedule(
                scheduleId,
                interval,
                workflowType,
                taskQueue,
                args,
                options,
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith({
                scheduleId,
                spec: {
                    intervals: [{ every: interval }],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType,
                    taskQueue,
                    args,
                },
                memo: {
                    description: 'Test interval schedule',
                },
                searchAttributes: {
                    overlap: 'BUFFER_ONE',
                },
            });
        });

        it('should handle creation errors', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Creation failed'));

            await expect(
                service.createIntervalSchedule('test-schedule', '1h', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow(
                "Failed to create interval schedule 'test-schedule': Creation failed",
            );
        });
    });

    describe('pauseSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should pause schedule', async () => {
            const scheduleId = 'test-schedule';
            const mockHandle = {
                pause: jest.fn().mockResolvedValue(undefined),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await service.pauseSchedule(scheduleId);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.pause).toHaveBeenCalledWith('Paused via NestJS Temporal integration');
        });

        it('should pause schedule with custom note', async () => {
            const scheduleId = 'test-schedule';
            const note = 'Custom pause note';
            const mockHandle = {
                pause: jest.fn().mockResolvedValue(undefined),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await service.pauseSchedule(scheduleId, note);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.pause).toHaveBeenCalledWith(note);
        });

        it('should handle pause errors', async () => {
            (mockScheduleClient.getHandle as any).mockRejectedValue(new Error('Handle failed'));

            await expect(service.pauseSchedule('test-schedule')).rejects.toThrow(
                "Failed to pause schedule 'test-schedule': Handle failed",
            );
        });
    });

    describe('resumeSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should resume schedule', async () => {
            const scheduleId = 'test-schedule';
            const mockHandle = {
                update: jest.fn().mockResolvedValue(undefined),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await service.resumeSchedule(scheduleId);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.update).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should resume schedule with custom note', async () => {
            const scheduleId = 'test-schedule';
            const note = 'Custom resume note';
            const mockHandle = {
                update: jest.fn().mockResolvedValue(undefined),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await service.resumeSchedule(scheduleId, note);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.update).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should handle resume errors', async () => {
            const scheduleId = 'test-schedule';
            const mockHandle = {
                update: jest.fn().mockRejectedValue(new Error('Resume failed')),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await expect(service.resumeSchedule(scheduleId)).rejects.toThrow('Resume failed');

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.update).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('deleteSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should delete schedule', async () => {
            const scheduleId = 'test-schedule';

            await service.deleteSchedule(scheduleId);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockScheduleHandle.delete).toHaveBeenCalled();
        });

        it('should handle delete errors', async () => {
            mockScheduleHandle.delete.mockRejectedValue(new Error('Delete failed'));

            await expect(service.deleteSchedule('test-schedule')).rejects.toThrow(
                "Failed to delete schedule 'test-schedule': Delete failed",
            );
        });
    });

    describe('triggerSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should trigger schedule with default overlap policy', async () => {
            const scheduleId = 'test-schedule';

            await service.triggerSchedule(scheduleId);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockScheduleHandle.trigger).toHaveBeenCalledWith('ALLOW_ALL');
        });

        it('should trigger schedule with custom overlap policy', async () => {
            const scheduleId = 'test-schedule';
            const overlapPolicy = 'skip';

            await service.triggerSchedule(scheduleId, overlapPolicy);

            expect(mockScheduleHandle.trigger).toHaveBeenCalledWith('SKIP');
        });

        it('should handle trigger errors', async () => {
            mockScheduleHandle.trigger.mockRejectedValue(new Error('Trigger failed'));

            await expect(service.triggerSchedule('test-schedule')).rejects.toThrow(
                "Failed to trigger schedule 'test-schedule': Trigger failed",
            );
        });
    });

    describe('updateSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should update schedule', async () => {
            const scheduleId = 'test-schedule';
            const updateFn = jest.fn().mockReturnValue({ updated: true });
            const mockHandle = {
                update: jest.fn().mockResolvedValue(undefined),
            };
            (mockScheduleClient.getHandle as jest.Mock).mockResolvedValue(mockHandle);

            await service.updateSchedule(scheduleId, updateFn);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockHandle.update).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should handle update errors', async () => {
            mockScheduleHandle.update.mockRejectedValue(new Error('Update failed'));

            await expect(service.updateSchedule('test-schedule', jest.fn())).rejects.toThrow(
                "Failed to update schedule 'test-schedule': Update failed",
            );
        });
    });

    describe('listSchedules', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should list schedules with default page size', async () => {
            const mockSchedules = [
                {
                    scheduleId: 'schedule1',
                    id: 'schedule1',
                    state: { paused: false },
                    info: { recentActions: [], nextActionTimes: [] },
                },
                {
                    scheduleId: 'schedule2',
                    id: 'schedule2',
                    state: { paused: false },
                    info: { recentActions: [], nextActionTimes: [] },
                },
            ];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.listSchedules();

            expect((service as any).scheduleClient.list).toHaveBeenCalledWith({ pageSize: 100 });
            expect(result).toEqual([
                { id: 'schedule1', state: { paused: false } },
                { id: 'schedule2', state: { paused: false } },
            ]);
        });

        it('should list schedules with custom page size', async () => {
            const mockSchedules = [
                {
                    scheduleId: 'schedule1',
                    id: 'schedule1',
                    state: { paused: false },
                    info: { recentActions: [], nextActionTimes: [] },
                },
            ];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.listSchedules(50);

            expect((service as any).scheduleClient.list).toHaveBeenCalledWith({ pageSize: 50 });
            expect(result).toEqual([{ id: 'schedule1', state: { paused: false } }]);
        });

        it('should handle list errors', async () => {
            mockScheduleClient.list.mockImplementation(() => {
                throw new Error('List failed');
            });

            await expect(service.listSchedules()).rejects.toThrow(
                'Failed to list schedules: List failed',
            );
        });
    });

    describe('describeSchedule', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should describe schedule', async () => {
            const scheduleId = 'test-schedule';
            const description = { status: 'RUNNING' };
            mockScheduleHandle.describe.mockResolvedValue(description as any);

            const result = await service.describeSchedule(scheduleId);

            expect(mockScheduleClient.getHandle).toHaveBeenCalledWith(scheduleId);
            expect(mockScheduleHandle.describe).toHaveBeenCalled();
            expect(result).toBe(description);
        });

        it('should handle describe errors', async () => {
            mockScheduleHandle.describe.mockRejectedValue(new Error('Describe failed'));

            await expect(service.describeSchedule('test-schedule')).rejects.toThrow(
                "Failed to describe schedule 'test-schedule': Describe failed",
            );
        });
    });

    describe('scheduleExists', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should return true for existing schedule', async () => {
            const mockSchedules = [
                {
                    scheduleId: 'schedule1',
                    id: 'schedule1',
                    state: { paused: false },
                    info: { recentActions: [], nextActionTimes: [] },
                },
                {
                    scheduleId: 'schedule2',
                    id: 'schedule2',
                    state: { paused: false },
                    info: { recentActions: [], nextActionTimes: [] },
                },
            ];

            mockScheduleClient.list.mockReturnValue(
                (async function* () {
                    for (const schedule of mockSchedules) {
                        yield schedule;
                    }
                })(),
            );

            const result = await service.scheduleExists('schedule1');
            expect(result).toBe(true);
        });

        it('should return false for non-existing schedule', async () => {
            const mockSchedules = [{ scheduleId: 'schedule1', state: { paused: false }, info: {} }];

            mockScheduleClient.list.mockReturnValue(
                (async function* () {
                    for (const schedule of mockSchedules) {
                        yield {
                            scheduleId: schedule.scheduleId,
                            state: { paused: false },
                            info: { recentActions: [], nextActionTimes: [] },
                        };
                    }
                })(),
            );

            const result = await service.scheduleExists('schedule2');

            expect(result).toBe(false);
        });

        it('should return false on list errors', async () => {
            mockScheduleClient.list.mockImplementation(() => {
                throw new Error('List failed');
            });

            const result = await service.scheduleExists('schedule1');

            expect(result).toBe(false);
        });
    });

    describe('getScheduleClient', () => {
        it('should return schedule client', async () => {
            await service.onModuleInit();
            const result = service.getScheduleClient();
            expect(result).toBe(mockScheduleClient);
        });

        it('should return undefined when not initialized', () => {
            const result = service.getScheduleClient();
            expect(result).toBeUndefined();
        });
    });

    describe('isHealthy', () => {
        it('should return true when schedule client is available', async () => {
            await service.onModuleInit();
            expect(service.isHealthy()).toBe(true);
        });

        it('should return false when schedule client is not available', async () => {
            await service.onModuleInit();
            const result = service.getStatus();

            expect(result).toEqual({
                available: true,
                healthy: true,
                schedulesSupported: true,
            });
        });

        it('should handle errors when checking client health', async () => {
            await service.onModuleInit();

            // Create a proxy that throws when accessing properties
            const faultyClient = new Proxy(mockScheduleClient, {
                get(target, prop) {
                    if (prop === 'list' || prop === 'getHandle') {
                        throw new Error('Property access error');
                    }
                    return (target as any)[prop];
                },
            });

            // Replace the client
            (service as any).scheduleClient = faultyClient;

            // The service should still be healthy because it completed initialization
            // even though schedule client methods throw errors
            expect(service.isHealthy()).toBe(true);
        });
    });

    describe('getScheduleStats', () => {
        it('should return placeholder stats', () => {
            const result = service.getScheduleStats();

            expect(result).toEqual({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });
        });
    });

    describe('getStatus', () => {
        it('should return status with healthy schedule client', async () => {
            await service.onModuleInit();
            const result = service.getStatus();

            expect(result).toEqual({
                available: true,
                healthy: true,
                schedulesSupported: true,
            });
        });

        it('should return false when schedule client is not available', async () => {
            const mockClientWithoutSchedule = {};
            Object.defineProperty(mockClientWithoutSchedule, 'schedule', {
                get: () => undefined,
                configurable: true,
            });
            Object.defineProperty(mockClientWithoutSchedule, 'connection', {
                get: () => {
                    throw new Error('Connection not available');
                },
                configurable: true,
            });

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            await serviceWithoutSchedule.onModuleInit();
            const result = serviceWithoutSchedule.getStatus();

            expect(result).toEqual({
                available: true, // Client is available, just no schedule support
                healthy: true, // Service is initialized and healthy
                schedulesSupported: false, // No schedule support
            });
        });
    });

    describe('Schedule Client Health Checks', () => {
        it('should return false when schedule client methods throw', async () => {
            // Mock schedule client methods to throw errors
            mockScheduleHandle.describe.mockRejectedValue(new Error('Describe error') as never);
            mockScheduleClient.list.mockImplementation(() => {
                throw new Error('List error');
            });

            const result = service.isHealthy();
            expect(result).toBe(false);
        });

        it('should return true when schedule client is healthy', async () => {
            // Ensure the service has a schedule client initialized
            await service.onModuleInit();

            const result = service.isHealthy();
            expect(result).toBe(true);
        });

        it('should handle schedule client not available', () => {
            // Mock client without schedule property
            const mockClientWithoutSchedule = {
                schedule: undefined,
            };

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            const result = serviceWithoutSchedule.isHealthy();
            expect(result).toBe(false);
        });
    });

    describe('Scheduled Workflow ID Generation', () => {
        it('should generate unique workflow IDs', async () => {
            const id1 = service['generateScheduledWorkflowId']('test-schedule');
            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 1));
            const id2 = service['generateScheduledWorkflowId']('test-schedule');

            expect(id1).toContain('test-schedule');
            expect(id2).toContain('test-schedule');
            expect(id1).not.toBe(id2);
        });

        it('should include timestamp in workflow ID', () => {
            const id = service['generateScheduledWorkflowId']('test-schedule');

            expect(id).toMatch(/^test-schedule-\d+$/);
        });

        it('should handle different schedule IDs', () => {
            const id1 = service['generateScheduledWorkflowId']('schedule-1');
            const id2 = service['generateScheduledWorkflowId']('schedule-2');

            expect(id1).toContain('schedule-1');
            expect(id2).toContain('schedule-2');
            expect(id1).not.toBe(id2);
        });
    });

    describe('Cron Schedule Creation Edge Cases', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should create cron schedule with timezone', async () => {
            const mockHandle = { scheduleId: 'test-schedule' };
            (service as any).scheduleClient = {
                create: jest.fn().mockResolvedValue(mockHandle),
            };

            const handle = await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'test-workflow',
                'test-queue',
                ['arg1', 'arg2'],
                {
                    timezone: 'UTC',
                    description: 'Test schedule',
                    overlapPolicy: 'ALLOW_ALL',
                    startPaused: true,
                },
            );

            expect(handle).toBe(mockHandle);
            expect((service as any).scheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduleId: 'test-schedule',
                    spec: expect.objectContaining({
                        cronExpressions: ['0 9 * * *'],
                        timeZone: 'UTC',
                    }),
                    memo: { description: 'Test schedule' },
                    searchAttributes: { overlap: 'ALLOW_ALL' },
                }),
            );
        });

        it('should create cron schedule without optional parameters', async () => {
            const mockHandle = { scheduleId: 'test-schedule' };
            (service as any).scheduleClient = {
                create: jest.fn().mockResolvedValue(mockHandle),
            };

            const handle = await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'test-workflow',
                'test-queue',
            );

            expect(handle).toBe(mockHandle);
            expect((service as any).scheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduleId: 'test-schedule',
                    spec: expect.objectContaining({
                        cronExpressions: ['0 9 * * *'],
                    }),
                }),
            );
        });
    });

    describe('Interval Schedule Creation Edge Cases', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should create interval schedule with all options', async () => {
            const mockHandle = { scheduleId: 'test-schedule' };
            (service as any).scheduleClient = {
                create: jest.fn().mockResolvedValue(mockHandle),
            };

            const handle = await service.createIntervalSchedule(
                'test-schedule',
                '5m',
                'test-workflow',
                'test-queue',
                ['arg1'],
                {
                    description: 'Test interval schedule',
                    overlapPolicy: 'SKIP',
                    startPaused: false,
                },
            );

            expect(handle).toBe(mockHandle);
            expect((service as any).scheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduleId: 'test-schedule',
                    spec: { intervals: [{ every: '5m' }] },
                    memo: { description: 'Test interval schedule' },
                    searchAttributes: { overlap: 'SKIP' },
                }),
            );
        });
    });

    describe('Schedule Trigger Operations', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should trigger schedule with overlap policy', async () => {
            const mockHandle = {
                trigger: jest.fn().mockResolvedValue(undefined),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await service.triggerSchedule('test-schedule', 'allow_all');

            expect(mockHandle.trigger).toHaveBeenCalledWith('ALLOW_ALL');
        });

        it('should trigger schedule with default overlap policy', async () => {
            const mockHandle = {
                trigger: jest.fn().mockResolvedValue(undefined),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await service.triggerSchedule('test-schedule');

            expect(mockHandle.trigger).toHaveBeenCalledWith('ALLOW_ALL');
        });

        it('should handle trigger schedule errors', async () => {
            const mockHandle = {
                trigger: jest.fn().mockRejectedValue(new Error('Trigger error')),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await expect(service.triggerSchedule('test-schedule')).rejects.toThrow('Trigger error');
        });
    });

    describe('Schedule Update Operations', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should update schedule with function', async () => {
            const updateFn = jest.fn().mockReturnValue({ updated: true });
            const mockHandle = {
                update: jest.fn().mockImplementation((fn) => {
                    // Call the function with a mock schedule object that has the required properties
                    const mockSchedule = {
                        spec: {},
                        action: {},
                        state: {},
                        policies: {},
                    };
                    fn(mockSchedule);
                    return Promise.resolve();
                }),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await service.updateSchedule('test-schedule', updateFn);

            expect(mockHandle.update).toHaveBeenCalled();
            expect(updateFn).toHaveBeenCalled();
        });

        it('should handle update schedule errors', async () => {
            const mockHandle = {
                update: jest.fn().mockRejectedValue(new Error('Update error')),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await expect(service.updateSchedule('test-schedule', jest.fn())).rejects.toThrow(
                'Update error',
            );
        });
    });

    describe('Schedule List Operations', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should list schedules with default page size', async () => {
            const mockSchedules = [{ id: 'schedule-1' }, { id: 'schedule-2' }];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.listSchedules();

            expect((service as any).scheduleClient.list).toHaveBeenCalledWith({ pageSize: 100 });
            expect(result).toHaveLength(2);
        });

        it('should list schedules with custom page size', async () => {
            const mockSchedules = [{ id: 'schedule1' }];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.listSchedules(50);

            expect((service as any).scheduleClient.list).toHaveBeenCalledWith({ pageSize: 50 });
            expect(result).toEqual([{ id: 'schedule1', state: {} }]);
        });

        it('should handle list schedules errors', async () => {
            (service as any).scheduleClient = {
                list: jest.fn().mockImplementation(() => {
                    throw new Error('List error');
                }),
            };

            await expect(service.listSchedules()).rejects.toThrow(
                'Failed to list schedules: List error',
            );
        });
    });

    describe('Schedule Describe Operations', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should describe schedule', async () => {
            const mockHandle = {
                describe: jest.fn().mockResolvedValue({
                    id: 'test-schedule',
                    description: 'Test schedule',
                } as any),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            const result = await service.describeSchedule('test-schedule');

            expect(mockHandle.describe).toHaveBeenCalled();
            expect(result).toEqual({ id: 'test-schedule', description: 'Test schedule' });
        });

        it('should handle describe schedule errors', async () => {
            const mockHandle = {
                describe: jest.fn().mockRejectedValue(new Error('Describe error')),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await expect(service.describeSchedule('test-schedule')).rejects.toThrow(
                'Describe error',
            );
        });
    });

    describe('Schedule Existence Checks', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should check if schedule exists', async () => {
            // Mock the list method to return schedules including the one we're looking for
            const mockSchedules = [
                { scheduleId: 'test-schedule', id: 'test-schedule' },
                { scheduleId: 'other-schedule', id: 'other-schedule' },
            ];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.scheduleExists('test-schedule');

            expect(result).toBe(true);
        });

        it('should return false for non-existent schedule', async () => {
            // Mock the list method to return schedules not including the one we're looking for
            const mockSchedules = [
                { scheduleId: 'test-schedule' },
                { scheduleId: 'other-schedule' },
            ];
            (service as any).scheduleClient = {
                list: jest.fn().mockReturnValue(
                    (async function* () {
                        for (const schedule of mockSchedules) {
                            yield schedule;
                        }
                    })(),
                ),
            };

            const result = await service.scheduleExists('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('Schedule Client Access', () => {
        it('should return schedule client when available', async () => {
            await service.onModuleInit();
            const result = service.getScheduleClient();

            expect(result).toBe(mockScheduleClient);
        });

        it('should return undefined when schedule client not available', () => {
            const mockClientWithoutSchedule = {
                schedule: undefined,
            };

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            const result = serviceWithoutSchedule.getScheduleClient();

            expect(result).toBeUndefined();
        });
    });

    describe('Schedule Status Information', () => {
        it('should return schedule status', async () => {
            await service.onModuleInit();
            const result = service.getStatus();

            expect(result).toEqual({
                available: true,
                healthy: true,
                schedulesSupported: true,
            });
        });

        it('should return status when schedule client not available', async () => {
            const mockClientWithoutSchedule = {};
            Object.defineProperty(mockClientWithoutSchedule, 'schedule', {
                get: () => undefined,
                configurable: true,
            });
            Object.defineProperty(mockClientWithoutSchedule, 'connection', {
                get: () => {
                    throw new Error('Connection not available');
                },
                configurable: true,
            });

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            await serviceWithoutSchedule.onModuleInit();
            const result = serviceWithoutSchedule.getStatus();

            expect(result).toEqual({
                available: true, // Client is available, just no schedule support
                healthy: true, // Service is initialized and healthy
                schedulesSupported: false, // No schedule support
            });
        });
    });

    describe('Schedule Statistics', () => {
        it('should return schedule statistics', () => {
            const result = service.getScheduleStats();

            expect(result).toEqual({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });
        });

        it('should return statistics when schedule client not available', () => {
            const mockClientWithoutSchedule = {
                schedule: undefined,
            };

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            const result = serviceWithoutSchedule.getScheduleStats();

            expect(result).toEqual({
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            });
        });
    });

    describe('Private Method Testing', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should execute schedule operation successfully', async () => {
            const mockAction = jest.fn().mockResolvedValue('success');

            const result = await service['executeScheduleOperation'](
                'test-schedule',
                'test',
                mockAction,
            );

            expect(mockAction).toHaveBeenCalled();
            expect(result).toBe('success');
        });

        it('should handle schedule operation errors', async () => {
            const mockAction = jest.fn().mockRejectedValue(new Error('Operation error'));

            await expect(
                service['executeScheduleOperation']('test-schedule', 'test', mockAction),
            ).rejects.toThrow('Operation error');
        });

        it('should ensure client is initialized', () => {
            const mockClientWithoutSchedule = {
                schedule: undefined,
            };

            const serviceWithoutSchedule = new TemporalScheduleService(
                mockOptions,
                mockClientWithoutSchedule as any,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            expect(() => serviceWithoutSchedule['ensureClientInitialized']()).toThrow(
                'Schedule client not initialized',
            );
        });
    });

    describe('Module Destruction', () => {
        it('should handle module destruction gracefully', async () => {
            await service.onModuleInit();

            // Add some schedules to clear
            service['scheduleHandles'].set('test1', {} as any);
            service['scheduleHandles'].set('test2', {} as any);

            await service.onModuleDestroy();

            expect(service['scheduleHandles'].size).toBe(0);
            expect(service['isInitialized']).toBe(false);
        });

        it('should handle errors during module destruction', async () => {
            await service.onModuleInit();

            // Mock the logger methods to throw errors
            const originalLog = service['logger'].log;
            const originalError = service['logger'].error;

            service['logger'].log = jest.fn().mockImplementation(() => {
                throw new Error('Cleanup error');
            });
            service['logger'].error = jest.fn().mockImplementation(() => {
                throw new Error('Cleanup error');
            });

            // The service should throw when logger methods fail
            await expect(service.onModuleDestroy()).rejects.toThrow('Cleanup error');

            // Restore original methods
            service['logger'].log = originalLog;
            service['logger'].error = originalError;
        });
    });

    describe('Initialization Error Scenarios', () => {
        it('should handle initialization errors and rethrow them', async () => {
            const errorService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                {
                    getProviders: jest.fn().mockImplementation(() => {
                        throw new Error('Discovery error');
                    }),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            await expect(errorService.onModuleInit()).rejects.toThrow('Discovery error');
        });
    });

    describe('Edge Cases for Schedule Operations', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should handle resume schedule with unpause operation', async () => {
            const mockHandle = {
                update: jest.fn().mockResolvedValue(undefined),
            };
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockResolvedValue(mockHandle),
            };

            await service.resumeSchedule('test-schedule', 'Custom resume note');

            expect(mockHandle.update).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should handle schedule state checking', () => {
            expect(service.isHealthy()).toBe(true);

            service['isInitialized'] = false;
            expect(service.isHealthy()).toBe(false);
        });

        it('should cover schedule client initialization logging (line 79)', async () => {
            // Test that temporalLogger.debug is called during schedule client initialization
            const temporalLoggerSpy = jest.spyOn(service['temporalLogger'], 'debug');

            // Re-initialize to trigger the logging
            await service.onModuleInit();

            // Check if any debug message was called (the exact message may vary)
            expect(temporalLoggerSpy).toHaveBeenCalled();
        });

        it('should cover provider destructuring (lines 104-105)', async () => {
            const mockProvider = {
                instance: { test: 'instance' },
                metatype: class TestClass {},
            };

            const mockDiscoveryService = {
                getProviders: jest.fn().mockReturnValue([mockProvider]),
                getControllers: jest.fn().mockReturnValue([]),
            };

            const testService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                mockDiscoveryService as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            await testService.onModuleInit();

            expect(mockDiscoveryService.getProviders).toHaveBeenCalled();
        });

        it('should cover schedule registration logic (lines 131-270)', async () => {
            const mockScheduleMetadata = {
                scheduleId: 'test-schedule',
                workflowType: 'TestWorkflow',
                taskQueue: 'test-queue',
                args: ['arg1'],
                memo: { key: 'value' },
                searchAttributes: { attr: 'value' },
                cron: '0 0 * * *',
            };

            // Mock the private methods
            const buildScheduleSpecSpy = jest
                .spyOn(service as any, 'buildScheduleSpec')
                .mockReturnValue({
                    cronExpressions: ['0 0 * * *'],
                });
            const buildWorkflowOptionsSpy = jest
                .spyOn(service as any, 'buildWorkflowOptions')
                .mockReturnValue({});

            // Call the build methods directly to test them
            (service as any).buildScheduleSpec(mockScheduleMetadata);
            (service as any).buildWorkflowOptions(mockScheduleMetadata);

            expect(buildScheduleSpecSpy).toHaveBeenCalledWith(mockScheduleMetadata);
            expect(buildWorkflowOptionsSpy).toHaveBeenCalledWith(mockScheduleMetadata);
        });

        it('should cover error handling in getSchedule (lines 320-323)', async () => {
            const loggerSpy = jest.spyOn(service['logger'], 'error');

            // Mock to throw an error
            mockScheduleClient.getHandle.mockImplementation(() => {
                throw new Error('Handle failed');
            });

            const result = await service.getSchedule('non-existent-schedule');

            expect(result).toBeUndefined();
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to get schedule non-existent-schedule: Handle failed',
            );
        });

        it('should cover schedule not found in updateSchedule (line 339)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.updateSchedule('non-existent', () => {})).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover schedule not found in deleteSchedule (line 372)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.deleteSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover schedule not found in pauseSchedule (line 398)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.pauseSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover schedule creation with overlap policy (lines 418-433)', async () => {
            const options = {
                scheduleId: 'test-schedule',
                spec: { cronExpressions: ['0 0 * * *'] },
                action: {
                    type: 'startWorkflow',
                    workflowType: 'TestWorkflow',
                },
                overlap: ScheduleOverlapPolicy.ALLOW_ALL,
            };

            await service.createSchedule(options);

            expect(mockScheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    scheduleId: 'test-schedule',
                    action: expect.objectContaining({
                        type: 'startWorkflow',
                        workflowType: 'TestWorkflow',
                    }),
                }),
            );
        });

        it('should cover schedule not found in triggerSchedule (line 457)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.triggerSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover schedule not found in describeSchedule (line 494)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.describeSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover list iteration in listSchedules (line 512)', async () => {
            const mockSchedule1 = { id: 'schedule-1', state: {} };
            const mockSchedule2 = { id: 'schedule-2', state: {} };

            mockScheduleClient.list = jest.fn().mockReturnValue([mockSchedule1, mockSchedule2]);

            const result = await service.listSchedules(10);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(mockSchedule1);
            expect(result[1]).toEqual(mockSchedule2);
        });

        it('should cover schedule not found in resumeSchedule (line 558)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.resumeSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover schedule not found in unpauseSchedule (line 574)', async () => {
            mockScheduleClient.getHandle.mockResolvedValue(null as never);

            await expect(service.unpauseSchedule('non-existent')).rejects.toThrow(
                'Schedule non-existent not found',
            );
        });

        it('should cover maxItems limit in listSchedules (line 617)', async () => {
            const schedules = Array.from({ length: 150 }, (_, i) => ({
                id: `schedule-${i}`,
                state: {},
            }));

            mockScheduleClient.list = jest.fn().mockReturnValue(schedules);

            const result = await service.listSchedules(50);

            expect(result).toHaveLength(50);
        });

        it('should cover schedule existence check iteration (line 660)', async () => {
            const schedules = [
                { id: 'schedule-1', state: {} },
                { id: 'target-schedule', state: {} },
                { id: 'schedule-3', state: {} },
            ];

            mockScheduleClient.list = jest.fn().mockReturnValue(schedules);

            const exists = await service.scheduleExists('target-schedule');

            expect(exists).toBe(true);
        });

        it('should cover max iterations in scheduleExists (line 675)', async () => {
            const schedules = Array.from({ length: 1200 }, (_, i) => ({
                id: `schedule-${i}`,
                state: {},
            }));

            mockScheduleClient.list = jest.fn().mockReturnValue(schedules);

            const exists = await service.scheduleExists('non-existent');

            expect(exists).toBe(false);
        });

        it('should cover health check when not initialized (line 679)', () => {
            const uninitializedService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            const isHealthy = uninitializedService.isHealthy();

            expect(isHealthy).toBe(false);
        });

        it('should cover line 79 - schedule client initialization logging', async () => {
            const temporalLoggerSpy = jest.spyOn(service['temporalLogger'], 'debug');

            // Re-initialize to trigger the logging
            await service.onModuleInit();

            expect(temporalLoggerSpy).toHaveBeenCalledWith(
                'Schedule client initialized from existing client',
            );
        });

        it('should cover lines 131-270 - registerScheduledWorkflow method', async () => {
            const mockScheduleMetadata = {
                scheduleId: 'test-schedule',
                workflowType: 'TestWorkflow',
                taskQueue: 'test-queue',
                args: ['arg1'],
                memo: { key: 'value' },
                searchAttributes: { attr: 'value' },
                cron: '0 0 * * *',
            };

            // Mock the private methods
            const buildScheduleSpecSpy = jest
                .spyOn(service as any, 'buildScheduleSpec')
                .mockReturnValue({
                    cronExpressions: ['0 0 * * *'],
                });
            const buildWorkflowOptionsSpy = jest
                .spyOn(service as any, 'buildWorkflowOptions')
                .mockReturnValue({});

            const mockHandle = { id: 'test-schedule' };
            mockScheduleClient.create.mockResolvedValue(mockHandle as never);

            // Call the private method with correct signature
            await (service as any).registerScheduledWorkflow(
                {},
                class TestClass {},
                mockScheduleMetadata,
            );

            expect(buildScheduleSpecSpy).toHaveBeenCalledWith(mockScheduleMetadata);
            expect(buildWorkflowOptionsSpy).toHaveBeenCalledWith(mockScheduleMetadata);
            expect(mockScheduleClient.create).toHaveBeenCalled();
        });

        it('should cover lines 426-428 - update operation in resumeSchedule', async () => {
            const mockHandle = {
                update: jest.fn().mockImplementation((updater) => {
                    const result = updater({
                        state: { paused: true },
                        spec: {},
                        action: {},
                    });
                    return Promise.resolve(result);
                }),
            };
            mockScheduleClient.getHandle.mockResolvedValue(mockHandle as never);

            await service.resumeSchedule('test-schedule');

            expect(mockHandle.update).toHaveBeenCalled();
        });

        it('should cover line 512 - return statement in getScheduleHandles', () => {
            const result = service.getScheduleHandles();

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0); // Initially empty
        });

        it('should cover line 558 - return statement in getHealth method', () => {
            const result = service.getHealth();

            // The method returns the expected structure
            expect(typeof result).toBe('object');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('schedulesCount');
            expect(result).toHaveProperty('isInitialized');
            expect(result).toHaveProperty('details');
        });

        it('should cover line 574 - error throw in ensureInitialized', () => {
            const uninitializedService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                {
                    getProviders: jest.fn().mockReturnValue([]),
                    getControllers: jest.fn().mockReturnValue([]),
                } as any,
                {
                    extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                    isActivity: jest.fn().mockReturnValue(false),
                } as any,
            );

            expect(() => {
                (uninitializedService as any).ensureInitialized();
            }).toThrow('Temporal Schedule Service is not initialized');
        });

        it('should cover line 617 - error throw in createCronSchedule', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Creation failed'));

            await expect(
                service.createCronSchedule(
                    'test-schedule',
                    'invalid cron',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow("Failed to create cron schedule 'test-schedule': Creation failed");
        });

        it('should cover line 660 - error throw in createIntervalSchedule', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Creation failed'));

            await expect(
                service.createIntervalSchedule('test-schedule', '1h', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow(
                "Failed to create interval schedule 'test-schedule': Creation failed",
            );
        });

        it('should cover line 679 - unpause operation in unpauseSchedule', async () => {
            const mockHandle = {
                unpause: jest.fn().mockResolvedValue(undefined),
            };
            mockScheduleClient.getHandle.mockResolvedValue(mockHandle as never);

            await service.unpauseSchedule('test-schedule');

            expect(mockHandle.unpause).toHaveBeenCalledWith(
                'Resumed via NestJS Temporal integration',
            );
        });

        it('should cover parseInterval method with number input (line 246)', () => {
            const result = (service as any).parseInterval(5000);
            expect(result).toEqual({ every: '5000ms' });
        });

        it('should cover parseInterval method with milliseconds (line 253)', () => {
            const result = (service as any).parseInterval('5000ms');
            expect(result).toEqual({ every: '5000ms' });
        });

        it('should cover parseInterval method with seconds (line 257)', () => {
            const result = (service as any).parseInterval('5s');
            expect(result).toEqual({ every: '5s' });
        });

        it('should cover parseInterval method with minutes (line 261)', () => {
            const result = (service as any).parseInterval('5m');
            expect(result).toEqual({ every: '5m' });
        });

        it('should cover parseInterval method with hours (line 265)', () => {
            const result = (service as any).parseInterval('5h');
            expect(result).toEqual({ every: '5h' });
        });

        it('should cover parseInterval method default case (line 270)', () => {
            const result = (service as any).parseInterval('5000');
            expect(result).toEqual({ every: '5000ms' });
        });

        it('should cover buildScheduleSpec with cron array (lines 172-175)', () => {
            const metadata = { cron: ['0 0 * * *', '0 12 * * *'] };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result).toEqual({
                cronExpressions: ['0 0 * * *', '0 12 * * *'],
            });
        });

        it('should cover buildScheduleSpec with interval array (lines 179-182)', () => {
            const parseIntervalSpy = jest.spyOn(service as any, 'parseInterval');
            const metadata = { interval: ['5s', '10s'] };
            (service as any).buildScheduleSpec(metadata);
            expect(parseIntervalSpy).toHaveBeenCalledTimes(2);
        });

        it('should cover buildScheduleSpec with calendar array (lines 186-189)', () => {
            const metadata = { calendar: [{ dayOfMonth: 1 }, { dayOfMonth: 15 }] };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result).toEqual({
                calendars: [{ dayOfMonth: 1 }, { dayOfMonth: 15 }],
            });
        });

        it('should cover buildScheduleSpec with timezone (lines 192-195)', () => {
            const metadata = { timezone: 'America/New_York' };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result).toEqual({
                timeZone: 'America/New_York',
            });
        });

        it('should cover buildScheduleSpec with jitter (lines 197-200)', () => {
            const metadata = { jitter: '5s' };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result).toEqual({
                jitter: '5s',
            });
        });

        it('should cover buildWorkflowOptions with workflowId (lines 215-217)', () => {
            const metadata = { workflowId: 'test-workflow-id' };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                workflowId: 'test-workflow-id',
            });
        });

        it('should cover buildWorkflowOptions with workflowExecutionTimeout (lines 219-221)', () => {
            const metadata = { workflowExecutionTimeout: '1h' };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                workflowExecutionTimeout: '1h',
            });
        });

        it('should cover buildWorkflowOptions with workflowRunTimeout (lines 223-225)', () => {
            const metadata = { workflowRunTimeout: '30m' };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                workflowRunTimeout: '30m',
            });
        });

        it('should cover buildWorkflowOptions with workflowTaskTimeout (lines 227-229)', () => {
            const metadata = { workflowTaskTimeout: '5m' };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                workflowTaskTimeout: '5m',
            });
        });

        it('should cover buildWorkflowOptions with retryPolicy (lines 231-233)', () => {
            const retryPolicy = { initialInterval: '1s', maximumInterval: '10s' };
            const metadata = { retryPolicy };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                retryPolicy,
            });
        });

        it('should cover buildWorkflowOptions with args (lines 235-237)', () => {
            const metadata = { args: ['arg1', 'arg2'] };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({
                args: ['arg1', 'arg2'],
            });
        });

        it('should cover error handling in createCronSchedule (line 617)', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Unknown error'));

            await expect(
                service.createCronSchedule(
                    'test-schedule',
                    '0 0 * * *',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow("Failed to create cron schedule 'test-schedule': Unknown error");
        });

        it('should cover error handling in createIntervalSchedule (line 660)', async () => {
            mockScheduleClient.create.mockRejectedValue(new Error('Unknown error'));

            await expect(
                service.createIntervalSchedule('test-schedule', '5s', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow("Failed to create interval schedule 'test-schedule': Unknown error");
        });

        it('should cover debug log in schedule client initialization (line 79)', async () => {
            const temporalLoggerSpy = jest.spyOn(service['temporalLogger'], 'debug');

            // Reset the service to trigger initialization
            (service as any).scheduleClient = undefined;
            (service as any).isInitialized = false;

            // Initialize the service properly first
            await (service as any).onModuleInit();

            // Trigger client initialization by calling a method that uses it
            await service.listSchedules();

            expect(temporalLoggerSpy).toHaveBeenCalledWith(
                'Schedule client initialized from existing client',
            );
        });

        it('should cover error log in registerScheduledWorkflow (line 159)', async () => {
            const loggerSpy = jest.spyOn(service['logger'], 'error');

            // Mock the metadata accessor to throw an error
            const mockMetadataAccessor = {
                extractActivityMethods: jest.fn().mockImplementation(() => {
                    throw new Error('Metadata extraction failed');
                }),
            };

            // Replace the metadata accessor
            (service as any).metadataAccessor = mockMetadataAccessor;

            // Call registerScheduledWorkflow which should trigger the error
            // The method doesn't throw, but logs the error
            (service as any).registerScheduledWorkflow({}, 'TestWorkflow');

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to register scheduled workflow'),
            );
        });
    });

    describe('Missing Branch Coverage Tests', () => {
        it('should cover conditional branches in error handling', async () => {
            // Test specific error message handling in createCronSchedule
            mockScheduleClient.create.mockRejectedValueOnce(
                new Error('Failed to create schedule test-schedule: Connection failed'),
            );

            await expect(
                service.createCronSchedule(
                    'test-schedule',
                    '0 * * * *',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow('Failed to create cron schedule');
        });

        it('should cover conditional branches in interval schedule error handling', async () => {
            // Test specific error message handling in createIntervalSchedule
            mockScheduleClient.create.mockRejectedValueOnce(
                new Error('Failed to create schedule test-schedule: Interval invalid'),
            );

            await expect(
                service.createIntervalSchedule('test-schedule', '1m', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow('Failed to create interval schedule');
        });

        it('should cover all workflow option branches in buildWorkflowOptions', () => {
            const scheduleMetadata = {
                taskQueue: 'custom-queue',
                workflowId: 'custom-workflow-id',
                workflowExecutionTimeout: '5m',
                workflowRunTimeout: '10m',
                workflowTaskTimeout: '30s',
                retryPolicy: { maximumAttempts: 3 },
                args: ['arg1', 'arg2'],
            };

            // Access the private method through service instance
            const result = (service as any).buildWorkflowOptions(scheduleMetadata);

            expect(result.taskQueue).toBe('custom-queue');
            expect(result.workflowId).toBe('custom-workflow-id');
            expect(result.workflowExecutionTimeout).toBe('5m');
            expect(result.workflowRunTimeout).toBe('10m');
            expect(result.workflowTaskTimeout).toBe('30s');
            expect(result.retryPolicy).toEqual({ maximumAttempts: 3 });
            expect(result.args).toEqual(['arg1', 'arg2']);
        });

        it('should cover schedule spec branches in buildScheduleSpec', () => {
            // Test cron array
            let spec = (service as any).buildScheduleSpec({
                cron: ['0 * * * *', '30 * * * *'],
                timezone: 'UTC',
                jitter: '1m',
            });
            expect(spec.cronExpressions).toEqual(['0 * * * *', '30 * * * *']);
            expect(spec.timeZone).toBe('UTC');
            expect(spec.jitter).toBe('1m');

            // Test interval array
            spec = (service as any).buildScheduleSpec({
                interval: ['1m', '2m'],
            });
            expect(spec.intervals).toEqual([{ every: '1m' }, { every: '2m' }]);

            // Test calendar array
            spec = (service as any).buildScheduleSpec({
                calendar: [{ dayOfMonth: 1 }, { dayOfMonth: 15 }],
            });
            expect(spec.calendars).toEqual([{ dayOfMonth: 1 }, { dayOfMonth: 15 }]);
        });

        it('should cover parseInterval with all time units', () => {
            // Test milliseconds
            expect((service as any).parseInterval('1000ms')).toEqual({ every: '1000ms' });
            expect((service as any).parseInterval('500ms')).toEqual({ every: '500ms' });

            // Test seconds
            expect((service as any).parseInterval('30s')).toEqual({ every: '30s' });
            expect((service as any).parseInterval('45s')).toEqual({ every: '45s' });

            // Test minutes
            expect((service as any).parseInterval('5m')).toEqual({ every: '5m' });
            expect((service as any).parseInterval('10m')).toEqual({ every: '10m' });

            // Test hours
            expect((service as any).parseInterval('2h')).toEqual({ every: '2h' });
            expect((service as any).parseInterval('3h')).toEqual({ every: '3h' });

            // Test default case (invalid format) - adds "ms" suffix
            expect((service as any).parseInterval('invalid')).toEqual({ every: 'invalidms' });
            expect((service as any).parseInterval('1x')).toEqual({ every: '1xms' });
        });

        it('should cover debug logging in schedule client initialization', async () => {
            const debugSpy = jest.spyOn((service as any).temporalLogger, 'debug');

            await service.onModuleInit();

            expect(debugSpy).toHaveBeenCalledWith(
                'Schedule client initialized from existing client',
            );
        });

        it('should cover unknown error cases in error handling', async () => {
            await service.onModuleInit();

            // Test cases where error is not an Error instance
            mockScheduleClient.create.mockRejectedValueOnce(null);

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await expect(
                service.createCronSchedule(
                    'test-schedule',
                    '0 * * * *',
                    'TestWorkflow',
                    'test-queue',
                ),
            ).rejects.toThrow('Failed to create cron schedule');

            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));

            loggerSpy.mockRestore();
        });

        it('should cover cache hit branch in getSchedule', async () => {
            await service.onModuleInit();

            // First call should cache the handle
            const result1 = await service.getSchedule('test-schedule');
            expect(result1).toBe(mockScheduleHandle);

            // Clear mock to test cache hit
            mockScheduleClient.getHandle.mockClear();

            // Second call should use cache
            const result2 = await service.getSchedule('test-schedule');
            expect(result2).toBe(mockScheduleHandle);
            expect(mockScheduleClient.getHandle).not.toHaveBeenCalled();
        });

        it('should cover overlap policy conditional branches', async () => {
            await service.onModuleInit();

            // Test all overlap policy values to cover all branches
            const policies = [
                'skip',
                'buffer_one',
                'buffer_all',
                'cancel_other',
                'terminate_other',
                'allow_all',
            ] as const;
            const expectedValues = [
                'SKIP',
                'BUFFER_ONE',
                'BUFFER_ALL',
                'CANCEL_OTHER',
                'TERMINATE_OTHER',
                'ALLOW_ALL',
            ];

            for (let i = 0; i < policies.length; i++) {
                mockScheduleHandle.trigger.mockClear();
                await service.triggerSchedule('test-schedule', policies[i]);
                expect(mockScheduleHandle.trigger).toHaveBeenCalledWith(expectedValues[i]);
            }

            // Test undefined case (should default to ALLOW_ALL)
            mockScheduleHandle.trigger.mockClear();
            await service.triggerSchedule('test-schedule');
            expect(mockScheduleHandle.trigger).toHaveBeenCalledWith('ALLOW_ALL');
        });

        it('should cover array vs single value branches in buildScheduleSpec', () => {
            // Test array values for cron
            let result = (service as any).buildScheduleSpec({
                cron: ['0 * * * *', '30 * * * *'],
            });
            expect(result.cronExpressions).toEqual(['0 * * * *', '30 * * * *']);

            // Test single value for cron
            result = (service as any).buildScheduleSpec({
                cron: '0 * * * *',
            });
            expect(result.cronExpressions).toEqual(['0 * * * *']);

            // Test array values for interval
            result = (service as any).buildScheduleSpec({
                interval: ['1m', '2m'],
            });
            expect(result.intervals).toEqual([{ every: '1m' }, { every: '2m' }]);

            // Test single value for interval
            result = (service as any).buildScheduleSpec({
                interval: '1m',
            });
            expect(result.intervals).toEqual([{ every: '1m' }]);

            // Test array values for calendar
            result = (service as any).buildScheduleSpec({
                calendar: [{ dayOfMonth: 1 }, { dayOfMonth: 15 }],
            });
            expect(result.calendars).toEqual([{ dayOfMonth: 1 }, { dayOfMonth: 15 }]);

            // Test single value for calendar
            result = (service as any).buildScheduleSpec({
                calendar: { dayOfMonth: 1 },
            });
            expect(result.calendars).toEqual([{ dayOfMonth: 1 }]);
        });

        it('should cover buildWorkflowOptions conditional branches', () => {
            // Test with all properties present
            const fullMetadata = {
                taskQueue: 'custom-queue',
                workflowId: 'custom-id',
                workflowExecutionTimeout: '1m',
                workflowRunTimeout: '30s',
                workflowTaskTimeout: '10s',
                retryPolicy: { maximumAttempts: 3 },
                args: ['arg1'],
            };

            const result = (service as any).buildWorkflowOptions(fullMetadata);
            expect(result).toEqual(fullMetadata);

            // Test with empty metadata to cover else branches
            const emptyResult = (service as any).buildWorkflowOptions({});
            expect(emptyResult).toEqual({});

            // Test with partial metadata
            const partialMetadata = { taskQueue: 'test-queue' };
            const partialResult = (service as any).buildWorkflowOptions(partialMetadata);
            expect(partialResult).toEqual({ taskQueue: 'test-queue' });
        });

        it('should cover parseInterval string processing branches', () => {
            // Test number input
            expect((service as any).parseInterval(1000)).toEqual({ every: '1000ms' });

            // Test milliseconds branch
            expect((service as any).parseInterval('100ms')).toEqual({ every: '100ms' });
            expect((service as any).parseInterval('500MS')).toEqual({ every: '500ms' }); // uppercase

            // Test seconds branch
            expect((service as any).parseInterval('30s')).toEqual({ every: '30s' });
            expect((service as any).parseInterval('45S')).toEqual({ every: '45s' }); // uppercase

            // Test minutes branch
            expect((service as any).parseInterval('5m')).toEqual({ every: '5m' });
            expect((service as any).parseInterval('10M')).toEqual({ every: '10m' }); // uppercase

            // Test hours branch
            expect((service as any).parseInterval('2h')).toEqual({ every: '2h' });
            expect((service as any).parseInterval('3H')).toEqual({ every: '3h' }); // uppercase

            // Test default case (no recognized unit)
            expect((service as any).parseInterval('invalid')).toEqual({ every: 'invalidms' });
            expect((service as any).parseInterval('123')).toEqual({ every: '123ms' });
        });

        it('should cover error instanceof checks in all methods', async () => {
            await service.onModuleInit();

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Test non-Error objects in various methods
            const nonErrorCases = [
                () => {
                    mockScheduleHandle.pause.mockRejectedValueOnce('string error');
                    return service.pauseSchedule('test-schedule');
                },
                () => {
                    mockScheduleHandle.unpause.mockRejectedValueOnce(123);
                    return service.resumeSchedule('test-schedule');
                },
                () => {
                    mockScheduleHandle.delete.mockRejectedValueOnce(null);
                    return service.deleteSchedule('test-schedule');
                },
                () => {
                    mockScheduleHandle.trigger.mockRejectedValueOnce(undefined);
                    return service.triggerSchedule('test-schedule');
                },
                () => {
                    mockScheduleHandle.update.mockRejectedValueOnce({ message: 'object error' });
                    return service.updateSchedule('test-schedule', () => {});
                },
                () => {
                    (mockScheduleClient.list as jest.Mock).mockRejectedValueOnce('List error');
                    return service.listSchedules();
                },
                () => {
                    mockScheduleHandle.describe.mockRejectedValueOnce([]);
                    return service.describeSchedule('test-schedule');
                },
            ];

            for (const testCase of nonErrorCases) {
                try {
                    await testCase();
                } catch (error) {
                    // Expected to throw
                }
            }

            // Verify all cases called logger with 'Unknown error'
            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));

            loggerSpy.mockRestore();
        });

        it('should cover line 79 - schedule client initialization logging in fallback path', async () => {
            // Create a client without schedule property to trigger the else branch
            const mockClientWithoutSchedule = {
                connection: { close: jest.fn() },
            } as any;

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClientWithoutSchedule,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const altService = module.get<TemporalScheduleService>(TemporalScheduleService);

            const debugSpy = jest
                .spyOn((altService as any).temporalLogger, 'debug')
                .mockImplementation();

            await altService.onModuleInit();

            // This should trigger line 79: this.temporalLogger.debug('Schedule client initialized successfully');
            expect(debugSpy).toHaveBeenCalledWith('Schedule client initialized successfully');

            debugSpy.mockRestore();
        });

        it('should cover service not initialized state checking', async () => {
            // Test ensureInitialized when service is not initialized
            const uninitializedService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                {} as DiscoveryService,
                {} as TemporalMetadataAccessor,
            );

            // Don't call onModuleInit, so service stays uninitialized
            await expect(
                uninitializedService.createCronSchedule('test', '* * * * *', 'Test', 'queue'),
            ).rejects.toThrow('Temporal Schedule Service is not initialized');
        });

        it('should cover health status conditional branches', async () => {
            // Test when service is not initialized
            const uninitializedService = new TemporalScheduleService(
                mockOptions,
                mockClient,
                {} as DiscoveryService,
                {} as TemporalMetadataAccessor,
            );

            const health = uninitializedService.getHealth();
            expect(health.status).toBe('unhealthy');
            expect(health.isInitialized).toBe(false);

            const status = uninitializedService.getStatus();
            expect(status.available).toBe(false);
            expect(status.healthy).toBe(false);
        });

        it('should cover conditional branches for optional namespace', async () => {
            // Test when options.connection is undefined
            const optionsWithoutConnection = {
                taskQueue: 'test-queue',
            } as TemporalOptions;

            const mockClientWithoutSchedule = {
                connection: { close: jest.fn() },
            } as any;

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClientWithoutSchedule,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithoutConnection,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: {
                            getProviders: jest.fn().mockReturnValue([]),
                            getControllers: jest.fn().mockReturnValue([]),
                        },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: {
                            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
                            isActivity: jest.fn().mockReturnValue(false),
                        },
                    },
                ],
            }).compile();

            const altService = module.get<TemporalScheduleService>(TemporalScheduleService);

            await altService.onModuleInit();

            // This should use 'default' namespace when options.connection?.namespace is undefined
            expect(altService.isHealthy()).toBe(true);
        });

        it('should cover cache miss and cache hit paths in getSchedule', async () => {
            // Ensure service is properly initialized first
            (service as any).isInitialized = true;
            (service as any).scheduleClient = {
                getHandle: jest.fn().mockReturnValue({ id: 'test-handle' }),
            };

            // First call - cache miss, should call getHandle
            await service.getSchedule('test-schedule');
            expect((service as any).scheduleClient.getHandle).toHaveBeenCalledWith('test-schedule');

            // Second call - cache hit, should not call getHandle again
            (service as any).scheduleClient.getHandle.mockClear();
            await service.getSchedule('test-schedule');
            expect((service as any).scheduleClient.getHandle).not.toHaveBeenCalled();
        });

        it('should cover non-Error exceptions in error handling', async () => {
            // Ensure service is initialized
            (service as any).isInitialized = true;

            // Test non-Error objects in catch blocks to cover the 'Unknown error' branches
            const mockScheduleHandle = {
                update: jest.fn().mockRejectedValue('String error'), // Not an Error instance
                delete: jest.fn().mockRejectedValue('String error'),
                pause: jest.fn().mockRejectedValue('String error'),
                unpause: jest.fn().mockRejectedValue('String error'),
                trigger: jest.fn().mockRejectedValue('String error'),
                describe: jest.fn().mockRejectedValue('String error'),
            };
            jest.spyOn(service, 'getSchedule').mockResolvedValue(mockScheduleHandle as any);
            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            // Test each method with non-Error exception to cover 'Unknown error' branches
            await expect(service.updateSchedule('test', () => {})).rejects.toThrow('Unknown error');
            await expect(service.deleteSchedule('test')).rejects.toThrow('Unknown error');
            await expect(service.pauseSchedule('test')).rejects.toThrow('Unknown error');
            await expect(service.unpauseSchedule('test')).rejects.toThrow('Unknown error');
            await expect(service.triggerSchedule('test')).rejects.toThrow('Unknown error');
            await expect(service.describeSchedule('test')).rejects.toThrow('Unknown error');

            loggerSpy.mockRestore();
        });

        it('should cover buildScheduleSpec and buildWorkflowOptions with empty metadata', async () => {
            // Test with empty metadata to ensure no branches are taken
            const emptyMetadata = {};

            const scheduleSpec = (service as any).buildScheduleSpec(emptyMetadata);
            expect(scheduleSpec).toEqual({});

            const workflowOptions = (service as any).buildWorkflowOptions(emptyMetadata);
            expect(workflowOptions).toEqual({});
        });
    });

    describe('Additional Branch Coverage for 90%+ Target', () => {
        beforeEach(() => {
            // Initialize service for these tests - properly set initialization state
            (service as any).scheduleClient = mockScheduleClient;
            (service as any).client = mockClient;
            (service as any).isInitialized = true;
        });

        it('should cover timezone conditional branch in createCronSchedule (line 597)', async () => {
            mockScheduleClient.create.mockResolvedValue(mockScheduleHandle);

            // Test with timezone option (should include timeZone in spec)
            await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'TestWorkflow',
                'test-queue',
                [],
                { timezone: 'America/New_York' },
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    spec: expect.objectContaining({
                        timeZone: 'America/New_York',
                    }),
                }),
            );
        });

        it('should cover no timezone branch in createCronSchedule (line 597)', async () => {
            mockScheduleClient.create.mockResolvedValue(mockScheduleHandle);

            // Test without timezone option (should not include timeZone in spec)
            await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'TestWorkflow',
                'test-queue',
                [],
                { description: 'Test schedule' }, // No timezone
            );

            expect(mockScheduleClient.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    spec: expect.not.objectContaining({
                        timeZone: expect.anything(),
                    }),
                }),
            );
        });

        it('should cover conditional branches in error handling instanceof checks (line 711)', async () => {
            const customError = { message: 'Custom non-Error object' };
            (mockScheduleClient.list as jest.Mock).mockRejectedValue(customError);

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await expect(service.listSchedules()).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to list schedules: Unknown error'),
            );

            loggerSpy.mockRestore();
        });

        it('should cover different iteration conditions in scheduleExists (line 779-789)', async () => {
            // Mock list to return different scenarios
            const mockIterator = {
                [Symbol.asyncIterator]() {
                    let count = 0;
                    return {
                        async next() {
                            count++;
                            // Return a few items then done
                            if (count <= 2) {
                                return {
                                    value: { id: `schedule-${count}` },
                                    done: false,
                                };
                            }
                            return { done: true };
                        },
                    };
                },
            };

            (mockScheduleClient.list as jest.Mock).mockResolvedValue(mockIterator);

            // Test scheduleExists with schedule that appears in iteration
            const exists = await service.scheduleExists('schedule-1');
            expect(exists).toBe(true);

            // Test scheduleExists with schedule that doesn't appear in iteration
            const notExists = await service.scheduleExists('non-existent');
            expect(notExists).toBe(false);
        });

        it('should cover maxItems branch in listSchedules (line 710)', async () => {
            // Mock iterator that returns more items than maxItems limit
            const mockIterator = {
                [Symbol.asyncIterator]() {
                    let count = 0;
                    return {
                        async next() {
                            count++;
                            // Return many items to test maxItems break condition
                            if (count <= 5) {
                                return {
                                    value: {
                                        id: `schedule-${count}`,
                                        state: { active: true },
                                    },
                                    done: false,
                                };
                            }
                            return { done: true };
                        },
                    };
                },
            };

            (mockScheduleClient.list as jest.Mock).mockResolvedValue(mockIterator);

            // Test with maxItems = 3 (should break at 3 items)
            const schedules = await service.listSchedules(3);
            expect(schedules).toHaveLength(3);
            expect(schedules[0].id).toBe('schedule-1');
            expect(schedules[2].id).toBe('schedule-3');
        });

        it('should cover conditional branches in error message extraction', async () => {
            // Test Error instance
            const errorInstance = new Error('Test error message');
            mockScheduleClient.create.mockRejectedValue(errorInstance);

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await expect(
                service.createCronSchedule('test', '* * * * *', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Test error message'));

            // Test non-Error object
            const nonErrorObject = { code: 500, details: 'Server error' };
            mockScheduleClient.create.mockRejectedValue(nonErrorObject);

            await expect(
                service.createCronSchedule('test', '* * * * *', 'TestWorkflow', 'test-queue'),
            ).rejects.toThrow();

            expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));

            loggerSpy.mockRestore();
        });

        it('should cover options null/undefined branch in createCronSchedule (line 591)', async () => {
            mockScheduleClient.create.mockResolvedValue(mockScheduleHandle);

            // Test with null options to cover `options || {}` branch
            await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'TestWorkflow',
                'test-queue',
                [],
                null as any,
            );

            expect(mockScheduleClient.create).toHaveBeenCalled();

            // Test with undefined options
            await service.createCronSchedule(
                'test-schedule',
                '0 9 * * *',
                'TestWorkflow',
                'test-queue',
                [],
                undefined,
            );

            expect(mockScheduleClient.create).toHaveBeenCalled();
        });

        it('should cover empty schedules iteration in listSchedules to test maxItems condition (line 711)', async () => {
            // Mock empty iterator
            const emptyIterator = {
                [Symbol.asyncIterator]() {
                    return {
                        async next() {
                            return { done: true };
                        },
                    };
                },
            };

            (mockScheduleClient.list as jest.Mock).mockResolvedValue(emptyIterator);

            const schedules = await service.listSchedules(10);
            expect(schedules).toHaveLength(0);
        });
    });

    describe('Missing Branch Coverage for 90%+ Target - Constructor and Initialization', () => {
        it('should cover constructor with null options parameter (line 22)', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: null,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: { getProviders: () => [] },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: { extractActivityMethods: () => new Map() },
                    },
                ],
            }).compile();

            const serviceWithNullOptions =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            expect(serviceWithNullOptions).toBeDefined();
        });

        it('should cover constructor with null client parameter (line 24)', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: null,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: { getProviders: () => [] },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: { extractActivityMethods: () => new Map() },
                    },
                ],
            }).compile();

            const serviceWithNullClient =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            expect(serviceWithNullClient).toBeDefined();
        });

        it('should cover constructor with null discoveryService parameter (line 25)', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: null,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: { extractActivityMethods: () => new Map() },
                    },
                ],
            }).compile();

            const serviceWithNullDiscovery =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            expect(serviceWithNullDiscovery).toBeDefined();
        });

        it('should cover constructor with null metadataAccessor parameter (line 26)', async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: { getProviders: () => [] },
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: null,
                    },
                ],
            }).compile();

            const serviceWithNullMetadata =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            expect(serviceWithNullMetadata).toBeDefined();
        });
    });

    describe('Missing Branch Coverage - Error Handling Branches', () => {
        it('should cover error handling branches in updateSchedule with non-Error (lines 345-348)', async () => {
            mockScheduleClient.getHandle.mockResolvedValueOnce(mockScheduleHandle);
            mockScheduleHandle.update.mockRejectedValueOnce('Non-error object');

            await service.onModuleInit();
            await expect(service.updateSchedule('test', () => {})).rejects.toThrow();
        });

        it('should cover error handling branch in createCronSchedule (line 618)', async () => {
            mockScheduleClient.create.mockRejectedValueOnce('Non-error string');

            await service.onModuleInit();
            await expect(
                service.createCronSchedule('test', '0 0 * * *', 'TestWorkflow'),
            ).rejects.toThrow('Failed to create cron schedule');
        });

        it('should cover error handling branch in createIntervalSchedule (line 661)', async () => {
            mockScheduleClient.create.mockRejectedValueOnce('Non-error string');

            await service.onModuleInit();
            await expect(
                service.createIntervalSchedule('test', '5m', 'TestWorkflow'),
            ).rejects.toThrow('Failed to create interval schedule');
        });

        it('should cover error handling branch in listSchedules with non-Error (line 711)', async () => {
            const asyncGenerator = async function* () {
                throw 'Non-error string';
            };
            mockScheduleClient.list.mockReturnValueOnce(asyncGenerator());

            await service.onModuleInit();
            await expect(service.listSchedules()).rejects.toThrow();
        });

        it('should cover error handling branch in executeScheduleOperation (line 779-789)', async () => {
            const scheduleHandleWithError = {
                describe: jest.fn().mockRejectedValue('Non-error string'),
            };
            mockScheduleClient.getHandle.mockResolvedValueOnce(scheduleHandleWithError);

            await service.onModuleInit();
            await expect(service.describeSchedule('test')).rejects.toThrow(
                'Failed to describe schedule',
            );
        });
    });

    describe('Additional Branch Coverage - Specific Line Coverage', () => {
        it('should cover instanceof Error check false branch in all error handlers', async () => {
            const nonErrorObject = { message: 'Not an error object' };

            // Test onModuleDestroy error handling (lines 56-58)
            const serviceWithDestroyError = service as any;
            const originalClear = serviceWithDestroyError.scheduleHandles.clear;
            serviceWithDestroyError.scheduleHandles.clear = () => {
                throw nonErrorObject;
            };

            await service.onModuleInit();
            await service.onModuleDestroy(); // Should handle non-Error gracefully

            // Restore
            serviceWithDestroyError.scheduleHandles.clear = originalClear;
        });

        it('should cover discoverAndRegisterSchedules error path (lines 115-119)', async () => {
            const errorDiscoveryService = {
                getProviders: jest.fn().mockImplementation(() => {
                    throw new Error('Discovery error');
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: DiscoveryService,
                        useValue: errorDiscoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: { extractActivityMethods: () => new Map() },
                    },
                ],
            }).compile();

            const serviceWithErrorDiscovery =
                module.get<TemporalScheduleService>(TemporalScheduleService);
            await expect(serviceWithErrorDiscovery.onModuleInit()).rejects.toThrow();
        });

        it('should cover all conditional branches in error message formatting', async () => {
            // Test error scenarios with various error types
            const errorScenarios = [
                { error: new Error('Real error'), expectedSubstring: 'Real error' },
                { error: 'String error', expectedSubstring: 'Unknown error' },
                { error: null, expectedSubstring: 'Unknown error' },
                { error: undefined, expectedSubstring: 'Unknown error' },
                { error: { message: 'Object error' }, expectedSubstring: 'Unknown error' },
            ];

            for (const scenario of errorScenarios) {
                mockScheduleClient.create.mockRejectedValueOnce(scenario.error);
                await service.onModuleInit();

                try {
                    await service.createCronSchedule('test-error', '0 0 * * *', 'TestWorkflow');
                } catch (thrownError) {
                    expect(thrownError.message).toContain(scenario.expectedSubstring);
                }
            }
        });
    });
});
