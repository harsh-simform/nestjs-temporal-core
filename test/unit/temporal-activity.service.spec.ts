import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { TemporalActivityService } from '../../src/services/temporal-activity.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { ACTIVITY_MODULE_OPTIONS } from '../../src/constants';
import { ActivityModuleOptions, ActivityInfo } from '../../src/interfaces';

describe('TemporalActivityService', () => {
    let service: TemporalActivityService;
    let discoveryService: jest.Mocked<DiscoveryService>;
    let metadataAccessor: jest.Mocked<TemporalMetadataAccessor>;

    class TestActivity {
        testMethod() {}
    }

    class TestActivity1 {
        testMethod() {}
    }

    class TestActivity2 {
        testMethod() {}
    }

    class SpecifiedActivity {
        testMethod() {}
    }

    const mockOptions: ActivityModuleOptions = {
        activityClasses: [],
    };

    beforeEach(async () => {
        const mockDiscoveryService = {
            getProviders: jest.fn(),
        };

        const mockMetadataAccessor = {
            isActivity: jest.fn(),
            validateActivityClass: jest.fn(),
            extractActivityMethods: jest.fn(),
            getActivityMethodOptions: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalActivityService,
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: mockMetadataAccessor,
                },
                {
                    provide: ACTIVITY_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalActivityService>(TemporalActivityService);
        discoveryService = module.get(DiscoveryService);
        metadataAccessor = module.get(TemporalMetadataAccessor);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should discover activities on module init', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();

            expect(discoveryService.getProviders).toHaveBeenCalled();
            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(TestActivity);
            expect(metadataAccessor.validateActivityClass).toHaveBeenCalledWith(TestActivity);
            expect(metadataAccessor.extractActivityMethods).toHaveBeenCalledWith(mockInstance);
        });

        it('should skip providers without instance or metatype', async () => {
            discoveryService.getProviders.mockReturnValue([
                { instance: null, metatype: null },
                { instance: undefined, metatype: undefined },
            ] as any);

            await service.onModuleInit();

            expect(metadataAccessor.isActivity).not.toHaveBeenCalled();
        });

        it('should skip non-activity classes', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(false);

            await service.onModuleInit();

            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(TestActivity);
            expect(metadataAccessor.validateActivityClass).not.toHaveBeenCalled();
        });

        it('should filter by specific activity classes when provided', async () => {
            const mockInstance1 = new TestActivity1();
            mockInstance1.testMethod = jest.fn();
            const mockInstance2 = new TestActivity2();
            mockInstance2.testMethod = jest.fn();

            const optionsWithClasses: ActivityModuleOptions = {
                activityClasses: [TestActivity1],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalActivityService,
                    {
                        provide: DiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: metadataAccessor,
                    },
                    {
                        provide: ACTIVITY_MODULE_OPTIONS,
                        useValue: optionsWithClasses,
                    },
                ],
            }).compile();

            const serviceWithFilter = module.get<TemporalActivityService>(TemporalActivityService);

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance1,
                    metatype: TestActivity1,
                },
                {
                    instance: mockInstance2,
                    metatype: TestActivity2,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await serviceWithFilter.onModuleInit();

            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(TestActivity1);
            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(TestActivity2);
            expect(metadataAccessor.validateActivityClass).toHaveBeenCalledTimes(1);
            expect(metadataAccessor.validateActivityClass).toHaveBeenCalledWith(TestActivity1);
        });

        it('should handle errors during activity processing', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockImplementation(() => {
                throw new Error('Validation error');
            });

            await service.onModuleInit();

            expect(metadataAccessor.isActivity).toHaveBeenCalledWith(TestActivity);
            expect(metadataAccessor.validateActivityClass).toHaveBeenCalledWith(TestActivity);
        });

        it('should skip invalid activity classes', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: false,
                issues: ['No activity methods found'],
            });

            await service.onModuleInit();

            expect(metadataAccessor.extractActivityMethods).not.toHaveBeenCalled();
        });
    });

    describe('getDiscoveredActivities', () => {
        it('should return empty array when no activities discovered', () => {
            const result = service.getDiscoveredActivities();
            expect(result).toEqual([]);
        });

        it('should return discovered activities', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getDiscoveredActivities();

            expect(result).toHaveLength(1);
            expect(result[0].className).toBe('TestActivity');
        });
    });

    describe('getActivityByClassName', () => {
        it('should return undefined for non-existent activity', () => {
            const result = service.getActivityByClassName('NonExistent');
            expect(result).toBeUndefined();
        });

        it('should return activity info for existing activity', async () => {
            const mockInstance = new TestActivity();
            mockInstance.testMethod = jest.fn();

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', jest.fn()]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getActivityByClassName('TestActivity');

            expect(result).toBeDefined();
            expect(result?.className).toBe('TestActivity');
        });
    });

    describe('getActivityHandlers', () => {
        it('should return empty object when no activities discovered', () => {
            const result = service.getActivityHandlers();
            expect(result).toEqual({});
        });

        it('should return activity handlers', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getActivityHandlers();

            expect(result).toHaveProperty('testMethod');
            expect(result.testMethod).toBe(mockHandler);
        });
    });

    describe('getActivityHandler', () => {
        it('should return undefined for non-existent activity', () => {
            const result = service.getActivityHandler('nonExistent');
            expect(result).toBeUndefined();
        });

        it('should return handler for existing activity', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getActivityHandler('testMethod');

            expect(result).toBe(mockHandler);
        });
    });

    describe('getActivityNames', () => {
        it('should return empty array when no activities discovered', () => {
            const result = service.getActivityNames();
            expect(result).toEqual([]);
        });

        it('should return activity names', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getActivityNames();

            expect(result).toEqual(['testMethod']);
        });
    });

    describe('hasActivity', () => {
        it('should return false for non-existent activity', () => {
            const result = service.hasActivity('nonExistent');
            expect(result).toBe(false);
        });

        it('should return true for existing activity', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.hasActivity('testMethod');

            expect(result).toBe(true);
        });
    });

    describe('getActivityStats', () => {
        it('should return zero stats when no activities discovered', () => {
            const result = service.getActivityStats();

            expect(result).toEqual({
                totalClasses: 0,
                totalMethods: 0,
                classNames: [],
                methodNames: [],
            });
        });

        it('should return correct stats when activities discovered', async () => {
            const mockHandler1 = jest.fn();
            const mockHandler2 = jest.fn();
            const mockInstance = new TestActivity();
            (mockInstance as any).testMethod1 = mockHandler1;
            (mockInstance as any).testMethod2 = mockHandler2;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([
                    ['testMethod1', mockHandler1],
                    ['testMethod2', mockHandler2],
                ]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getActivityStats();

            expect(result).toEqual({
                totalClasses: 1,
                totalMethods: 2,
                classNames: ['TestActivity'],
                methodNames: ['testMethod1', 'testMethod2'],
            });
        });
    });

    describe('validateConfiguration', () => {
        it('should return warning when no activities discovered', () => {
            const result = service.validateConfiguration();

            expect(result.isValid).toBe(true);
            expect(result.issues).toEqual([]);
            expect(result.warnings).toContain(
                'No activities were discovered. Make sure classes are decorated with @Activity()',
            );
        });

        it('should detect duplicate activity names', async () => {
            const mockHandler = jest.fn();
            const mockInstance1 = new TestActivity1();
            mockInstance1.testMethod = mockHandler;
            const mockInstance2 = new TestActivity2();
            mockInstance2.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance1,
                    metatype: TestActivity1,
                },
                {
                    instance: mockInstance2,
                    metatype: TestActivity2,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods
                .mockReturnValueOnce(new Map([['testMethod', mockHandler]]))
                .mockReturnValueOnce(new Map([['testMethod', mockHandler]]));
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.validateConfiguration();

            expect(result.isValid).toBe(false);
            expect(result.issues).toContain('Duplicate activity names found: testMethod');
        });

        it('should warn about missing specified activity classes', async () => {
            const optionsWithClasses: ActivityModuleOptions = {
                activityClasses: [SpecifiedActivity],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalActivityService,
                    {
                        provide: DiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: metadataAccessor,
                    },
                    {
                        provide: ACTIVITY_MODULE_OPTIONS,
                        useValue: optionsWithClasses,
                    },
                ],
            }).compile();

            const serviceWithFilter = module.get<TemporalActivityService>(TemporalActivityService);

            discoveryService.getProviders.mockReturnValue([]);

            await serviceWithFilter.onModuleInit();
            const result = serviceWithFilter.validateConfiguration();

            expect(result.warnings).toContain(
                'Some specified activity classes were not found: SpecifiedActivity',
            );
        });

        it('should return valid configuration when everything is correct', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.validateConfiguration();

            expect(result.isValid).toBe(true);
            expect(result.issues).toEqual([]);
            expect(result.warnings).toEqual([]);
        });
    });

    describe('getHealthStatus', () => {
        it('should return unhealthy status for invalid configuration', async () => {
            const mockHandler = jest.fn();
            const mockInstance1 = new TestActivity1();
            mockInstance1.testMethod = mockHandler;
            const mockInstance2 = new TestActivity2();
            mockInstance2.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance1,
                    metatype: TestActivity1,
                },
                {
                    instance: mockInstance2,
                    metatype: TestActivity2,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods
                .mockReturnValueOnce(new Map([['testMethod', mockHandler]]))
                .mockReturnValueOnce(new Map([['testMethod', mockHandler]]));
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getHealthStatus();

            expect(result.status).toBe('unhealthy');
            expect(result.validation.isValid).toBe(false);
        });

        it('should return degraded status when no activities found', () => {
            const result = service.getHealthStatus();

            expect(result.status).toBe('degraded');
            expect(result.activities.total).toBe(0);
            expect(result.activities.registered).toBe(0);
        });

        it('should return degraded status with warnings', async () => {
            const optionsWithClasses: ActivityModuleOptions = {
                activityClasses: [SpecifiedActivity],
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalActivityService,
                    {
                        provide: DiscoveryService,
                        useValue: discoveryService,
                    },
                    {
                        provide: TemporalMetadataAccessor,
                        useValue: metadataAccessor,
                    },
                    {
                        provide: ACTIVITY_MODULE_OPTIONS,
                        useValue: optionsWithClasses,
                    },
                ],
            }).compile();

            const serviceWithFilter = module.get<TemporalActivityService>(TemporalActivityService);

            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await serviceWithFilter.onModuleInit();
            const result = serviceWithFilter.getHealthStatus();

            expect(result.status).toBe('degraded');
            expect(result.validation.warnings.length).toBeGreaterThan(0);
        });

        it('should return healthy status when everything is correct', async () => {
            const mockHandler = jest.fn();
            const mockInstance = new TestActivity();
            mockInstance.testMethod = mockHandler;

            discoveryService.getProviders.mockReturnValue([
                {
                    instance: mockInstance,
                    metatype: TestActivity,
                },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.validateActivityClass.mockReturnValue({
                isValid: true,
                issues: [],
            });
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testMethod', mockHandler]]),
            );
            metadataAccessor.getActivityMethodOptions.mockReturnValue({
                name: 'testMethod',
            });

            await service.onModuleInit();
            const result = service.getHealthStatus();

            expect(result.status).toBe('healthy');
            expect(result.validation.isValid).toBe(true);
            expect(result.activities.total).toBe(1);
            expect(result.activities.registered).toBe(1);
        });
    });
});
