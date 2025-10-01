import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_MODULE_OPTIONS, ACTIVITY_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions, ActivityModuleOptions } from '../../src/interfaces';

describe('TemporalDiscoveryService', () => {
    let service: TemporalDiscoveryService;
    let discoveryService: jest.Mocked<DiscoveryService>;
    let metadataAccessor: jest.Mocked<TemporalMetadataAccessor>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        enableLogger: false,
        logLevel: 'error',
    };

    const mockActivityModuleOptions: ActivityModuleOptions = {
        activityClasses: [],
    };

    // Mock activity class
    class TestActivity {
        async testMethod() {
            return 'test-result';
        }

        async anotherMethod(arg: string) {
            return `processed-${arg}`;
        }
    }

    // Mock non-activity class
    class RegularService {
        doSomething() {
            return 'regular';
        }
    }

    beforeEach(async () => {
        const mockDiscoveryService = {
            getProviders: jest.fn().mockReturnValue([]),
            getControllers: jest.fn().mockReturnValue([]),
        };

        const mockMetadataAccessor = {
            isActivity: jest.fn().mockReturnValue(false),
            validateActivityClass: jest.fn().mockReturnValue({ isValid: true, issues: [] }),
            extractActivityMethods: jest.fn().mockReturnValue({ methods: new Map(), issues: [] }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalDiscoveryService,
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: mockMetadataAccessor,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: ACTIVITY_MODULE_OPTIONS,
                    useValue: mockActivityModuleOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalDiscoveryService>(TemporalDiscoveryService);
        discoveryService = module.get(DiscoveryService);
        metadataAccessor = module.get(TemporalMetadataAccessor);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should complete discovery successfully with no components', async () => {
            await service.onModuleInit();

            const status = service.getHealthStatus();
            expect(status.isComplete).toBe(true);
            expect(status.lastDiscovery).toBeInstanceOf(Date);
        });

        it('should discover activities from providers', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', testInstance.testMethod.bind(testInstance)]]),
                issues: [],
            });

            await service.onModuleInit();

            expect(service.hasActivity('testActivity')).toBe(true);
            expect(service.getActivityNames()).toContain('testActivity');
        });

        it('should discover activities from controllers', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getControllers.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['controllerActivity', testInstance.testMethod.bind(testInstance)],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            expect(service.hasActivity('controllerActivity')).toBe(true);
        });

        it('should handle discovery errors gracefully', async () => {
            discoveryService.getProviders.mockImplementation(() => {
                throw new Error('Discovery service error');
            });

            await expect(service.onModuleInit()).rejects.toThrow('Discovery service error');
        });

        it('should log discovery duration', async () => {
            const logSpy = jest.spyOn(service['logger'], 'info');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Discovery took'));
        });

        it('should warn when no components discovered', async () => {
            const logSpy = jest.spyOn(service['logger'], 'warn');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('No Temporal components discovered'),
            );
        });
    });

    describe('getDiscoveredActivities', () => {
        it('should return copy of discovered activities map', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', testInstance.testMethod.bind(testInstance)]]),
                issues: [],
            });

            await service.onModuleInit();

            const activities = service.getDiscoveredActivities();
            expect(activities).toBeInstanceOf(Map);
            expect(activities.size).toBe(1);
            expect(activities.has('testActivity')).toBe(true);
        });

        it('should return independent copy (not reference)', async () => {
            await service.onModuleInit();

            const activities1 = service.getDiscoveredActivities();
            const activities2 = service.getDiscoveredActivities();

            expect(activities1).not.toBe(activities2);
        });
    });

    describe('getActivity', () => {
        it('should return activity handler by name', async () => {
            const testInstance = new TestActivity();
            const handler = testInstance.testMethod.bind(testInstance);
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', { handler }]]),
                issues: [],
            });

            await service.onModuleInit();

            const activity = service.getActivity('testActivity');
            expect(activity).toBeDefined();
            expect(typeof activity).toBe('function');
        });

        it('should return undefined for non-existent activity', async () => {
            await service.onModuleInit();

            const activity = service.getActivity('nonExistent');
            expect(activity).toBeUndefined();
        });

        it('should handle function-type activity info', async () => {
            const testInstance = new TestActivity();
            const handler = testInstance.testMethod.bind(testInstance);
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['directFunction', handler]]),
                issues: [],
            });

            await service.onModuleInit();

            const activity = service.getActivity('directFunction');
            expect(activity).toBe(handler);
        });
    });

    describe('getAllActivities', () => {
        it('should return all activities as handlers map', async () => {
            const testInstance = new TestActivity();
            const handler1 = testInstance.testMethod.bind(testInstance);
            const handler2 = testInstance.anotherMethod.bind(testInstance);
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['activity1', { handler: handler1 }],
                    ['activity2', { handler: handler2 }],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            const allActivities = service.getAllActivities();
            expect(Object.keys(allActivities)).toHaveLength(2);
            expect(allActivities.activity1).toBe(handler1);
            expect(allActivities.activity2).toBe(handler2);
        });

        it('should filter out non-function handlers', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['validActivity', testInstance.testMethod.bind(testInstance)],
                    ['invalidActivity', 'not-a-function' as any],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            const allActivities = service.getAllActivities();
            expect(Object.keys(allActivities)).toHaveLength(1);
            expect(allActivities.validActivity).toBeDefined();
        });

        it('should return empty object when no activities', async () => {
            await service.onModuleInit();

            const allActivities = service.getAllActivities();
            expect(allActivities).toEqual({});
        });
    });

    describe('hasActivity', () => {
        it('should return true for existing activity', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['existingActivity', testInstance.testMethod.bind(testInstance)],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            expect(service.hasActivity('existingActivity')).toBe(true);
        });

        it('should return false for non-existent activity', async () => {
            await service.onModuleInit();

            expect(service.hasActivity('nonExistent')).toBe(false);
        });
    });

    describe('getActivityNames', () => {
        it('should return array of activity names', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['activity1', testInstance.testMethod.bind(testInstance)],
                    ['activity2', testInstance.anotherMethod.bind(testInstance)],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            const names = service.getActivityNames();
            expect(names).toEqual(expect.arrayContaining(['activity1', 'activity2']));
            expect(names).toHaveLength(2);
        });

        it('should return empty array when no activities', async () => {
            await service.onModuleInit();

            const names = service.getActivityNames();
            expect(names).toEqual([]);
        });
    });

    describe('executeActivity', () => {
        it('should execute activity successfully', async () => {
            const testInstance = new TestActivity();
            const handler = jest.fn().mockResolvedValue('success');
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', handler]]),
                issues: [],
            });

            await service.onModuleInit();

            const result = await service.executeActivity('testActivity', 'arg1', 'arg2');

            expect(result.success).toBe(true);
            expect(result.result).toBe('success');
            expect(result.activityName).toBe('testActivity');
            expect(result.args).toEqual(['arg1', 'arg2']);
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
            expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should return error for non-existent activity', async () => {
            await service.onModuleInit();

            const result = await service.executeActivity('nonExistent');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toContain("Activity 'nonExistent' not found");
            expect(result.activityName).toBe('nonExistent');
        });

        it('should handle activity execution errors', async () => {
            const testInstance = new TestActivity();
            const handler = jest.fn().mockRejectedValue(new Error('Execution failed'));
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['failingActivity', handler]]),
                issues: [],
            });

            await service.onModuleInit();

            const result = await service.executeActivity('failingActivity');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Execution failed');
            expect(result.executionTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle non-Error exceptions', async () => {
            const testInstance = new TestActivity();
            const handler = jest.fn().mockRejectedValue('string error');
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['stringErrorActivity', handler]]),
                issues: [],
            });

            await service.onModuleInit();

            const result = await service.executeActivity('stringErrorActivity');

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Unknown error');
        });
    });

    describe('rediscover', () => {
        it('should clear and rediscover components', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            // Initial discovery
            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['initialActivity', testInstance.testMethod.bind(testInstance)]]),
                issues: [],
            });

            await service.onModuleInit();
            expect(service.hasActivity('initialActivity')).toBe(true);

            // Rediscovery with different activities
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['rediscoveredActivity', testInstance.anotherMethod.bind(testInstance)],
                ]),
                issues: [],
            });

            const result = await service.rediscover();

            expect(result.discoveredCount).toBe(1);
            expect(service.hasActivity('rediscoveredActivity')).toBe(true);
            expect(service.hasActivity('initialActivity')).toBe(false);
        });

        it('should update lastDiscoveryTime', async () => {
            await service.onModuleInit();

            const firstTime = service.getHealthStatus().lastDiscovery;
            await new Promise((resolve) => setTimeout(resolve, 10));

            await service.rediscover();

            const secondTime = service.getHealthStatus().lastDiscovery;
            expect(secondTime).not.toEqual(firstTime);
        });
    });

    describe('getStats', () => {
        it('should return correct statistics', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['activity1', testInstance.testMethod.bind(testInstance)],
                    ['activity2', testInstance.anotherMethod.bind(testInstance)],
                ]),
                issues: [],
            });

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.methods).toBe(2);
            expect(stats.activities).toBe(2);
            expect(stats.totalComponents).toBe(2);
        });

        it('should return zero stats when no activities', async () => {
            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.methods).toBe(0);
            expect(stats.activities).toBe(0);
            expect(stats.totalComponents).toBe(0);
        });
    });

    describe('getHealthStatus', () => {
        it('should return healthy status with discovered components', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', testInstance.testMethod.bind(testInstance)]]),
                issues: [],
            });

            await service.onModuleInit();

            const health = service.getHealthStatus();
            expect(health.status).toBe('healthy');
            expect(health.isComplete).toBe(true);
            expect(health.totalComponents).toBe(1);
            expect(health.discoveredItems.activities).toBe(1);
            expect(health.lastDiscovery).toBeInstanceOf(Date);
            expect(health.discoveryDuration).toBeGreaterThanOrEqual(0);
        });

        it('should return degraded status with no components', async () => {
            await service.onModuleInit();

            const health = service.getHealthStatus();
            expect(health.status).toBe('degraded');
            expect(health.totalComponents).toBe(0);
        });

        it('should handle null discovery times', () => {
            const health = service.getHealthStatus();
            expect(health.discoveryDuration).toBeNull();
        });
    });

    describe('processWrapper edge cases', () => {
        it('should skip wrappers without instance', async () => {
            const mockWrapper = {
                instance: null,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.totalComponents).toBe(0);
        });

        it('should skip wrappers without metatype', async () => {
            const mockWrapper = {
                instance: new TestActivity(),
                metatype: null,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.totalComponents).toBe(0);
        });

        it('should handle non-activity classes', async () => {
            const regularInstance = new RegularService();
            const mockWrapper = {
                instance: regularInstance,
                metatype: RegularService,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(false);

            await service.onModuleInit();

            expect(service.getActivityNames()).toHaveLength(0);
        });
    });

    describe('discoverActivitiesInClass', () => {
        it('should filter by activityClasses option', async () => {
            class AllowedActivity {
                method() {}
            }
            class DisallowedActivity {
                method() {}
            }

            const moduleWithFilter: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalDiscoveryService,
                    {
                        provide: DiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: metadataAccessor,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                    {
                        provide: ACTIVITY_MODULE_OPTIONS,
                        useValue: { activityClasses: [AllowedActivity] },
                    },
                ],
            }).compile();

            const filteredService =
                moduleWithFilter.get<TemporalDiscoveryService>(TemporalDiscoveryService);

            const allowedInstance = new AllowedActivity();
            const disallowedInstance = new DisallowedActivity();

            discoveryService.getProviders.mockReturnValue([
                { instance: allowedInstance, metatype: AllowedActivity },
                { instance: disallowedInstance, metatype: DisallowedActivity },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['method', () => {}]]),
                issues: [],
            });

            await filteredService.onModuleInit();

            const stats = filteredService.getStats();
            expect(stats.totalComponents).toBe(1);
        });

        it('should handle validation failures', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: false,
                issues: ['Invalid activity'],
            });

            const logSpy = jest.spyOn(service['logger'], 'warn');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('validation issues'));
        });

        it('should handle invalid handler types', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['invalidHandler', { handler: 'not-a-function' }]]),
                issues: [],
            });

            const logSpy = jest.spyOn(service['logger'], 'warn');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not a function'));
        });

        it('should handle method extraction errors', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockImplementation(() => {
                throw new Error('Extraction error');
            });

            await service.onModuleInit();

            // Should not throw, just log the error
            const stats = service.getStats();
            expect(stats.totalComponents).toBe(0);
        });
    });

    describe('getWrapperName', () => {
        it('should return wrapper metatype name', () => {
            const wrapper = {
                metatype: { name: 'TestClass' },
            };

            const name = service['getWrapperName'](wrapper as any);
            expect(name).toBe('TestClass');
        });

        it('should return unknown for wrappers without metatype', () => {
            const wrapper = {
                metatype: null,
            };

            const name = service['getWrapperName'](wrapper as any);
            expect(name).toBe('unknown');
        });

        it('should handle errors and return unknown', () => {
            const wrapper = {
                get metatype() {
                    throw new Error('Access error');
                },
            };

            const name = service['getWrapperName'](wrapper as any);
            expect(name).toBe('unknown');
        });
    });

    describe('logDiscoveryResults', () => {
        it('should log discovery errors', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: false,
                issues: ['Test error'],
            });

            const logSpy = jest.spyOn(service['logger'], 'warn');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('errors'));
        });

        it('should log discovered components at debug level', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['activity1', testInstance.testMethod.bind(testInstance)]]),
                issues: [],
            });

            const logSpy = jest.spyOn(service['logger'], 'debug');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered activities'));
        });

        it('should not log discovered activities when empty', async () => {
            const logSpy = jest.spyOn(service['logger'], 'debug');

            await service.onModuleInit();

            // Should not call debug with "Discovered activities" when none are discovered
            const debugCalls = logSpy.mock.calls.filter((call) =>
                call[0].includes('Discovered activities'),
            );
            expect(debugCalls).toHaveLength(0);
        });
    });

    describe('wrapper error handling', () => {
        it('should handle errors during wrapper processing and continue', async () => {
            const testInstance1 = new TestActivity();
            const testInstance2 = new TestActivity();

            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance1, metatype: TestActivity },
                { instance: testInstance2, metatype: TestActivity },
            ] as any);

            let callCount = 0;
            metadataAccessor.isActivity.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First wrapper error');
                }
                return true;
            });

            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    ['secondActivity', testInstance2.testMethod.bind(testInstance2)],
                ]),
                issues: [],
            });

            const logSpy = jest.spyOn(service['logger'], 'warn');

            await service.onModuleInit();

            // Check that errors were logged
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('errors'));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Error in TestActivity'));
            // Second activity should still be discovered
            expect(service.hasActivity('secondActivity')).toBe(true);
        });

        it('should handle string errors during wrapper processing', async () => {
            const testInstance = new TestActivity();

            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            metadataAccessor.isActivity.mockImplementation(() => {
                throw 'String error in wrapper';
            });

            await service.onModuleInit();

            // Service should still complete
            const status = service.getHealthStatus();
            expect(status.isComplete).toBe(true);
        });

        it('should handle not-an-activity case in discoverActivitiesInClass', async () => {
            const testInstance = new RegularService();

            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: RegularService },
            ] as any);

            // Return true for the first check (in processWrapper), false for the second (in discoverActivitiesInClass)
            let isActivityCallCount = 0;
            metadataAccessor.isActivity.mockImplementation(() => {
                isActivityCallCount++;
                return isActivityCallCount === 1; // true on first call, false on second
            });

            await service.onModuleInit();

            // Should complete successfully without discovering activities
            const status = service.getHealthStatus();
            expect(status.isComplete).toBe(true);
            const activities = service.getAllActivities();
            expect(Object.keys(activities).length).toBe(0);
        });

        it('should handle string errors during activity method processing', async () => {
            const testInstance = new TestActivity();

            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([
                    [
                        'badActivity',
                        {
                            handler: () => {
                                throw 'String error in handler';
                            },
                        },
                    ],
                ]),
                issues: [],
            });

            // Mock the Map.set to throw a string error
            const originalSet = Map.prototype.set;
            jest.spyOn(Map.prototype, 'set').mockImplementationOnce(function (
                this: Map<any, any>,
            ) {
                throw 'String error during set';
            });

            await service.onModuleInit();

            (Map.prototype.set as jest.Mock).mockRestore();

            const status = service.getHealthStatus();
            expect(status.isComplete).toBe(true);
        });

        it('should handle wrapper processing error with string error lines 222-225', async () => {
            const testInstance = new TestActivity();

            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            // Make isActivity throw a string error
            metadataAccessor.isActivity.mockImplementation(() => {
                throw 'String wrapper error';
            });

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            // Should log the error but continue
            expect(logSpy).toHaveBeenCalled();
            const status = service.getHealthStatus();
            expect(status.isComplete).toBe(true);

            logSpy.mockRestore();
        });
    });
});
