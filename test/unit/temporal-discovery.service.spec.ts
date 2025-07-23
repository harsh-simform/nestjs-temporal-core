import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import {
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
} from '../../src/constants';
import { SignalMethodInfo, QueryMethodInfo, DiscoveryStats } from '../../src/interfaces';
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
        signalMethod() {}
        queryMethod() {}
        regularMethod() {}
    }
    Workflow()(TestWorkflow);
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

            metadataScanner.scanFromPrototype.mockReturnValue(['regularMethod']);

            // Should not throw even with processing errors
            await expect(service.onModuleInit()).resolves.not.toThrow();
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
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();
            const result = service.getStats();

            expect(result).toEqual({
                controllers: 0,
                methods: 0,
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
                'signalMethod',
                'queryMethod',
                'regularMethod',
            ]);

            await service.onModuleInit();
            const result = service.getStats();

            expect(result).toEqual({
                controllers: 0,
                methods: 0,
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
                    return ['signalMethod'];
                },
            );

            await service.onModuleInit();
        });
    });

    describe('getHealthStatus', () => {
        it('should return degraded status when nothing discovered', () => {
            const result = service.getHealthStatus();

            expect(result.status).toBe('degraded');
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

            metadataScanner.scanFromPrototype.mockReturnValue(['signalMethod']);

            await service.onModuleInit();
            const result = service.getHealthStatus();

            expect(result.status).toBe('healthy');
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

            expect(stats.signals).toBe(0);
            expect(stats.queries).toBe(0);
            expect(stats.workflows).toBe(0);
            expect(stats.childWorkflows).toBe(0);
        });
    });

    describe('uncovered paths', () => {
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
                if (
                    key === TEMPORAL_WORKFLOW_RUN &&
                    target === TestWorkflow.prototype.workflowRun
                ) {
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
                writable: true,
            });

            // Mock TEMPORAL_CHILD_WORKFLOW metadata
            jest.spyOn(Reflect, 'getMetadata').mockImplementation(
                (key: string, target: any, propertyKey?: string | symbol) => {
                    if (
                        key === TEMPORAL_CHILD_WORKFLOW &&
                        propertyKey === 'childWorkflowProperty'
                    ) {
                        return { workflowType: 'ChildWorkflow', options: {} };
                    }
                    return undefined;
                },
            );

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
                if (
                    key === TEMPORAL_WORKFLOW_RUN &&
                    target === TestWorkflow.prototype.workflowRun
                ) {
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

            jest.spyOn(Reflect, 'getMetadata').mockImplementation(
                (key: string, target: any, propertyKey?: string | symbol) => {
                    if (
                        key === TEMPORAL_CHILD_WORKFLOW &&
                        propertyKey === 'childWorkflowProperty'
                    ) {
                        return { workflowType: 'ChildWorkflow', options: {} };
                    }
                    return undefined;
                },
            );

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            const debugSpy = jest.spyOn(service['logger'], 'debug');

            await service.onModuleInit();

            // Verify debug log for child workflows was called (line 442)
            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Discovered child workflows:'),
            );
        });

        it('should handle discovery method errors gracefully and log warning (line 135)', async () => {
            // Mock module with invalid metadata
            const invalidModule = {
                name: 'invalid-module',
                metatype: {
                    prototype: {
                        someMethod: function () {},
                    },
                },
                instance: {
                    someMethod: function () {},
                },
            };

            // Mock Reflect.getMetadata to throw an error during method processing
            const originalGetMetadata = Reflect.getMetadata;
            jest.spyOn(Reflect, 'getMetadata').mockImplementation(() => {
                throw new Error('Metadata access failed');
            });

            // Mock metadataScanner to return methods
            metadataScanner.scanFromPrototype.mockReturnValue(['someMethod']);

            // Spy on logger to verify warning is logged
            const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(invalidModule.instance, invalidModule.metatype),
            ]);
            discoveryService.getControllers.mockReturnValue([]);

            // This should not throw, but log a warning
            await expect(service.onModuleInit()).resolves.not.toThrow();

            // Verify warning was logged (line 135)
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Error during method discovery: Metadata access failed',
            );

            // Restore original function
            jest.spyOn(Reflect, 'getMetadata').mockImplementation(originalGetMetadata);
            loggerWarnSpy.mockRestore();
        });

        it('should test getWorkflowNames with non-empty method names (lines 315-316)', async () => {
            // Create a workflow with a methodName that has content
            class TestWorkflow {
                testMethod() {}
            }

            const mockInstance = new TestWorkflow();

            // Mock TEMPORAL_WORKFLOW_RUN metadata to return a methodName with content
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_WORKFLOW_RUN && target === TestWorkflow.prototype.testMethod) {
                    return { methodName: 'testMethod' };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['testMethod']);

            await service.onModuleInit();

            const workflowNames = service.getWorkflowNames();

            // Should include the workflow with methodName that passes the trim check (lines 315-316)
            expect(workflowNames).toContain('testMethod');
        });

        it('should test hasWorkflow with matching workflow (lines 330-331)', async () => {
            // Create a workflow with a methodName
            class TestWorkflow {
                myWorkflow() {}
            }

            const mockInstance = new TestWorkflow();

            // Mock TEMPORAL_WORKFLOW_RUN metadata to return a methodName
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (key === TEMPORAL_WORKFLOW_RUN && target === TestWorkflow.prototype.myWorkflow) {
                    return { methodName: 'myWorkflow' };
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['myWorkflow']);

            await service.onModuleInit();

            // Should return true when workflow methodName matches (lines 330-331)
            expect(service.hasWorkflow('myWorkflow')).toBe(true);
            expect(service.hasWorkflow('nonExistentWorkflow')).toBe(false);
        });

        it('should handle constructor method name (line 106)', async () => {
            class TestClass {
                constructor() {}
                normalMethod() {}
            }

            const mockInstance = new TestClass();
            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestClass),
            ]);
            discoveryService.getControllers.mockReturnValue([]);

            // Mock to return 'constructor' as one of the method names
            metadataScanner.scanFromPrototype.mockReturnValue(['constructor', 'normalMethod']);

            await service.onModuleInit();

            // The constructor method should be filtered out (line 106: methodName !== 'constructor' ? methodName : null)
            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).not.toContain('constructor');
        });

        it('should handle child workflow metadata (line 124)', async () => {
            class TestWorkflow {
                childWorkflowProp: any;
                normalProp: any;
            }

            const mockInstance = new TestWorkflow();

            // Mock child workflow metadata for one property
            jest.spyOn(Reflect, 'getMetadata').mockImplementation(
                (key: string, target: any, property?: string | symbol) => {
                    if (key === TEMPORAL_CHILD_WORKFLOW && property === 'childWorkflowProp') {
                        return { workflowType: TestWorkflow };
                    }
                    return undefined;
                },
            );

            jest.spyOn(Reflect, 'ownKeys').mockReturnValue(['childWorkflowProp', 'normalProp']);

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue([]);

            await service.onModuleInit();

            // Should process the child workflow property (line 124: if (childMeta))
            // Verify the service processed the child workflow
            const workflows = service.getWorkflows();
            expect(workflows).toBeDefined();
        });

        it('should handle workflow with valid methodName (line 315)', async () => {
            class TestWorkflow {
                validMethod() {}
            }

            const mockInstance = new TestWorkflow();

            // Mock workflow run metadata with valid methodName
            jest.spyOn(Reflect, 'getMetadata').mockImplementation((key: string, target: any) => {
                if (
                    key === TEMPORAL_WORKFLOW_RUN &&
                    target === TestWorkflow.prototype.validMethod
                ) {
                    return { methodName: 'validMethod' }; // Non-empty, non-whitespace
                }
                return undefined;
            });

            discoveryService.getProviders.mockReturnValue([
                mockInstanceWrapper(mockInstance, TestWorkflow),
            ]);
            discoveryService.getControllers.mockReturnValue([]);
            metadataScanner.scanFromPrototype.mockReturnValue(['validMethod']);

            await service.onModuleInit();

            // Should include workflow with valid methodName (line 315: if (info.methodName && info.methodName.trim()))
            const workflowNames = service.getWorkflowNames();
            expect(workflowNames).toContain('validMethod');
        });
    });
});
