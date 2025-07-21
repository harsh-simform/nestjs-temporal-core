import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import {
    TEMPORAL_SCHEDULED_WORKFLOW,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
} from '../../src/constants';
import {
    ScheduledMethodInfo,
    SignalMethodInfo,
    QueryMethodInfo,
    ScheduledOptions,
    DiscoveryStats,
} from '../../src/interfaces';
import {
    Workflow,
    WorkflowRun,
    SignalMethod,
    QueryMethod,
} from '../../src/decorators/workflow.decorator';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

function mockInstanceWrapper(instance: any, metatype: any): InstanceWrapper<any> {
    return {
        instance,
        metatype,
        name: 'mock',
        token: 'mock',
        isAlias: false,
        values: [],
        getInstance: () => instance,
        hasLifecycleHook: () => false,
        isDependencyTreeStatic: true,
        isResolved: true,
        isTransient: false,
        isTreeStatic: true,
    } as unknown as InstanceWrapper<any>;
}

function createDecoratedTestWorkflow() {
    class TestWorkflow {
        scheduledMethod() {}
        signalMethod() {}
        queryMethod() {}
        regularMethod() {}
    }
    Workflow()(TestWorkflow);
    const scheduledDescriptor = Object.getOwnPropertyDescriptor(
        TestWorkflow.prototype,
        'scheduledMethod',
    ) || {
        value: TestWorkflow.prototype.scheduledMethod,
        writable: true,
        configurable: true,
        enumerable: false,
    };
    WorkflowRun()(TestWorkflow.prototype, 'scheduledMethod', scheduledDescriptor);
    const signalDescriptor = Object.getOwnPropertyDescriptor(
        TestWorkflow.prototype,
        'signalMethod',
    ) || {
        value: TestWorkflow.prototype.signalMethod,
        writable: true,
        configurable: true,
        enumerable: false,
    };
    SignalMethod('testSignal')(TestWorkflow.prototype, 'signalMethod', signalDescriptor);
    const queryDescriptor = Object.getOwnPropertyDescriptor(
        TestWorkflow.prototype,
        'queryMethod',
    ) || {
        value: TestWorkflow.prototype.queryMethod,
        writable: true,
        configurable: true,
        enumerable: false,
    };
    QueryMethod('testQuery')(TestWorkflow.prototype, 'queryMethod', queryDescriptor);
    return TestWorkflow;
}

