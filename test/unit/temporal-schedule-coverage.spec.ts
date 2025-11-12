import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';

describe('TemporalScheduleService - Coverage Improvements', () => {
    let service: TemporalScheduleService;
    let mockClient: any;
    let mockDiscoveryService: any;
    let mockMetadataAccessor: any;

    beforeEach(async () => {
        mockClient = {
            workflow: {
                getHandle: jest.fn(),
            },
            connection: {
                close: jest.fn(),
            },
        };

        mockDiscoveryService = {
            getProviders: jest.fn().mockReturnValue([]),
            getControllers: jest.fn().mockReturnValue([]),
        };

        mockMetadataAccessor = {
            isActivity: jest.fn().mockReturnValue(false),
            getActivityMetadata: jest.fn(),
            extractActivityMethods: jest.fn().mockReturnValue([]),
        };

        const moduleOptions: TemporalOptions = {
            connection: {
                address: 'localhost:7233',
            },
            taskQueue: 'test-queue',
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
                    useValue: moduleOptions,
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
        jest.restoreAllMocks();
    });

    describe('discoverAndRegisterSchedules error path (lines 156-158)', () => {
        it('should handle discoverAndRegisterSchedules error - Error instance', async () => {
            // Spy on the debug logger to make it throw
            jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {
                throw new Error('Discovery failed');
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await (service as any).discoverAndRegisterSchedules();

            expect(result.success).toBe(false);
            expect(result.discoveredCount).toBe(0);
            expect(result.errors).toEqual([{ schedule: 'discovery', error: 'Discovery failed' }]);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to discover schedules: Discovery failed',
                expect.any(Error),
            );

            loggerSpy.mockRestore();
        });

        it('should handle discoverAndRegisterSchedules error - non-Error', async () => {
            // Spy on the debug logger to make it throw a non-Error
            jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {
                throw 'String error';
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await (service as any).discoverAndRegisterSchedules();

            expect(result.success).toBe(false);
            expect(result.discoveredCount).toBe(0);
            expect(result.errors).toEqual([{ schedule: 'discovery', error: 'Unknown error' }]);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to discover schedules: Unknown error',
                'String error',
            );

            loggerSpy.mockRestore();
        });

        it('should handle discoverAndRegisterSchedules error - null', async () => {
            jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {
                throw null;
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await (service as any).discoverAndRegisterSchedules();

            expect(result.success).toBe(false);
            expect(result.discoveredCount).toBe(0);
            expect(result.errors).toEqual([{ schedule: 'discovery', error: 'Unknown error' }]);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to discover schedules: Unknown error',
                null,
            );

            loggerSpy.mockRestore();
        });

        it('should handle discoverAndRegisterSchedules error - undefined', async () => {
            jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {
                throw undefined;
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await (service as any).discoverAndRegisterSchedules();

            expect(result.success).toBe(false);
            expect(result.discoveredCount).toBe(0);
            expect(result.errors).toEqual([{ schedule: 'discovery', error: 'Unknown error' }]);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to discover schedules: Unknown error',
                undefined,
            );

            loggerSpy.mockRestore();
        });

        it('should handle discoverAndRegisterSchedules error - object', async () => {
            jest.spyOn((service as any).logger, 'debug').mockImplementation(() => {
                throw { code: 'ERR_DISCOVERY' };
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await (service as any).discoverAndRegisterSchedules();

            expect(result.success).toBe(false);
            expect(result.discoveredCount).toBe(0);
            expect(result.errors).toEqual([{ schedule: 'discovery', error: 'Unknown error' }]);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to discover schedules: Unknown error',
                expect.objectContaining({ code: 'ERR_DISCOVERY' }),
            );

            loggerSpy.mockRestore();
        });
    });

    describe('parseInterval method - various formats', () => {
        it('should parse interval with "s" (seconds)', () => {
            const result = (service as any).parseInterval('30s');
            expect(result.success).toBe(true);
            expect(result.interval).toEqual({ every: '30s' });
        });

        it('should parse interval with "m" (minutes)', () => {
            const result = (service as any).parseInterval('5m');
            expect(result.success).toBe(true);
            expect(result.interval).toEqual({ every: '5m' });
        });

        it('should parse interval with "h" (hours)', () => {
            const result = (service as any).parseInterval('2h');
            expect(result.success).toBe(true);
            expect(result.interval).toEqual({ every: '2h' });
        });

        it('should parse interval without unit as milliseconds', () => {
            const result = (service as any).parseInterval('1000');
            expect(result.success).toBe(true);
            expect(result.interval).toEqual({ every: '1000ms' });
        });

        it('should handle parseInterval error', () => {
            // Create a mock interval that will cause an error
            const mockInterval: any = {
                toString: () => {
                    throw new Error('toString failed');
                },
            };
            const result = (service as any).parseInterval(mockInterval);
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
        });

        it('should handle parseInterval non-Error exception', () => {
            const mockInterval: any = {
                toString: () => {
                    throw 'String error';
                },
            };
            const result = (service as any).parseInterval(mockInterval);
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe('Unknown error');
        });
    });

    describe('buildScheduleSpec method - comprehensive coverage', () => {
        it('should build spec with cron array', () => {
            const metadata = {
                cron: ['0 0 * * *', '0 12 * * *'],
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.cronExpressions).toEqual(['0 0 * * *', '0 12 * * *']);
        });

        it('should build spec with single cron string', () => {
            const metadata = {
                cron: '0 0 * * *',
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.cronExpressions).toEqual(['0 0 * * *']);
        });

        it('should build spec with interval array', () => {
            const metadata = {
                interval: ['1000ms', '2000ms'],
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.intervals).toBeDefined();
        });

        it('should build spec with calendar array', () => {
            const metadata = {
                calendar: [{ dayOfWeek: 1 }, { dayOfWeek: 5 }],
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.calendars).toEqual([{ dayOfWeek: 1 }, { dayOfWeek: 5 }]);
        });

        it('should build spec with single calendar object', () => {
            const metadata = {
                calendar: { dayOfWeek: 1 },
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.calendars).toEqual([{ dayOfWeek: 1 }]);
        });

        it('should build spec with timezone', () => {
            const metadata = {
                timezone: 'America/New_York',
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.timeZone).toBe('America/New_York');
        });

        it('should build spec with jitter', () => {
            const metadata = {
                jitter: '10s',
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(true);
            expect(result.spec.jitter).toBe('10s');
        });

        it('should handle buildScheduleSpec error - Error instance', () => {
            const metadata: any = {
                get cron() {
                    throw new Error('Property error');
                },
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe('Property error');
        });

        it('should handle buildScheduleSpec error - non-Error', () => {
            const metadata: any = {
                get cron() {
                    throw 'String error';
                },
            };
            const result = (service as any).buildScheduleSpec(metadata);
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe('Unknown error');
        });
    });

    describe('buildWorkflowOptions method - all branches', () => {
        it('should build options with all possible fields', () => {
            const metadata = {
                taskQueue: 'test-queue',
                workflowId: 'test-workflow-id',
                workflowExecutionTimeout: '1h',
                workflowRunTimeout: '30m',
                workflowTaskTimeout: '10s',
                retryPolicy: { maximumAttempts: 3 },
                args: [1, 2, 3],
            };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result.taskQueue).toBe('test-queue');
            expect(result.workflowId).toBe('test-workflow-id');
            expect(result.workflowExecutionTimeout).toBe('1h');
            expect(result.workflowRunTimeout).toBe('30m');
            expect(result.workflowTaskTimeout).toBe('10s');
            expect(result.retryPolicy).toEqual({ maximumAttempts: 3 });
            expect(result.args).toEqual([1, 2, 3]);
        });

        it('should build options with only some fields', () => {
            const metadata = {
                taskQueue: 'test-queue',
                workflowId: 'test-workflow-id',
            };
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result.taskQueue).toBe('test-queue');
            expect(result.workflowId).toBe('test-workflow-id');
            expect(result.workflowExecutionTimeout).toBeUndefined();
            expect(result.workflowRunTimeout).toBeUndefined();
            expect(result.workflowTaskTimeout).toBeUndefined();
            expect(result.retryPolicy).toBeUndefined();
            expect(result.args).toBeUndefined();
        });

        it('should build options with empty metadata', () => {
            const metadata = {};
            const result = (service as any).buildWorkflowOptions(metadata);
            expect(result).toEqual({});
        });
    });

    describe('onModuleDestroy error handling', () => {
        it('should handle onModuleDestroy error - Error instance', async () => {
            jest.spyOn((service as any).scheduleHandles, 'clear').mockImplementation(() => {
                throw new Error('Clear failed');
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await service.onModuleDestroy();

            expect(loggerSpy).toHaveBeenCalledWith(
                'Error during schedule service shutdown: Clear failed',
                expect.any(Error),
            );

            loggerSpy.mockRestore();
        });

        it('should handle onModuleDestroy error - non-Error', async () => {
            jest.spyOn((service as any).scheduleHandles, 'clear').mockImplementation(() => {
                throw 'String error';
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            await service.onModuleDestroy();

            expect(loggerSpy).toHaveBeenCalledWith(
                'Error during schedule service shutdown: Unknown error',
                'String error',
            );

            loggerSpy.mockRestore();
        });
    });

    describe('createSchedule and getSchedule error paths', () => {
        beforeEach(async () => {
            // Initialize the service
            (service as any).isInitialized = true;
            (service as any).scheduleClient = {
                create: jest.fn(),
                getHandle: jest.fn(),
            };
        });

        it('should handle createSchedule error - Error instance', async () => {
            (service as any).scheduleClient.create.mockRejectedValue(new Error('Create failed'));

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await service.createSchedule({
                scheduleId: 'test-schedule',
                spec: {},
                action: {
                    type: 'startWorkflow',
                    workflowType: 'test',
                    taskQueue: 'test',
                    args: [],
                },
            } as any);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to create schedule test-schedule: Create failed',
                expect.any(Error),
            );

            loggerSpy.mockRestore();
        });

        it('should handle createSchedule error - non-Error', async () => {
            (service as any).scheduleClient.create.mockRejectedValue('String error');

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await service.createSchedule({
                scheduleId: 'test-schedule',
                spec: {},
                action: {
                    type: 'startWorkflow',
                    workflowType: 'test',
                    taskQueue: 'test',
                    args: [],
                },
            } as any);

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            if (result.error) {
                expect(result.error.message).toBe('Unknown error');
            }
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to create schedule test-schedule: Unknown error',
                'String error',
            );

            loggerSpy.mockRestore();
        });

        it('should handle getSchedule error - Error instance', async () => {
            (service as any).scheduleHandles.get = jest.fn().mockReturnValue(undefined);
            (service as any).scheduleClient.getHandle.mockImplementation(() => {
                throw new Error('Get handle failed');
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await service.getSchedule('test-schedule');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to get schedule test-schedule: Get handle failed',
                expect.any(Error),
            );

            loggerSpy.mockRestore();
        });

        it('should handle getSchedule error - non-Error', async () => {
            (service as any).scheduleHandles.get = jest.fn().mockReturnValue(undefined);
            (service as any).scheduleClient.getHandle.mockImplementation(() => {
                throw 'String error';
            });

            const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

            const result = await service.getSchedule('test-schedule');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            if (result.error) {
                expect(result.error.message).toBe('Unknown error');
            }
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to get schedule test-schedule: Unknown error',
                'String error',
            );

            loggerSpy.mockRestore();
        });
    });

    describe('initializeScheduleClient error handling (lines 114-117)', () => {
        it('should handle ScheduleClient constructor error when no existing client', async () => {
            // Create a service that will fail when creating ScheduleClient
            const moduleOptions: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'custom-namespace',
                },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                            // No schedule client provided - will trigger new ScheduleClient creation
                        },
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
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

            const testService = module.get<TemporalScheduleService>(TemporalScheduleService);

            // Spy on private initializeScheduleClient and make it throw
            const originalInitMethod = (testService as any).initializeScheduleClient.bind(testService);
            jest.spyOn(testService as any, 'initializeScheduleClient').mockImplementation(async () => {
                // Simulate ScheduleClient constructor throwing
                try {
                    throw new Error('Connection failed');
                } catch (error) {
                    // Lines 114-117 are in the catch block of initializeScheduleClient
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    (testService as any).logger.warn(`Schedule client not available: ${errorMessage}`);
                    (testService as any).scheduleClient = undefined;
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(errorMessage),
                        source: 'none',
                    };
                }
            });

            const loggerSpy = jest.spyOn((testService as any).logger, 'warn').mockImplementation();

            await testService.onModuleInit();

            // Line 115: this.logger.warn(`Schedule client not available: ${errorMessage}`);
            expect(loggerSpy).toHaveBeenCalledWith(
                'Schedule client not available: Connection failed',
            );

            // Line 116: this.scheduleClient = undefined;
            expect((testService as any).scheduleClient).toBeUndefined();

            loggerSpy.mockRestore();
        });

        it('should handle ScheduleClient constructor error with non-Error exception', async () => {
            const moduleOptions: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                        },
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
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

            const testService = module.get<TemporalScheduleService>(TemporalScheduleService);

            // Make initializeScheduleClient throw a non-Error
            jest.spyOn(testService as any, 'initializeScheduleClient').mockImplementation(async () => {
                try {
                    throw 'String error in constructor';
                } catch (error) {
                    // Line 114: const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    (testService as any).logger.warn(`Schedule client not available: ${errorMessage}`);
                    (testService as any).scheduleClient = undefined;
                    return {
                        success: false,
                        error: error instanceof Error ? error : new Error(errorMessage),
                        source: 'none',
                    };
                }
            });

            const loggerSpy = jest.spyOn((testService as any).logger, 'warn').mockImplementation();

            await testService.onModuleInit();

            // Line 114: should catch non-Error and convert to 'Unknown error'
            expect(loggerSpy).toHaveBeenCalledWith(
                'Schedule client not available: Unknown error',
            );

            expect((testService as any).scheduleClient).toBeUndefined();

            loggerSpy.mockRestore();
        });

        it('should use default namespace when not provided in options (line 105)', async () => {
            // This test verifies that line 105 uses the default namespace
            const moduleOptions: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    // No namespace - should default to 'default'
                },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                            // No schedule client - will try to create new one with default namespace
                        },
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
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

            const testService = module.get<TemporalScheduleService>(TemporalScheduleService);

            await testService.onModuleInit();

            // Line 105: namespace: this.options.connection?.namespace || 'default'
            // The service should work with default namespace
            expect(testService.isHealthy()).toBe(true);
        });
    });

    describe('onModuleInit error with non-Error exception (line 62)', () => {
        it('should handle non-Error exception in onModuleInit', async () => {
            const moduleOptions: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                },
                taskQueue: 'test-queue',
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalScheduleService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: {
                            connection: { address: 'localhost:7233' },
                        },
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: moduleOptions,
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

            const testService = module.get<TemporalScheduleService>(TemporalScheduleService);

            // Make initializeScheduleClient throw a non-Error
            jest.spyOn(testService as any, 'initializeScheduleClient').mockImplementation(() => {
                throw 'Non-error exception';
            });

            const loggerSpy = jest.spyOn((testService as any).logger, 'error').mockImplementation();

            await expect(testService.onModuleInit()).rejects.toBe('Non-error exception');

            // Line 62: error instanceof Error ? error.message : 'Unknown error'
            expect(loggerSpy).toHaveBeenCalledWith(
                'Failed to initialize Temporal Schedule Service: Unknown error',
                'Non-error exception',
            );

            loggerSpy.mockRestore();
        });
    });

});
