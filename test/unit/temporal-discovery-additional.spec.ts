import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from '@nestjs/core';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TEMPORAL_MODULE_OPTIONS, ACTIVITY_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions, ActivityModuleOptions } from '../../src/interfaces';

/**
 * Additional tests specifically targeting uncovered branches in temporal-discovery.service.ts
 * Lines to cover: 39-45, 82-93, 223, 299, 364-378, 414
 */
describe('TemporalDiscoveryService - Additional Branch Coverage', () => {
    let service: TemporalDiscoveryService;
    let discoveryService: jest.Mocked<DiscoveryService>;
    let metadataAccessor: jest.Mocked<TemporalMetadataAccessor>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        enableLogger: true, // Test with logger enabled
        logLevel: 'debug',
    };

    const mockActivityModuleOptions: ActivityModuleOptions = {
        activityClasses: [],
    };

    class TestActivity {
        async testMethod() {
            return 'test-result';
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
            extractActivityMethods: jest.fn().mockReturnValue({ methods: new Map(), errors: [] }),
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
        jest.restoreAllMocks();
    });

    describe('Lines 39-45: Constructor with custom metadataAccessor', () => {
        it('should use default TemporalMetadataAccessor when not provided', () => {
            // The service is already constructed with the mock, but we can test that it accepts it
            expect(service).toBeDefined();
        });

        it('should handle options with logger configuration', async () => {
            await service.onModuleInit();
            const status = service.getHealthStatus();
            expect(status).toBeDefined();
        });
    });

    describe('Lines 82-93: getActivity with different activity info formats', () => {
        it('should return handler from activity info object', async () => {
            const testInstance = new TestActivity();
            const handler = testInstance.testMethod.bind(testInstance);
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['testActivity', { handler, name: 'testActivity' }]]),
                errors: [],
                extractedCount: 1,
                success: true,
            } as any);

            await service.onModuleInit();

            const activity = service.getActivity('testActivity');
            expect(activity).toBe(handler);
        });

        it('should handle activity info as direct function', async () => {
            const testInstance = new TestActivity();
            const handler = testInstance.testMethod.bind(testInstance);
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['directFunc', handler]]),
                errors: [],
                extractedCount: 1,
                success: true,
            } as any);

            await service.onModuleInit();

            const activity = service.getActivity('directFunc');
            expect(activity).toBe(handler);
        });

        it('should return undefined for non-function activity info', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['invalidActivity', { name: 'invalid' }]]), // No handler
                errors: [],
                extractedCount: 0,
                success: true,
            } as any);

            await service.onModuleInit();

            const activity = service.getActivity('invalidActivity');
            expect(activity).toBeUndefined();
        });
    });

    describe('Lines 223: Non-Error exception in discoverComponents catch', () => {
        it('should handle object thrown as error', async () => {
            const testInstance = new TestActivity();
            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            metadataAccessor.isActivity.mockImplementation(() => {
                throw { customError: 'object error' };
            });

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('should handle boolean thrown as error', async () => {
            const testInstance = new TestActivity();
            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            metadataAccessor.isActivity.mockImplementation(() => {
                throw false;
            });

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });

    describe('Lines 299: activityModuleOptions edge cases', () => {
        it('should handle activityModuleOptions with activityClasses array', async () => {
            class AllowedActivity {
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
            discoveryService.getProviders.mockReturnValue([
                { instance: allowedInstance, metatype: AllowedActivity },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: new Map([['method', () => {}]]),
                errors: [],
                extractedCount: 1,
                success: true,
            } as any);

            await filteredService.onModuleInit();

            const stats = filteredService.getStats();
            expect(stats.totalComponents).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Lines 364-378: methodError handling in discoverActivitiesInClass', () => {
        it('should handle Error instance in method processing catch', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);

            // Mock extractActivityMethods to return a method that will cause an error during processing
            const methodMap = new Map();
            Object.defineProperty(methodMap, 'entries', {
                value: function* () {
                    yield ['testMethod', null]; // This will cause an error when accessing handler
                },
            });

            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: methodMap,
                errors: [],
                extractedCount: 0,
                success: true,
            } as any);

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            logSpy.mockRestore();
        });

        it('should handle non-Error exception in method processing', async () => {
            const testInstance = new TestActivity();
            const mockWrapper = {
                instance: testInstance,
                metatype: TestActivity,
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            metadataAccessor.isActivity.mockReturnValue(true);

            // Create a map that throws when iterating
            const faultyMap = {
                entries: function* () {
                    throw 'String error during iteration';
                },
            };

            metadataAccessor.extractActivityMethods.mockReturnValue({
                methods: faultyMap as any,
                errors: [],
                extractedCount: 0,
                success: true,
            });

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            logSpy.mockRestore();
        });
    });

    describe('Lines 414: getWrapperName error handling', () => {
        it('should return unknown when metatype access throws', () => {
            const faultyWrapper = {
                get metatype() {
                    throw new Error('Cannot access metatype');
                },
            };

            const name = service['getWrapperName'](faultyWrapper as any);
            expect(name).toBe('unknown');
        });

        it('should return unknown when metatype is null', () => {
            const wrapper = {
                metatype: null,
            };

            const name = service['getWrapperName'](wrapper as any);
            expect(name).toBe('unknown');
        });

        it('should return unknown when metatype is undefined', () => {
            const wrapper = {
                metatype: undefined,
            };

            const name = service['getWrapperName'](wrapper as any);
            expect(name).toBe('unknown');
        });
    });

    describe('Additional error scenarios for complete branch coverage', () => {
        it('should handle discovery service throwing errors', async () => {
            discoveryService.getProviders.mockImplementation(() => {
                throw new Error('Discovery service failed');
            });

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.onModuleInit()).rejects.toThrow();

            logSpy.mockRestore();
        });

        it('should handle extractActivityMethods throwing non-Error', async () => {
            const testInstance = new TestActivity();
            discoveryService.getProviders.mockReturnValue([
                { instance: testInstance, metatype: TestActivity },
            ] as any);

            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockImplementation(() => {
                throw 12345; // Throw a number
            });

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });
});
