import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import {
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
    TEMPORAL_MODULE_OPTIONS,
} from '../../src/constants';
import {
    SignalMethodInfo,
    QueryMethodInfo,
    DiscoveryStats,
    TemporalOptions,
} from '../../src/interfaces';
import { SignalMethod, QueryMethod, ChildWorkflow } from '../../src/decorators/workflow.decorator';

describe('TemporalDiscoveryService', () => {
    let service: TemporalDiscoveryService;
    let discoveryService: jest.Mocked<DiscoveryService>;
    let metadataScanner: jest.Mocked<MetadataScanner>;
    let metadataAccessor: any;

    beforeEach(async () => {
        const mockDiscoveryService = {
            getProviders: jest.fn(),
            getControllers: jest.fn(),
        };

        const mockMetadataScanner = {
            scanFromPrototype: jest.fn(),
        };

        const mockTemporalOptions: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            enableLogger: true,
            logLevel: 'info',
        };

        metadataAccessor = {
            extractActivityMethods: jest.fn().mockReturnValue(new Map()),
            extractActivityMethodsFromClass: jest.fn(),
            isActivityMethod: jest.fn(),
            getActivityMethodMetadata: jest.fn(),
            getActivityMethodNames: jest.fn(),
            getActivityMethodName: jest.fn(),
            getActivityOptions: jest.fn(),
            extractMethodsFromPrototype: jest.fn(),
            getActivityInfo: jest.fn(),
            clearCache: jest.fn(),
            getCacheStats: jest.fn(),
            isActivity: jest.fn().mockReturnValue(false),
            getSignalMethods: jest.fn().mockReturnValue({}),
            getQueryMethods: jest.fn().mockReturnValue({}),
            getChildWorkflows: jest.fn().mockReturnValue({}),
            validateActivityClass: jest.fn().mockReturnValue({ isValid: true, issues: [] }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalDiscoveryService,
                { provide: DiscoveryService, useValue: mockDiscoveryService },
                { provide: MetadataScanner, useValue: mockMetadataScanner },
                { provide: TEMPORAL_MODULE_OPTIONS, useValue: mockTemporalOptions },
                { provide: TemporalMetadataAccessor, useValue: metadataAccessor },
            ],
        }).compile();

        service = module.get<TemporalDiscoveryService>(TemporalDiscoveryService);
        discoveryService = module.get(DiscoveryService);
        metadataScanner = module.get(MetadataScanner);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();

        // Clear service state to prevent test interference
        if (service) {
            (service as any).discoveredSignals?.clear();
            (service as any).discoveredQueries?.clear();
            (service as any).discoveredChildWorkflows?.clear();
            (service as any).discoveredActivities?.clear();
            // Also clear aliases
            (service as any).signals?.clear();
            (service as any).queries?.clear();
            (service as any).childWorkflows?.clear();
        }
    });

    describe('constructor', () => {
        it('should use default TemporalMetadataAccessor when not provided (lines 41-43)', () => {
            // Create a new service instance without providing metadataAccessor to trigger default initialization
            const mockDiscoveryService = {
                getProviders: jest.fn(),
                getControllers: jest.fn(),
            };

            const mockTemporalOptions: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                enableLogger: true,
                logLevel: 'info',
            };

            // Test the constructor without providing metadataAccessor (omit the 2nd parameter)
            // This tests lines 41-43 where the default parameter assignment happens
            const serviceInstance = new TemporalDiscoveryService(
                mockDiscoveryService as any,
                // Explicitly pass undefined to trigger default parameter assignment
                undefined as any,
                mockTemporalOptions,
            );

            // Verify that a default metadataAccessor was created
            expect((serviceInstance as any).metadataAccessor).toBeDefined();
            expect((serviceInstance as any).metadataAccessor).toBeInstanceOf(
                TemporalMetadataAccessor,
            );
            expect(typeof (serviceInstance as any).metadataAccessor.isActivity).toBe('function');
            expect(typeof (serviceInstance as any).metadataAccessor.getSignalMethods).toBe(
                'function',
            );
        });

        it('should initialize with different logger configurations', () => {
            const mockDiscoveryService = {
                getProviders: jest.fn(),
                getControllers: jest.fn(),
            };

            // Test with enableLogger: false
            const optionsWithDisabledLogger: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                enableLogger: false,
                logLevel: 'debug',
            };

            const serviceWithDisabledLogger = new TemporalDiscoveryService(
                mockDiscoveryService as any,
                metadataAccessor as any,
                optionsWithDisabledLogger,
            );

            expect((serviceWithDisabledLogger as any).logger).toBeDefined();

            // Test with undefined enableLogger and different logLevel
            const optionsWithUndefinedLogger: TemporalOptions = {
                connection: { address: 'localhost:7233' },
                logLevel: 'warn',
            };

            const serviceWithUndefinedLogger = new TemporalDiscoveryService(
                mockDiscoveryService as any,
                metadataAccessor as any,
                optionsWithUndefinedLogger,
            );

            expect((serviceWithUndefinedLogger as any).logger).toBeDefined();
        });
    });

    const setupBasicMocks = (
        providers: any[] = [],
        controllers: any[] = [],
        methods: string[] = [],
    ) => {
        discoveryService.getProviders.mockReturnValue(providers);
        discoveryService.getControllers.mockReturnValue(controllers);
        metadataScanner.scanFromPrototype.mockReturnValue(methods);
    };

    describe('onModuleInit', () => {
        it('should initialize and discover components', async () => {
            setupBasicMocks([], [], []);

            await service.onModuleInit();

            expect(discoveryService.getProviders).toHaveBeenCalled();
            expect(discoveryService.getControllers).toHaveBeenCalled();
        });

        it('should discover signal methods', async () => {
            class TestWorkflow {
                @SignalMethod('testSignal')
                async handleSignal(): Promise<void> {}
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], ['handleSignal']);

            // Mock the metadata accessor to return signal methods
            metadataAccessor.getSignalMethods.mockReturnValue({
                testSignal: 'handleSignal',
            });

            await service.onModuleInit();

            const signals = service.getSignals();
            expect(signals).toHaveLength(1);
            expect(signals[0].signalName).toBe('testSignal');
            expect(signals[0].methodName).toBe('handleSignal');
            expect(signals[0].className).toBe('TestWorkflow');
        });

        it('should discover query methods', async () => {
            class TestWorkflow {
                @QueryMethod('testQuery')
                getStatus(): string {
                    return 'active';
                }
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], ['getStatus']);

            // Mock the metadata accessor to return query methods
            metadataAccessor.getQueryMethods.mockReturnValue({
                testQuery: 'getStatus',
            });

            await service.onModuleInit();

            const queries = service.getQueries();
            expect(queries).toHaveLength(1);
            expect(queries[0].queryName).toBe('testQuery');
            expect(queries[0].methodName).toBe('getStatus');
            expect(queries[0].className).toBe('TestWorkflow');
        });

        it('should discover child workflows', async () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);

            // Mock the metadata accessor to return child workflows
            metadataAccessor.getChildWorkflows.mockReturnValue({
                paymentWorkflow: {
                    workflowType: PaymentWorkflow,
                    options: {},
                },
            });

            await service.onModuleInit();

            const childWorkflows = service.getChildWorkflows();
            expect(childWorkflows).toHaveLength(1);
            expect(childWorkflows[0].workflowType).toBe(PaymentWorkflow);
            expect(childWorkflows[0].className).toBe('TestWorkflow');
        });

        it('should handle empty discovery results', async () => {
            setupBasicMocks([], [], []);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
            expect(stats.workflows).toBe(0);
            expect(stats.childWorkflows).toBe(0);
        });

        it('should handle providers without instances', async () => {
            const mockWrapper = {
                instance: null,
                metatype: class TestClass {},
            };

            setupBasicMocks([mockWrapper as any], [], []);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });

        it('should handle providers without metatype', async () => {
            const mockWrapper = {
                instance: {},
                metatype: null,
            };

            setupBasicMocks([mockWrapper as any], [], []);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });

        it('should skip Object.prototype methods', async () => {
            const mockInstance = {};
            const mockWrapper = {
                instance: mockInstance,
                metatype: Object,
            };

            setupBasicMocks([mockWrapper as any], [], ['toString', 'valueOf']);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });
    });

    describe('getSignals', () => {
        it('should return all discovered signals', () => {
            const signals = service.getSignals();
            expect(Array.isArray(signals)).toBe(true);
        });
    });

    describe('getSignal', () => {
        it('should return signal by name', async () => {
            class TestWorkflow {
                @SignalMethod('testSignal')
                async handleSignal(): Promise<void> {}
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['handleSignal']);

            // Mock the metadata accessor to return signal methods
            metadataAccessor.getSignalMethods.mockReturnValue({
                testSignal: 'handleSignal',
            });

            await service.onModuleInit();

            const signal = service.getSignal('testSignal');
            expect(signal).toBeDefined();
            expect(signal?.signalName).toBe('testSignal');
        });

        it('should return undefined for non-existent signal', () => {
            const signal = service.getSignal('non-existent');
            expect(signal).toBeUndefined();
        });
    });

    describe('getQueries', () => {
        it('should return all discovered queries', () => {
            const queries = service.getQueries();
            expect(Array.isArray(queries)).toBe(true);
        });
    });

    describe('getQuery', () => {
        it('should return query by name', async () => {
            class TestWorkflow {
                @QueryMethod('testQuery')
                getStatus(): string {
                    return 'active';
                }
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['getStatus']);

            // Mock the metadata accessor to return query methods
            metadataAccessor.getQueryMethods.mockReturnValue({
                testQuery: 'getStatus',
            });

            await service.onModuleInit();

            const query = service.getQuery('testQuery');
            expect(query).toBeDefined();
            expect(query?.queryName).toBe('testQuery');
        });

        it('should return undefined for non-existent query', () => {
            const query = service.getQuery('non-existent');
            expect(query).toBeUndefined();
        });
    });

    describe('getChildWorkflows', () => {
        it('should return all discovered child workflows', () => {
            const childWorkflows = service.getChildWorkflows();
            expect(Array.isArray(childWorkflows)).toBe(true);
        });
    });

    describe('getChildWorkflow', () => {
        it('should return child workflow by property key', async () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            // Mock the metadata accessor to return child workflows
            metadataAccessor.getChildWorkflows.mockReturnValue({
                paymentWorkflow: {
                    workflowType: PaymentWorkflow,
                    options: {},
                },
            });

            await service.onModuleInit();

            const childWorkflow = service.getChildWorkflow('paymentWorkflow');
            expect(childWorkflow).toBeDefined();
            expect(childWorkflow?.workflowType).toBe(PaymentWorkflow);
        });

        it('should return undefined for non-existent child workflow', () => {
            const childWorkflow = service.getChildWorkflow('non-existent');
            expect(childWorkflow).toBeUndefined();
        });
    });

    describe('getWorkflowNames', () => {
        it('should return empty array for function-based workflows', () => {
            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).toEqual([]);
        });
    });

    describe('hasWorkflow', () => {
        it('should return false for function-based workflows', () => {
            const hasWorkflow = service.hasWorkflow('any-workflow');
            expect(hasWorkflow).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return discovery statistics', () => {
            const stats = service.getStats();
            expect(stats).toHaveProperty('controllers');
            expect(stats).toHaveProperty('methods');
            expect(stats).toHaveProperty('signals');
            expect(stats).toHaveProperty('queries');
            expect(stats).toHaveProperty('workflows');
            expect(stats).toHaveProperty('childWorkflows');
            expect(stats.workflows).toBe(0);
        });
    });

    describe('private method coverage', () => {
        it('should call logDiscoveryResults during onModuleInit', async () => {
            setupBasicMocks([], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            const logSpy = jest.spyOn(service as any, 'logDiscoveryResults').mockImplementation();

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });

        it('should log detailed results when components are found', async () => {
            class TestWorkflow {
                @SignalMethod('testSignal')
                async handleSignal(): Promise<void> {}

                @QueryMethod('testQuery')
                getStatus(): string {
                    return 'active';
                }
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['handleSignal', 'getStatus']);

            const logSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation();
            const logInfoSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

            await service.onModuleInit();

            expect(logInfoSpy).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalled();

            logSpy.mockRestore();
            logInfoSpy.mockRestore();
        });

        it('should categorize methods correctly', async () => {
            class TestWorkflow {
                @SignalMethod('testSignal')
                async handleSignal(): Promise<void> {}

                normalMethod(): void {}
            }

            const mockInstance = new TestWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: TestWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['handleSignal', 'normalMethod']);

            // Mock the metadata accessor to return signal methods for handleSignal only
            metadataAccessor.getSignalMethods.mockReturnValue({
                testSignal: 'handleSignal',
            });

            await service.onModuleInit();

            // Verify that signals were discovered (indicating categorization worked)
            const signals = service.getSignals();
            expect(signals).toHaveLength(1);
            expect(signals[0].methodName).toBe('handleSignal');
        });
    });

    describe('error handling', () => {
        it('should handle errors during discovery', async () => {
            discoveryService.getProviders.mockImplementation(() => {
                throw new Error('Discovery error');
            });

            await expect(service.onModuleInit()).rejects.toThrow('Discovery error');
        });

        it('should handle metadata scanning errors', async () => {
            const mockWrapper = {
                instance: {},
                metatype: class TestClass {},
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockImplementation(() => {
                throw new Error('Scanning error');
            });

            // Should not throw but handle the error gracefully
            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle multiple signals with same name in different classes', async () => {
            class WorkflowA {
                @SignalMethod('commonSignal')
                async handle(): Promise<void> {}
            }

            class WorkflowB {
                @SignalMethod('commonSignal')
                async handle(): Promise<void> {}
            }

            const mockWrapperA = {
                instance: new WorkflowA(),
                metatype: WorkflowA,
            };

            const mockWrapperB = {
                instance: new WorkflowB(),
                metatype: WorkflowB,
            };

            setupBasicMocks([mockWrapperA, mockWrapperB] as any);
            metadataScanner.scanFromPrototype.mockReturnValue(['handle']);

            // Mock the metadata accessor to return signal methods for both classes
            metadataAccessor.getSignalMethods.mockReturnValue({
                commonSignal: 'handle',
            });

            await service.onModuleInit();

            const signals = service.getSignals();
            // Note: Current implementation overwrites signals with same name, so only the last one survives
            expect(signals).toHaveLength(1);
            expect(signals[0].signalName).toBe('commonSignal');
            expect(signals[0].className).toBe('WorkflowB'); // Last one processed
        });

        it('should handle complex class hierarchies', async () => {
            class BaseWorkflow {
                @SignalMethod('baseSignal')
                async baseHandler(): Promise<void> {}
            }

            class DerivedWorkflow extends BaseWorkflow {
                @QueryMethod('derivedQuery')
                getStatus(): string {
                    return 'active';
                }
            }

            const mockInstance = new DerivedWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: DerivedWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['baseHandler', 'getStatus']);

            // Mock the metadata accessor to return both signal and query methods
            metadataAccessor.getSignalMethods.mockReturnValue({
                baseSignal: 'baseHandler',
            });
            metadataAccessor.getQueryMethods.mockReturnValue({
                derivedQuery: 'getStatus',
            });

            await service.onModuleInit();

            const signals = service.getSignals();
            const queries = service.getQueries();

            expect(signals).toHaveLength(1);
            expect(queries).toHaveLength(1);
            expect(signals[0].className).toBe('DerivedWorkflow');
            expect(queries[0].className).toBe('DerivedWorkflow');
        });

        it('should handle methods that are built-in Object prototype methods', async () => {
            const mockInstance = { toString: () => 'test' };
            const mockWrapper = {
                instance: mockInstance,
                metatype: Object,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([
                'toString',
                'valueOf',
                'hasOwnProperty',
            ]);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });

        it('should handle method discovery errors gracefully', async () => {
            const mockInstance = {
                problemMethod: () => 'test',
            };
            const mockWrapper = {
                instance: mockInstance,
                metatype: class TestClass {},
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue(['problemMethod']);

            // Mock Reflect.getMetadata to throw an error
            const originalGetMetadata = Reflect.getMetadata;
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key, target) => {
                if (target === mockInstance.constructor.prototype) {
                    throw new Error('Metadata error');
                }
                return originalGetMetadata(key, target);
            });

            // Should not throw but handle the error gracefully
            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);

            jest.restoreAllMocks();
        });

        it('should handle all Object.prototype methods', async () => {
            const mockInstance = {};
            const mockWrapper = {
                instance: mockInstance,
                metatype: class TestClass {},
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([
                'toString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'toLocaleString',
                '__defineGetter__',
                '__defineSetter__',
                '__lookupGetter__',
                '__lookupSetter__',
            ]);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });

        it('should discover mixed signal and query methods', async () => {
            class MixedWorkflow {
                @SignalMethod('signal1')
                async handleSignal1(): Promise<void> {}

                @SignalMethod('signal2')
                async handleSignal2(): Promise<void> {}

                @QueryMethod('query1')
                getQuery1(): string {
                    return 'test1';
                }

                @QueryMethod('query2')
                getQuery2(): string {
                    return 'test2';
                }

                regularMethod(): void {}
            }

            const mockInstance = new MixedWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: MixedWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([
                'handleSignal1',
                'handleSignal2',
                'getQuery1',
                'getQuery2',
                'regularMethod',
            ]);

            // Mock the metadata accessor to return both signal and query methods
            metadataAccessor.getSignalMethods.mockReturnValue({
                signal1: 'handleSignal1',
                signal2: 'handleSignal2',
            });
            metadataAccessor.getQueryMethods.mockReturnValue({
                query1: 'getQuery1',
                query2: 'getQuery2',
            });

            await service.onModuleInit();

            const signals = service.getSignals();
            const queries = service.getQueries();

            expect(signals).toHaveLength(2);
            expect(queries).toHaveLength(2);
            expect(signals.map((s) => s.signalName)).toEqual(['signal1', 'signal2']);
            expect(queries.map((q) => q.queryName)).toEqual(['query1', 'query2']);
        });

        it('should handle child workflow discovery with options', async () => {
            class ParentWorkflow {
                @ChildWorkflow(class PaymentWorkflow {}, { taskQueue: 'payments' })
                private paymentWorkflow: any;

                @ChildWorkflow(class InventoryWorkflow {})
                private inventoryWorkflow: any;
            }

            const mockInstance = new ParentWorkflow();
            const mockWrapper = {
                instance: mockInstance,
                metatype: ParentWorkflow,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            // Mock the metadata accessor to return child workflows with options
            metadataAccessor.getChildWorkflows.mockReturnValue({
                paymentWorkflow: {
                    workflowType: class PaymentWorkflow {},
                    options: { taskQueue: 'payments' },
                },
                inventoryWorkflow: {
                    workflowType: class InventoryWorkflow {},
                    options: {},
                },
            });

            await service.onModuleInit();

            const childWorkflows = service.getChildWorkflows();
            expect(childWorkflows).toHaveLength(2);

            const paymentWorkflow = service.getChildWorkflow('paymentWorkflow');
            expect(paymentWorkflow?.options).toEqual({ taskQueue: 'payments' });

            const inventoryWorkflow = service.getChildWorkflow('inventoryWorkflow');
            expect(inventoryWorkflow?.options).toEqual({});
        });

        it('should handle providers with undefined properties', async () => {
            const mockWrapper = {
                instance: undefined,
                metatype: undefined,
            };

            setupBasicMocks([mockWrapper as any], [], []);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            await service.onModuleInit();

            const stats = service.getStats();
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
        });
    });

    describe('Additional Coverage Tests', () => {
        beforeEach(() => {
            const mockMetadataScanner = {
                scanFromPrototype: jest.fn().mockReturnValue([]),
            };
            discoveryService.getProviders.mockReturnValue([]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner = mockMetadataScanner as any;
        });

        describe('getScheduleIds', () => {
            it('should return empty array', () => {
                const scheduleIds = service.getScheduleIds();
                expect(scheduleIds).toEqual([]);
            });
        });

        describe('getWorkflowInfo', () => {
            it('should return null for any workflow name', () => {
                const workflowInfo = service.getWorkflowInfo('TestWorkflow');
                expect(workflowInfo).toBeNull();
            });
        });

        describe('rediscover', () => {
            it('should perform complete re-discovery', async () => {
                await service.onModuleInit(); // Initial discovery

                const initialTime = service['lastDiscoveryTime'];
                const clearSpy = jest.spyOn(service as any, 'clearDiscoveredComponents');
                const discoverSpy = jest.spyOn(service as any, 'discoverComponents');
                const logSpy = jest.spyOn(service as any, 'logDiscoveryResults');

                // Wait a bit to ensure time difference
                await new Promise((resolve) => setTimeout(resolve, 10));

                await service.rediscover();

                expect(clearSpy).toHaveBeenCalled();
                expect(discoverSpy).toHaveBeenCalled();
                expect(logSpy).toHaveBeenCalled();
                expect(service['lastDiscoveryTime']).not.toEqual(initialTime);
            });
        });

        describe('getHealthStatus', () => {
            it('should return degraded status when no components discovered', async () => {
                await service.onModuleInit();

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.status).toBe('degraded');
                expect(healthStatus.discoveredItems).toBeDefined();
                expect(healthStatus.isComplete).toBe(true);
                expect(healthStatus.lastDiscovery).toBeInstanceOf(Date);
                expect(healthStatus.discoveryDuration).toBeGreaterThanOrEqual(0);
            });

            it('should return healthy status when components are discovered', async () => {
                // Mock some discovered components
                const mockProvider = {
                    name: 'TestProvider',
                    instance: { testMethod: jest.fn() },
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockProvider as any]);

                // Mock the metadata accessor to return actual discovered components
                metadataAccessor.getSignalMethods.mockReturnValue({
                    testSignal: 'testMethod',
                });
                metadataAccessor.getQueryMethods.mockReturnValue({
                    testQuery: 'testMethod',
                });
                metadataAccessor.getChildWorkflows.mockReturnValue({
                    testWorkflow: 'testMethod',
                });

                await service.onModuleInit();

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.status).toBe('healthy');
                expect(healthStatus.discoveredItems.signals).toBeGreaterThan(0);
            });

            it('should handle missing discovery times', () => {
                service['discoveryStartTime'] = null;
                service['lastDiscoveryTime'] = null;

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.discoveryDuration).toBeNull();
                expect(healthStatus.lastDiscovery).toBeNull();
            });
        });

        describe('Error handling scenarios', () => {
            it('should handle discovery errors gracefully', async () => {
                const errorProvider = {
                    name: 'ErrorProvider',
                    instance: {},
                    metatype: class ErrorClass {},
                };

                discoveryService.getProviders.mockReturnValue([errorProvider as any]);
                metadataScanner.scanFromPrototype.mockImplementation(() => {
                    throw new Error('Scan failed');
                });

                // Should not throw despite scanning error
                await service.onModuleInit();

                const stats = service.getStats();
                expect(stats).toBeDefined();
            });

            it('should handle provider without metatype', async () => {
                const providerWithoutMetatype = {
                    name: 'NoMetatypeProvider',
                    instance: {},
                    metatype: undefined,
                };

                discoveryService.getProviders.mockReturnValue([providerWithoutMetatype as any]);

                await service.onModuleInit();

                const stats = service.getStats();
                expect(stats.methods).toBe(0);
            });

            it('should handle method discovery with null descriptors', async () => {
                const mockProvider = {
                    name: 'TestProvider',
                    instance: { testMethod: jest.fn() },
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockProvider as any]);
                metadataScanner.scanFromPrototype.mockReturnValue([
                    { methodName: 'testMethod', descriptor: null },
                ]);

                await service.onModuleInit();

                const stats = service.getStats();
                expect(stats).toBeDefined();
            });
        });

        describe('Discovery completion tracking', () => {
            it('should track discovery completion correctly', async () => {
                expect(service['isDiscoveryComplete']).toBe(false);

                await service.onModuleInit();

                expect(service['isDiscoveryComplete']).toBe(true);
            });

            it('should reset completion status on rediscovery', async () => {
                await service.onModuleInit();
                expect(service['isDiscoveryComplete']).toBe(true);

                const rediscoverPromise = service.rediscover();
                expect(service['isDiscoveryComplete']).toBe(false);

                await rediscoverPromise;
                // The rediscover method doesn't set isDiscoveryComplete to true
                // It only clears it and discovers components
                expect(service['isDiscoveryComplete']).toBe(false);
            });
        });

        describe('Missing line coverage tests', () => {
            it('should test getDiscoveredActivities method (line 89)', () => {
                const activities = service.getDiscoveredActivities();
                expect(activities).toBeInstanceOf(Map);
                expect(activities.size).toBe(0);
            });

            it('should handle wrapper processing errors (line 213)', async () => {
                const mockWrapper = {
                    instance: {},
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);

                // Mock processWrapper to throw an error
                jest.spyOn(service as any, 'processWrapper').mockRejectedValueOnce(
                    new Error('Processing failed'),
                );
                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to process wrapper TestClass',
                    expect.any(Error),
                );
            });

            it('should discover activities when isActivity returns true (line 234)', async () => {
                const mockInstance = { testActivity: jest.fn() };
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class ActivityClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.isActivity.mockReturnValue(true);
                metadataAccessor.extractActivityMethods.mockReturnValue(
                    new Map([['testActivity', mockInstance.testActivity]]),
                );

                await service.onModuleInit();

                expect(metadataAccessor.extractActivityMethods).toHaveBeenCalledWith(mockInstance);
            });

            it('should handle undefined method handlers in signal discovery (line 272)', async () => {
                const mockInstance = {
                    existingMethod: jest.fn(),
                    // Missing undefinedMethod to test optional chaining
                };
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class SignalClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.getSignalMethods.mockReturnValue({
                    testSignal: 'existingMethod',
                    nullSignal: 'undefinedMethod', // This method doesn't exist
                });

                await service.onModuleInit();

                const signals = service.getSignals();
                expect(signals).toHaveLength(2);

                const existingSignal = signals.find((s) => s.signalName === 'testSignal');
                const nullSignal = signals.find((s) => s.signalName === 'nullSignal');

                expect(existingSignal?.handler).toBeDefined();
                expect(nullSignal?.handler).toBeUndefined(); // Tests the optional chaining path
            });

            it('should handle undefined method handlers in query discovery (line 293)', async () => {
                const mockInstance = {
                    existingQuery: jest.fn(),
                    // Missing undefinedQuery to test optional chaining
                };
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class QueryClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.getQueryMethods.mockReturnValue({
                    testQuery: 'existingQuery',
                    nullQuery: 'undefinedQuery', // This method doesn't exist
                });

                await service.onModuleInit();

                const queries = service.getQueries();
                expect(queries).toHaveLength(2);

                const existingQuery = queries.find((q) => q.queryName === 'testQuery');
                const nullQuery = queries.find((q) => q.queryName === 'nullQuery');

                expect(existingQuery?.handler).toBeDefined();
                expect(nullQuery?.handler).toBeUndefined(); // Tests the optional chaining path
            });

            it('should handle wrapper without instance or metatype (line 225)', async () => {
                const wrapperWithoutInstance = { metatype: class TestClass {} };
                const wrapperWithoutMetatype = { instance: {} };
                const wrapperWithNeither = {};

                discoveryService.getProviders.mockReturnValue([
                    wrapperWithoutInstance as any,
                    wrapperWithoutMetatype as any,
                    wrapperWithNeither as any,
                ]);

                // Should not throw and should complete successfully
                await service.onModuleInit();

                const stats = service.getStats();
                expect(stats.controllers).toBe(0);
                expect(stats.signals).toBe(0);
                expect(stats.queries).toBe(0);
            });

            it('should handle discovery duration when times are set (line 186)', async () => {
                // Set specific times to test the calculation branch
                const startTime = new Date(2023, 0, 1, 10, 0, 0);
                const endTime = new Date(2023, 0, 1, 10, 0, 5); // 5 seconds later

                service['discoveryStartTime'] = startTime;
                service['lastDiscoveryTime'] = endTime;

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.discoveryDuration).toBe(5000); // 5 seconds in milliseconds
            });

            it('should handle discovery duration when only start time is set', () => {
                // Set only start time to test the null branch
                service['discoveryStartTime'] = new Date();
                service['lastDiscoveryTime'] = null;

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.discoveryDuration).toBeNull();
            });

            it('should handle discovery duration when only end time is set', () => {
                // Set only end time to test the null branch
                service['discoveryStartTime'] = null;
                service['lastDiscoveryTime'] = new Date();

                const healthStatus = service.getHealthStatus();

                expect(healthStatus.discoveryDuration).toBeNull();
            });

            it('should cover discoverActivitiesInClass method (lines 244-258)', async () => {
                const mockInstance = {
                    testActivity1: jest.fn(),
                    testActivity2: jest.fn(),
                };
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class ActivityClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.isActivity.mockReturnValue(true);
                metadataAccessor.extractActivityMethods.mockReturnValue(
                    new Map([
                        ['testActivity1', mockInstance.testActivity1],
                        ['testActivity2', mockInstance.testActivity2],
                    ]),
                );

                const debugSpy = jest.spyOn((service as any).logger, 'debug');

                await service.onModuleInit();

                expect(debugSpy).toHaveBeenCalledWith(
                    'Discovered activity: ActivityClass.testActivity1',
                );
                expect(debugSpy).toHaveBeenCalledWith(
                    'Discovered activity: ActivityClass.testActivity2',
                );

                const activities = service.getDiscoveredActivities();
                expect(activities.size).toBe(2);
            });

            it('should handle activity discovery errors (lines 244-258)', async () => {
                const mockInstance = {};
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class ActivityClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.isActivity.mockReturnValue(true);
                metadataAccessor.extractActivityMethods.mockImplementation(() => {
                    throw new Error('Activity extraction failed');
                });

                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to discover activities in ActivityClass',
                    expect.any(Error),
                );
            });

            it('should handle signal discovery errors (line 279)', async () => {
                const mockInstance = {};
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.getSignalMethods.mockImplementation(() => {
                    throw new Error('Signal discovery failed');
                });

                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to discover signals in TestClass',
                    expect.any(Error),
                );
            });

            it('should handle query discovery errors (line 301)', async () => {
                const mockInstance = {};
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.getQueryMethods.mockImplementation(() => {
                    throw new Error('Query discovery failed');
                });

                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to discover queries in TestClass',
                    expect.any(Error),
                );
            });

            it('should handle child workflow discovery errors (line 330)', async () => {
                const mockInstance = {};
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class TestClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.getChildWorkflows.mockImplementation(() => {
                    throw new Error('Child workflow discovery failed');
                });

                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to discover child workflows in TestClass',
                    expect.any(Error),
                );
            });

            it('should handle getWrapperName errors (lines 369-373)', async () => {
                const mockWrapper = {
                    instance: {},
                    // metatype will throw an error when accessed
                    get metatype() {
                        throw new Error('Metatype access error');
                    },
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);

                // Mock processWrapper to throw, which will trigger getWrapperName
                jest.spyOn(service as any, 'processWrapper').mockRejectedValueOnce(
                    new Error('Processing failed'),
                );
                const warnSpy = jest.spyOn((service as any).logger, 'warn');

                await service.onModuleInit();

                expect(warnSpy).toHaveBeenCalledWith(
                    'Failed to process wrapper unknown',
                    expect.any(Error),
                );
            });

            it('should handle getWrapperName method catch block directly (line 371)', () => {
                // Create a wrapper that will trigger the catch block in getWrapperName
                const mockWrapper = {
                    // When trying to access .metatype, it will throw an error
                    get metatype() {
                        throw new Error('Property access error');
                    },
                };

                // Call getWrapperName directly to trigger the catch block
                const result = (service as any).getWrapperName(mockWrapper);

                // Should return 'unknown' when an error occurs
                expect(result).toBe('unknown');
            });

            it('should log discovered activities (lines 397-398)', async () => {
                const mockInstance = { testActivity: jest.fn() };
                const mockWrapper = {
                    instance: mockInstance,
                    metatype: class ActivityClass {},
                };

                discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
                metadataAccessor.isActivity.mockReturnValue(true);
                metadataAccessor.extractActivityMethods.mockReturnValue(
                    new Map([['testActivity', mockInstance.testActivity]]),
                );

                const debugSpy = jest.spyOn((service as any).logger, 'debug');

                await service.onModuleInit();

                expect(debugSpy).toHaveBeenCalledWith('Discovered activities: [testActivity]');
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle default metadataAccessor injection (lines 41-43)', () => {
            // Test the default constructor case
            const serviceWithDefaults = new TemporalDiscoveryService(
                discoveryService,
                undefined, // metadataAccessor should default
                {
                    connection: { address: 'localhost:7233' },
                    enableLogger: true,
                },
            );

            expect(serviceWithDefaults).toBeDefined();
        });

        it('should handle getWrapperName with no metatype (line 371)', () => {
            const wrapperWithoutMetatype = { someProperty: 'value' };

            const result = (service as any).getWrapperName(wrapperWithoutMetatype);

            expect(result).toBe('unknown');
        });

        it('should handle getWrapperName with error (line 373)', () => {
            // Create a wrapper that will throw an error when accessing metatype
            const errorWrapper = {
                get metatype() {
                    throw new Error('Access error');
                },
            };

            const result = (service as any).getWrapperName(errorWrapper);

            expect(result).toBe('unknown');
        });

        it('should handle getWrapperName with null metatype name', () => {
            const wrapperWithNullName = {
                metatype: { name: null },
            };

            const result = (service as any).getWrapperName(wrapperWithNullName);

            expect(result).toBe('unknown');
        });

        it('should handle metadataAccessor optional injection', () => {
            // Test that metadataAccessor can be null/undefined
            const serviceWithNullAccessor = new TemporalDiscoveryService(
                discoveryService,
                null as any,
                {
                    connection: { address: 'localhost:7233' },
                    enableLogger: true,
                },
            );

            expect(serviceWithNullAccessor).toBeDefined();
        });

        it('should warn when no components are discovered (line 385)', async () => {
            // Mock empty discovery - no providers, no controllers
            discoveryService.getProviders.mockReturnValue([]);
            discoveryService.getControllers.mockReturnValue([]);

            const warnSpy = jest.spyOn((service as any).logger, 'warn');

            await service.onModuleInit();

            expect(warnSpy).toHaveBeenCalledWith(
                'No Temporal components discovered. Ensure decorators are properly applied.',
            );

            const stats = service.getStats();
            expect(stats.controllers).toBe(0);
            expect(stats.methods).toBe(0);
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
            expect(stats.workflows).toBe(0);
            expect(stats.childWorkflows).toBe(0);
        });

        it('should log discovered components when they exist (lines 396-411)', async () => {
            const mockInstance = {
                testActivity: jest.fn(),
                testSignal: jest.fn(),
                testQuery: jest.fn(),
            };
            const mockWrapper = {
                instance: mockInstance,
                metatype: class TestClass {},
            };

            discoveryService.getProviders.mockReturnValue([mockWrapper as any]);
            discoveryService.getControllers.mockReturnValue([]); // Add missing mock
            metadataAccessor.isActivity.mockReturnValue(true);
            metadataAccessor.extractActivityMethods.mockReturnValue(
                new Map([['testActivity', mockInstance.testActivity]]),
            );
            metadataAccessor.getSignalMethods.mockReturnValue({
                testSignal: 'testSignal',
            });
            metadataAccessor.getQueryMethods.mockReturnValue({
                testQuery: 'testQuery',
            });

            const debugSpy = jest.spyOn((service as any).logger, 'debug');

            await service.onModuleInit();

            expect(debugSpy).toHaveBeenCalledWith('Discovered activities: [testActivity]');
            expect(debugSpy).toHaveBeenCalledWith('Discovered signals: [testSignal]');
            expect(debugSpy).toHaveBeenCalledWith('Discovered queries: [testQuery]');
        });
    });
});
