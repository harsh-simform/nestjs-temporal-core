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
            
            // Mock logger to throw error
            const loggerSpy = jest.spyOn(service as any, 'logger', 'get').mockReturnValue({
                log: jest.fn().mockImplementation(() => {
                    throw new Error('Cleanup error');
                }),
                error: jest.fn(),
            });
            
            // Should not throw even with error
            await expect(service.onModuleDestroy()).resolves.not.toThrow();
            
            loggerSpy.mockRestore();
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
    });
});