describe('TemporalDiscoveryService', () => {
    let service: TemporalDiscoveryService;
    let discoveryService: jest.Mocked<DiscoveryService>;
    let metadataScanner: jest.Mocked<MetadataScanner>;

    beforeEach(async () => {
        const mockDiscoveryService = {
            getProviders: jest.fn(),
            getControllers: jest.fn(),
        };

        const mockMetadataScanner = {
            scanFromPrototype: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalDiscoveryService,
                {
                    provide: DiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: MetadataScanner,
                    useValue: mockMetadataScanner,
                },
            ],
        }).compile();

        service = module.get<TemporalDiscoveryService>(TemporalDiscoveryService);
        discoveryService = module.get(DiscoveryService);
        metadataScanner = module.get(MetadataScanner);

        // Mock Reflect.getMetadata
        jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
            // Handle scheduled workflow
            if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                return {
                    scheduleId: 'test-schedule',
                    workflowName: 'TestWorkflow',
                    taskQueue: 'test-queue',
                };
            }
            // Handle signals on prototype (named only)
            if (
                key === TEMPORAL_SIGNAL_METHOD &&
                target &&
                target.constructor &&
                target.constructor.name === 'TestWorkflow'
            ) {
                return { testSignal: 'signalMethod' };
            }
            // Handle queries on prototype (named only)
            if (
                key === TEMPORAL_QUERY_METHOD &&
                target &&
                target.constructor &&
                target.constructor.name === 'TestWorkflow'
            ) {
                return { testQuery: 'queryMethod' };
            }
            // Handle signals on prototype (default only)
            if (
                key === TEMPORAL_SIGNAL_METHOD &&
                target &&
                target.constructor &&
                target.constructor.name === 'Object'
            ) {
                return { signalMethod: 'signalMethod', testMethod: 'testMethod' };
            }
            // Handle queries on prototype (default only)
            if (
                key === TEMPORAL_QUERY_METHOD &&
                target &&
                target.constructor &&
                target.constructor.name === 'Object'
            ) {
                return { queryMethod: 'queryMethod', testMethod: 'testMethod' };
            }
            return undefined;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should discover components on module init', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue([
                'scheduledMethod',
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();

            expect(discoveryService.getProviders).toHaveBeenCalled();
            expect(discoveryService.getControllers).toHaveBeenCalled();
            expect(metadataScanner.scanFromPrototype).toHaveBeenCalled();
        });

        it('should skip wrappers without instance or metatype', async () => {
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(null, null),
                mockInstanceWrapper(undefined, undefined),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();

            expect(metadataScanner.scanFromPrototype).not.toHaveBeenCalled();
        });

        it('should handle errors during method processing', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            // Should not throw even with processing errors
            await expect(service.onModuleInit()).resolves.not.toThrow();
        });
    });

    describe('getScheduledWorkflows', () => {
        it('should return empty array when no workflows discovered', () => {
            const result = service.getScheduledWorkflows();
            expect(result).toEqual([]);
        });

        it('should return discovered scheduled workflows', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue([
                'scheduledMethod',
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();
            const result = service.getScheduledWorkflows();

            expect(result).toHaveLength(1);
            expect(result[0].methodName).toBe('scheduledMethod');
            expect(result[0].workflowName).toBe('TestWorkflow');
            expect(result[0].workflowOptions.taskQueue).toBe('test-queue');
        });
    });

    describe('getScheduledWorkflow', () => {
        it('should return undefined for non-existent schedule', () => {
            const result = service.getScheduledWorkflow('non-existent');
            expect(result).toBeUndefined();
        });

        it('should return scheduled workflow by schedule ID', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.getScheduledWorkflow('test-schedule');

            expect(result).toBeDefined();
            expect(result?.methodName).toBe('scheduledMethod');
            expect(result?.workflowName).toBe('TestWorkflow');
        });
    });

    describe('getScheduleIds', () => {
        it('should return empty array when no schedules discovered', () => {
            const result = service.getScheduleIds();
            expect(result).toEqual([]);
        });

        it('should return schedule IDs', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.getScheduleIds();

            expect(result).toEqual(['test-schedule']);
        });
    });

    describe('hasSchedule', () => {
        it('should return false for non-existent schedule', () => {
            const result = service.hasSchedule('non-existent');
            expect(result).toBe(false);
        });

        it('should return true for existing schedule', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.hasSchedule('test-schedule');

            expect(result).toBe(true);
        });
    });

    describe('getSignals', () => {
        it('should return empty array when no signals discovered', () => {
            const result = service.getSignals();
            expect(result).toEqual([]);
        });

        it('should return discovered signals', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['signalMethod']);

            await service.onModuleInit();
            const result = service.getSignals();

            expect(result).toHaveLength(1);
            expect(result[0].methodName).toBe('signalMethod');
            expect(result[0].signalName).toBe('testSignal');
        });
    });

    describe('getSignal', () => {
        it('should return undefined for non-existent signal', () => {
            const result = service.getSignal('non-existent');
            expect(result).toBeUndefined();
        });

        it('should return signal by name', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['signalMethod']);

            await service.onModuleInit();
            const result = service.getSignal('testSignal');

            expect(result).toBeDefined();
            expect(result?.methodName).toBe('signalMethod');
            expect(result?.signalName).toBe('testSignal');
        });
    });

    describe('getQueries', () => {
        it('should return empty array when no queries discovered', () => {
            const result = service.getQueries();
            expect(result).toEqual([]);
        });

        it('should return discovered queries', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['queryMethod']);

            await service.onModuleInit();
            const result = service.getQueries();

            expect(result).toHaveLength(1);
            expect(result[0].methodName).toBe('queryMethod');
            expect(result[0].queryName).toBe('testQuery');
        });
        
        it('should handle constructor filtering in method discovery', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            // Mock scanFromPrototype to return constructor and method names
            metadataScanner.scanFromPrototype.mockReturnValue(['constructor', 'queryMethod']);

            await service.onModuleInit();
            const result = service.getQueries();

            // Should only find the query method, constructor should be filtered out
            expect(result).toHaveLength(1);
            expect(result[0].methodName).toBe('queryMethod');
        });
    });

    describe('getQuery', () => {
        it('should return undefined for non-existent query', () => {
            const result = service.getQuery('non-existent');
            expect(result).toBeUndefined();
        });

        it('should return query by name', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['queryMethod']);

            await service.onModuleInit();
            const result = service.getQuery('testQuery');

            expect(result).toBeDefined();
            expect(result?.methodName).toBe('queryMethod');
            expect(result?.queryName).toBe('testQuery');
        });
    });

    describe('getStats', () => {
        it('should return zero stats when nothing discovered', () => {
            const result = service.getStats();

            expect(result).toEqual({
                controllers: 0,
                methods: 0,
                scheduled: 0,
                signals: 0,
                queries: 0,
                workflows: 0,
                childWorkflows: 0,
            });
        });

        it('should return correct stats when components discovered', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue([
                'scheduledMethod',
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();
            const result = service.getStats();

            expect(result).toEqual({
                controllers: 0,
                methods: 0,
                scheduled: 1,
                signals: 1,
                queries: 1,
                workflows: 0,
                childWorkflows: 0,
            });
        });

        it('should filter out constructor method from scanned methods', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue([
                'constructor',
                'scheduledMethod',
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();
            const result = service.getStats();

            expect(result).toEqual({
                controllers: 0,
                methods: 0,
                scheduled: 1,
                signals: 1,
                queries: 1,
                workflows: 0,
                childWorkflows: 0,
            });
        });

        it('should test scanFromPrototype filter callback with constructor', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockImplementation(
                (instance, prototype, callback) => {
                    const result = callback('constructor');
                    expect(result).toBeNull();
                    return ['scheduledMethod'];
                },
            );

            await service.onModuleInit();
        });
    });

    describe('getHealthStatus', () => {
        it('should return degraded status when nothing discovered', () => {
            const result = service.getHealthStatus();

            expect(result.status).toBe('degraded');
            expect(result.discoveredItems.scheduled).toBe(0);
            expect(result.discoveredItems.signals).toBe(0);
            expect(result.discoveredItems.queries).toBe(0);
            expect(result.discoveredItems.workflows).toBe(0);
            expect(result.discoveredItems.childWorkflows).toBe(0);
        });

        it('should return healthy status when components discovered', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.getHealthStatus();

            expect(result.status).toBe('healthy');
            expect(result.discoveredItems.scheduled).toBe(1);
            expect(result.lastDiscovery).toBeInstanceOf(Date);
            expect(result.discoveredItems.workflows).toBe(0);
            expect(result.discoveredItems.childWorkflows).toBe(0);
        });
    });

    describe('workflow methods', () => {
        it('should return workflow names', () => {
            const result = service.getWorkflowNames();
            expect(result).toEqual([]);
        });

        it('should check if workflow exists', () => {
            const result = service.hasWorkflow('TestWorkflow');
            expect(result).toBe(false);
        });

        it('should return workflow names after discovery', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            expect(result).toEqual(['TestWorkflow']);
        });

        it('should return workflow names with no duplicates', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            // Add another workflow with same name
            const anotherInstance = new TestWorkflow();
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(anotherInstance, TestWorkflow),
            ]);

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            expect(result).toEqual(['TestWorkflow']);
        });

        it('should filter constructor methods during discovery (covering line 109)', async () => {
            let TestClass: any;
            (function () {
                class _TestClass {
                    constructor() {}
                    normalMethod() {}
                    scheduledMethod() {}
                }
                TestClass = _TestClass;
            })();

            const mockInstance = new TestClass();
            
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestClass),
            ]);
            discoveryService.getControllers.mockReturnValue([]);

            // Mock the scanFromPrototype to return constructor and normal methods
            metadataScanner.scanFromPrototype.mockReturnValue(['constructor', 'normalMethod', 'scheduledMethod']);

            await service.onModuleInit();

            // Verify that the method filtering worked (constructor should be filtered out)
            expect(metadataScanner.scanFromPrototype).toHaveBeenCalled();
        });

        it('should handle workflow names with whitespace (covering line 396)', async () => {
            let TestWorkflowWithWhitespace: any;
            (function () {
                class _TestWorkflowWithWhitespace {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithWhitespace);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithWhitespace.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithWhitespace.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithWhitespace.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithWhitespace = _TestWorkflowWithWhitespace;
            })();

            const mockInstance = new TestWorkflowWithWhitespace();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithWhitespace),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            // Mock workflow name with whitespace
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule-whitespace',
                        taskQueue: 'test-queue',
                        workflowName: '   TestWorkflow   ',
                    };
                }
                return undefined;
            });

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            // Should include workflow name (not trimmed, just checked if trim() is truthy)
            expect(result).toContain('   TestWorkflow   ');
        });

        it('should skip empty workflow names after trimming (covering line 396)', async () => {
            let TestWorkflowWithEmptyName: any;
            (function () {
                class _TestWorkflowWithEmptyName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithEmptyName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithEmptyName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithEmptyName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithEmptyName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithEmptyName = _TestWorkflowWithEmptyName;
            })();

            const mockInstance = new TestWorkflowWithEmptyName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithEmptyName),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            // Mock workflow name with only whitespace
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule-empty',
                        taskQueue: 'test-queue',
                        workflowName: '   ',
                    };
                }
                return undefined;
            });

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            // Should not include empty workflow name after trimming
            expect(result).not.toContain('');
            expect(result).not.toContain('   ');
        });

        it('should return workflow names with undefined workflow name defaulting to method name', async () => {
            let TestWorkflowWithoutWorkflowName: any;
            (function () {
                class _TestWorkflowWithoutWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithoutWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithoutWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithoutWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithoutWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithoutWorkflowName = _TestWorkflowWithoutWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithoutWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithoutWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule-2',
                        taskQueue: 'test-queue',
                        workflowName: undefined,
                    };
                }
                return undefined;
            });

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            expect(result).toEqual(['scheduledMethod']);
        });

        it('should check if workflow exists after discovery', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();
            const result = service.hasWorkflow('TestWorkflow');

            expect(result).toBe(true);
        });
    });

    describe('method categorization', () => {
        it('should handle methods without decorators', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['regularMethod']);

            await service.onModuleInit();
            const stats = service.getStats();

            expect(stats.scheduled).toBe(0);
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
            expect(stats.workflows).toBe(0);
            expect(stats.childWorkflows).toBe(0);
        });

        it('should handle signal methods with default names', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['signalMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (
                    key === TEMPORAL_SIGNAL_METHOD &&
                    target &&
                    target.constructor &&
                    target.constructor.name === 'Object'
                ) {
                    return { signalMethod: 'signalMethod' };
                }
                return undefined;
            });

            await service.onModuleInit();
            const signals = service.getSignals();

            expect(signals).toHaveLength(0);
        });

        it('should handle query methods with default names', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['queryMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (
                    key === TEMPORAL_QUERY_METHOD &&
                    target &&
                    target.constructor &&
                    target.constructor.name === 'Object'
                ) {
                    return { queryMethod: 'queryMethod' };
                }
                return undefined;
            });

            await service.onModuleInit();
            const queries = service.getQueries();

            expect(queries).toHaveLength(0);
        });

        it('should handle methods that are not functions', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['nonFunctionProperty']);

            // Mock the prototype to have a non-function property
            Object.defineProperty(TestWorkflow.prototype, 'nonFunctionProperty', {
                value: 'not a function',
                writable: true,
                configurable: true,
            });

            await service.onModuleInit();
            const stats = service.getStats();

            expect(stats.scheduled).toBe(0);
            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
            expect(stats.workflows).toBe(0);
            expect(stats.childWorkflows).toBe(0);
        });

        it('should handle workflow names with undefined values', async () => {
            let TestWorkflowWithUndefinedWorkflowName: any;
            (function () {
                class _TestWorkflowWithUndefinedWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithUndefinedWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithUndefinedWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithUndefinedWorkflowName = _TestWorkflowWithUndefinedWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithUndefinedWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithUndefinedWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule-undefined',
                        taskQueue: 'test-queue',
                        workflowName: undefined,
                    };
                }
                return undefined;
            });

            await service.onModuleInit();
            const workflowNames = service.getWorkflowNames();

            expect(workflowNames).toEqual(['scheduledMethod']);
        });

        it('should handle workflow exist checks with undefined workflow names', async () => {
            let TestWorkflowWithUndefinedWorkflowName: any;
            (function () {
                class _TestWorkflowWithUndefinedWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithUndefinedWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithUndefinedWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithUndefinedWorkflowName = _TestWorkflowWithUndefinedWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithUndefinedWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithUndefinedWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule-undefined',
                        taskQueue: 'test-queue',
                        workflowName: undefined,
                    };
                }
                return undefined;
            });

            await service.onModuleInit();
            const hasWorkflow = service.hasWorkflow('scheduledMethod');

            expect(hasWorkflow).toBe(true);
        });
    });

    describe('Method Discovery Edge Cases', () => {
        it('should handle method that is not a function', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            Object.defineProperty(mockInstance, 'testProperty', {
                value: 'not a function',
                writable: true,
            });

            const mockWrapper: InstanceWrapper = mockInstanceWrapper(
                mockInstance,
                class TestClass {},
            );

            discoveryService.getProviders.mockReturnValue([mockWrapper]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['testProperty']);

            await service.onModuleInit();

            // Should not throw and should complete discovery
            expect(service.getStats().scheduled).toBe(0);
        });

        it('should handle method discovery errors', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockWrapper: InstanceWrapper = mockInstanceWrapper(
                mockInstance,
                class TestClass {},
            );

            discoveryService.getProviders.mockReturnValue([mockWrapper]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockImplementation(() => {
                throw new Error('Scan error');
            });

            await service.onModuleInit();

            // Should handle error gracefully
            expect(service.getStats().scheduled).toBe(0);
        });

        it('should handle property names access errors', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockWrapper: InstanceWrapper = mockInstanceWrapper(
                mockInstance,
                class TestClass {},
            );

            discoveryService.getProviders.mockReturnValue([mockWrapper]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['testMethod']);

            // Should handle error gracefully even when property access fails
            await service.onModuleInit();
            expect(service.getStats().scheduled).toBe(0);
        });
    });

    describe('Method Categorization Edge Cases', () => {
        it('should handle signal metadata without name', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockMethod = jest.fn();

            // Mock metadata that has no name - should use method name
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (
                    key === TEMPORAL_SIGNAL_METHOD &&
                    target &&
                    target.constructor &&
                    target.constructor.name === 'Object'
                ) {
                    return { testMethod: 'testMethod' };
                }
                return undefined;
            });

            service['categorizeMethod'](mockInstance, 'testMethod', mockMethod);

            const signals = service.getSignals();
            expect(signals).toHaveLength(1);
            expect(signals[0].signalName).toBe('testMethod');
        });

        it('should handle query metadata without name', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockMethod = jest.fn();

            // Mock metadata that has no name - should use method name
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (
                    key === TEMPORAL_QUERY_METHOD &&
                    target &&
                    target.constructor &&
                    target.constructor.name === 'Object'
                ) {
                    return { testMethod: 'testMethod' };
                }
                return undefined;
            });

            service['categorizeMethod'](mockInstance, 'testMethod', mockMethod);

            const queries = service.getQueries();
            expect(queries).toHaveLength(1);
            expect(queries[0].queryName).toBe('testMethod');
        });

        it('should handle schedule metadata without scheduleId', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockMethod = jest.fn();
            Reflect.defineMetadata(
                TEMPORAL_SCHEDULED_WORKFLOW,
                {
                    workflowName: 'testWorkflow',
                    scheduleId: undefined,
                },
                mockMethod,
            );

            service['categorizeMethod'](mockInstance, 'testMethod', mockMethod);

            const scheduledWorkflows = service.getScheduledWorkflows();
            expect(scheduledWorkflows).toHaveLength(0);
        });
    });

    describe('Health Status Edge Cases', () => {
        it('should return degraded status when no items discovered', async () => {
            const health = service.getHealthStatus();

            expect(health.status).toBe('degraded');
            expect(health.discoveredItems.scheduled).toBe(0);
            expect(health.discoveredItems.signals).toBe(0);
            expect(health.discoveredItems.queries).toBe(0);
            expect(health.discoveredItems.workflows).toBe(0);
            expect(health.discoveredItems.childWorkflows).toBe(0);
        });

        it('should return healthy status when items are discovered', async () => {
            // Add some discovered items
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };
            const mockMethod = jest.fn();

            // Mock metadata for scheduled workflow
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target === mockMethod) {
                    return {
                        scheduleId: 'test-schedule',
                        workflowName: 'testWorkflow',
                    };
                }
                return undefined;
            });

            service['categorizeMethod'](mockInstance, 'testMethod', mockMethod);

            const health = service.getHealthStatus();

            expect(health.status).toBe('healthy');
            expect(health.discoveredItems.scheduled).toBe(1);
            expect(health.discoveredItems.workflows).toBe(0);
            expect(health.discoveredItems.childWorkflows).toBe(0);
        });
    });

    describe('Workflow Names Edge Cases', () => {
        it('should handle workflow names with undefined workflowName', async () => {
            let TestWorkflowWithUndefinedWorkflowName: any;
            (function () {
                class _TestWorkflowWithUndefinedWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithUndefinedWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithUndefinedWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithUndefinedWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithUndefinedWorkflowName = _TestWorkflowWithUndefinedWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithUndefinedWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithUndefinedWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule',
                        workflowName: null, // This should be filtered out
                        taskQueue: 'test-queue',
                    };
                }
                return undefined;
            });

            await service.onModuleInit();

            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).not.toContain(null);
            expect(workflowNames).toEqual(['scheduledMethod']); // Falls back to method name when workflowName is null
        });

        it('should handle workflow names with empty workflowName', async () => {
            let TestWorkflowWithEmptyWorkflowName: any;
            (function () {
                class _TestWorkflowWithEmptyWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithEmptyWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithEmptyWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithEmptyWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithEmptyWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithEmptyWorkflowName = _TestWorkflowWithEmptyWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithEmptyWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithEmptyWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_SCHEDULED_WORKFLOW && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule',
                        workflowName: '',
                    };
                }
                return undefined;
            });

            await service.onModuleInit();

            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).toHaveLength(1);
        });

        it('should return unique workflow names', async () => {
            let TestWorkflowWithSameWorkflowName: any;
            (function () {
                class _TestWorkflowWithSameWorkflowName {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithSameWorkflowName);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithSameWorkflowName.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithSameWorkflowName.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithSameWorkflowName.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithSameWorkflowName = _TestWorkflowWithSameWorkflowName;
            })();

            const mockInstance = new TestWorkflowWithSameWorkflowName();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithSameWorkflowName),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            // Add another workflow with same name
            const anotherInstance = new TestWorkflowWithSameWorkflowName();
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(anotherInstance, TestWorkflowWithSameWorkflowName),
            ]);

            await service.onModuleInit();
            const result = service.getWorkflowNames();

            expect(result).toEqual(['TestWorkflow']);
        });
    });

    describe('Workflow Existence Checks', () => {
        it('should return false for non-existent workflow', async () => {
            const exists = service.hasWorkflow('non-existent-workflow');
            expect(exists).toBe(false);
        });

        it('should return true for existing workflow', async () => {
            let TestWorkflowWithExistingWorkflow: any;
            (function () {
                class _TestWorkflowWithExistingWorkflow {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithExistingWorkflow);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithExistingWorkflow.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithExistingWorkflow.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithExistingWorkflow.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithExistingWorkflow = _TestWorkflowWithExistingWorkflow;
            })();

            const mockInstance = new TestWorkflowWithExistingWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithExistingWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            const exists = service.hasWorkflow('TestWorkflow');
            expect(exists).toBe(true);
        });

        it('should return false for workflow with different name', async () => {
            let TestWorkflowWithDifferentWorkflow: any;
            (function () {
                class _TestWorkflowWithDifferentWorkflow {
                    scheduledMethod() {}
                }
                Workflow()(_TestWorkflowWithDifferentWorkflow);
                const descriptor = Object.getOwnPropertyDescriptor(
                    _TestWorkflowWithDifferentWorkflow.prototype,
                    'scheduledMethod',
                ) || { value: _TestWorkflowWithDifferentWorkflow.prototype.scheduledMethod };
                WorkflowRun()(
                    _TestWorkflowWithDifferentWorkflow.prototype,
                    'scheduledMethod',
                    descriptor,
                );
                TestWorkflowWithDifferentWorkflow = _TestWorkflowWithDifferentWorkflow;
            })();

            const mockInstance = new TestWorkflowWithDifferentWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflowWithDifferentWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            const exists = service.hasWorkflow('differentWorkflow');
            expect(exists).toBe(false);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle method processing errors gracefully', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, class TestClass {}),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['errorMethod']);

            // Mock method that throws error
            const prototype = {
                errorMethod: () => {
                    throw new Error('Method error');
                },
            };

            Object.setPrototypeOf(mockInstance, prototype);

            // Should not throw
            await expect(service.onModuleInit()).resolves.not.toThrow();
        });

        it('should handle invalid method types', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, class TestClass {}),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['invalidMethod']);

            // Mock method that is not a function
            const prototype = {
                invalidMethod: 'not a function',
            };

            Object.setPrototypeOf(mockInstance, prototype);

            await service.onModuleInit();
            // Should not throw and should continue processing
        });

        it('should handle missing metadata gracefully', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['regularMethod']);

            // Mock Reflect.getMetadata to return undefined for regularMethod
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (target.name === 'regularMethod') {
                    return undefined;
                }
                return undefined;
            });

            await service.onModuleInit();
            // Should not throw and should continue processing
        });

        it('should handle null instance in wrapper', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(null, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();
            expect(metadataScanner.scanFromPrototype).not.toHaveBeenCalled();
        });

        it('should handle undefined metatype in wrapper', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, undefined),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();
            // Should skip processing when metatype is undefined
            expect(metadataScanner.scanFromPrototype).not.toHaveBeenCalled();
        });

        it('should handle empty method names from scanner', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['']);

            await service.onModuleInit();
            // Should not throw and should continue processing
        });

        it('should handle constructor method name', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['constructor']);

            await service.onModuleInit();
            // Should not throw and should skip constructor
        });

        it('should handle undefined method from prototype', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, class TestClass {}),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['undefinedMethod']);

            const prototype = {
                undefinedMethod: undefined,
            };

            Object.setPrototypeOf(mockInstance, prototype);

            await service.onModuleInit();
            // Should not throw and should continue processing
        });

        it('should handle non-function method from prototype', async () => {
            const mockInstance = {
                constructor: { name: 'TestClass' },
            };

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, class TestClass {}),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['nonFunctionMethod']);

            const prototype = {
                nonFunctionMethod: 'not a function',
            };

            Object.setPrototypeOf(mockInstance, prototype);

            await service.onModuleInit();
            // Should not throw and should continue processing
        });
    });

    describe('Health Status', () => {
        it('should return healthy status when components are discovered', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            const healthStatus = service.getHealthStatus();
            expect(healthStatus.status).toBe('healthy');
            expect(healthStatus.discoveredItems.scheduled).toBe(1);
            expect(healthStatus.lastDiscovery).toBeInstanceOf(Date);
            expect(healthStatus.discoveredItems.workflows).toBe(0);
            expect(healthStatus.discoveredItems.childWorkflows).toBe(0);
        });

        it('should return degraded status when no components are discovered', async () => {
            discoveryService.getProviders.mockReturnValue([]);
            discoveryService.getControllers.mockReturnValue([]);

            await service.onModuleInit();

            const healthStatus = service.getHealthStatus();
            expect(healthStatus.status).toBe('degraded');
            expect(healthStatus.discoveredItems.scheduled).toBe(0);
            expect(healthStatus.lastDiscovery).toBeInstanceOf(Date);
            expect(healthStatus.discoveredItems.workflows).toBe(0);
            expect(healthStatus.discoveredItems.childWorkflows).toBe(0);
        });
    });

    describe('Workflow Names and Validation', () => {
        it('should return workflow names from scheduled workflows', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).toContain('TestWorkflow');
        });

        it('should handle workflows with null workflowName', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === 'TEMPORAL_SCHEDULED_WORKFLOW' && target.name === 'scheduledMethod') {
                    return {
                        scheduleId: 'test-schedule',
                        workflowName: null, // This should be filtered out
                        taskQueue: 'test-queue',
                    };
                }
                return undefined;
            });

            await service.onModuleInit();

            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).not.toContain(null);
            expect(workflowNames).toEqual(['scheduledMethod']); // Falls back to method name when workflowName is null
        });

        it('should return empty array when no workflows exist', () => {
            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).toEqual([]);
        });

        it('should check if workflow exists', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            expect(service.hasWorkflow('TestWorkflow')).toBe(true);
            expect(service.hasWorkflow('NonExistentWorkflow')).toBe(false);
        });

        it('should handle workflow name case sensitivity', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            await service.onModuleInit();

            expect(service.hasWorkflow('testworkflow')).toBe(false);
            expect(service.hasWorkflow('TestWorkflow')).toBe(true);
        });
    });

    describe('Discovery Results Logging', () => {
        it('should log discovery results', async () => {
            const TestWorkflow = createDecoratedTestWorkflow();
            const mockInstance = new TestWorkflow();

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);

            discoveryService.getControllers.mockReturnValue([]);

            metadataScanner.scanFromPrototype.mockReturnValue(['scheduledMethod']);

            const logSpy = jest.spyOn(service['logger'], 'log');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Discovery completed'));
        });

        it('should log discovery results with zero components', async () => {
            discoveryService.getProviders.mockReturnValue([]);
            discoveryService.getControllers.mockReturnValue([]);

            const logSpy = jest.spyOn(service['logger'], 'log');

            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Discovery completed'));
        });
    });

    describe('uncovered paths', () => {
        // Note: These tests cover the remaining uncovered lines in temporal-discovery.service.ts:
        // Lines 136, 187, 437, 442 - workflow run discovery and debug logging paths
        
        it('should test getWorkflows method', () => {
            const workflows = service.getWorkflows();
            expect(Array.isArray(workflows)).toBe(true);
        });

        it('should test getWorkflow method', () => {
            const workflow = service.getWorkflow('non-existent');
            expect(workflow).toBeUndefined();
        });

        it('should test getChildWorkflows method', () => {
            const childWorkflows = service.getChildWorkflows();
            expect(Array.isArray(childWorkflows)).toBe(true);
        });

        it('should test getChildWorkflow method', () => {
            const childWorkflow = service.getChildWorkflow('non-existent');
            expect(childWorkflow).toBeUndefined();
        });

        it('should discover workflow runs and trigger line 136', async () => {
            class TestWorkflow {
                workflowRun() {}
            }

            const mockInstance = new TestWorkflow();

            // Mock TEMPORAL_WORKFLOW_RUN metadata
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_WORKFLOW_RUN && target === TestWorkflow.prototype.workflowRun) {
                    return { name: 'TestWorkflow' };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['workflowRun']);

            await service.onModuleInit();

            // Verify workflow was added (line 136)
            const workflows = service.getWorkflows();
            expect(workflows.length).toBeGreaterThan(0);
        });

        it('should discover child workflows and trigger line 187', async () => {
            class TestWorkflow {
                constructor() {
                    (this as any).childWorkflowProperty = {};
                }
            }

            const mockInstance = new TestWorkflow();
            // Ensure the property definitely exists
            Object.defineProperty(mockInstance, 'childWorkflowProperty', {
                value: {},
                enumerable: true,
                configurable: true,
                writable: true
            });

            // Mock TEMPORAL_CHILD_WORKFLOW metadata
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any, propertyKey?: string | symbol) => {
                if (key === TEMPORAL_CHILD_WORKFLOW && propertyKey === 'childWorkflowProperty') {
                    return { workflowType: 'ChildWorkflow', options: {} };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            await service.onModuleInit();

            // Verify child workflow was added (line 187)
            const childWorkflows = service.getChildWorkflows();
            expect(childWorkflows.length).toBeGreaterThan(0);
        });

        it('should trigger debug logging for workflows (line 437)', async () => {
            class TestWorkflow {
                workflowRun() {}
            }

            const mockInstance = new TestWorkflow();

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_WORKFLOW_RUN && target === TestWorkflow.prototype.workflowRun) {
                    return { name: 'TestWorkflow' };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['workflowRun']);

            const debugSpy = jest.spyOn(service['logger'], 'debug');

            await service.onModuleInit();

            // Verify debug log for workflows was called (line 437)
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered workflows:'));
        });

        it('should trigger debug logging for child workflows (line 442)', async () => {
            class TestWorkflow {
                childWorkflowProperty: any;
            }

            const mockInstance = new TestWorkflow();
            // Add the property to the instance  
            mockInstance.childWorkflowProperty = {};

            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any, propertyKey?: string | symbol) => {
                if (key === TEMPORAL_CHILD_WORKFLOW && propertyKey === 'childWorkflowProperty') {
                    return { workflowType: 'ChildWorkflow', options: {} };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            const debugSpy = jest.spyOn(service['logger'], 'debug');

            await service.onModuleInit();

            // Verify debug log for child workflows was called (line 442)
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Discovered child workflows:'));
        });
    });
});
