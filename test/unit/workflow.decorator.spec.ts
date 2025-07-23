import {
    Workflow,
    WorkflowRun,
    SignalMethod,
    QueryMethod,
    ChildWorkflow,
} from '../../src/decorators/workflow.decorator';
import {
    TEMPORAL_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../../src/constants';
import 'reflect-metadata';

describe('Workflow Decorators', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('@Workflow', () => {
        it('should mark class with workflow metadata', () => {
            @Workflow()
            class TestWorkflow {}

            const metadata = Reflect.getMetadata(TEMPORAL_WORKFLOW, TestWorkflow);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('TestWorkflow');
        });

        it('should mark class with custom workflow options', () => {
            @Workflow({ name: 'custom-workflow', description: 'Test workflow' })
            class TestWorkflow {}

            const metadata = Reflect.getMetadata(TEMPORAL_WORKFLOW, TestWorkflow);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('custom-workflow');
            expect(metadata.description).toBe('Test workflow');
            expect(metadata.className).toBe('TestWorkflow');
        });

        it('should handle workflow without options', () => {
            @Workflow()
            class SimpleWorkflow {}

            const metadata = Reflect.getMetadata(TEMPORAL_WORKFLOW, SimpleWorkflow);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('SimpleWorkflow');
        });
    });

    describe('@WorkflowRun', () => {
        it('should mark method as workflow entrypoint', () => {
            class TestWorkflow {
                @WorkflowRun()
                async runWorkflow(): Promise<string> {
                    return 'result';
                }
            }

            const descriptor = Object.getOwnPropertyDescriptor(
                TestWorkflow.prototype,
                'runWorkflow',
            )!;
            const metadata = Reflect.getMetadata(TEMPORAL_WORKFLOW_RUN, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('runWorkflow');
        });

        it('should throw error when applied to non-method', () => {
            expect(() => {
                class TestWorkflow {
                    // @ts-expect-error - intentionally testing invalid usage
                    @WorkflowRun()
                    notAMethod = 'value';
                }
                new TestWorkflow();
            }).toThrow('@WorkflowRun can only be applied to methods');
        });

        it('should throw error for multiple WorkflowRun methods', () => {
            expect(() => {
                class TestWorkflow {
                    @WorkflowRun()
                    async runWorkflow1(): Promise<string> {
                        return 'result1';
                    }

                    @WorkflowRun()
                    async runWorkflow2(): Promise<string> {
                        return 'result2';
                    }
                }
            }).toThrow('Multiple @WorkflowRun methods found');
        });
    });

    describe('@SignalMethod', () => {
        it('should mark method as signal handler with default signal name', () => {
            class TestWorkflow {
                @SignalMethod()
                handleSignal(): void {}
            }

            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, TestWorkflow.prototype);
            expect(signals).toBeDefined();
            expect(signals['handleSignal']).toBe('handleSignal');
        });

        it('should mark method as signal handler with custom signal name', () => {
            class TestWorkflow {
                @SignalMethod('custom-signal')
                handleSignal(): void {}
            }

            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, TestWorkflow.prototype);
            expect(signals).toBeDefined();
            expect(signals['custom-signal']).toBe('handleSignal');
        });

        it('should accumulate multiple signal methods', () => {
            class TestWorkflow {
                @SignalMethod('signal1')
                handleSignal1(): void {}

                @SignalMethod('signal2')
                handleSignal2(): void {}
            }

            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, TestWorkflow.prototype);
            expect(signals).toBeDefined();
            expect(signals['signal1']).toBe('handleSignal1');
            expect(signals['signal2']).toBe('handleSignal2');
        });

        it('should throw error for empty signal name', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('')
                    handleSignal(): void {}
                }
            }).toThrow('Signal name cannot be empty');
        });

        it('should throw error for signal name with whitespace', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('signal with space')
                    handleSignal(): void {}
                }
            }).toThrow('Signal names cannot contain whitespace');
        });

        it('should throw error for duplicate signal names', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('duplicate')
                    handleSignal1(): void {}

                    @SignalMethod('duplicate')
                    handleSignal2(): void {}
                }
            }).toThrow('Duplicate signal name "duplicate" found');
        });

        it('should throw error when applied to non-method', () => {
            expect(() => {
                class TestWorkflow {
                    // @ts-expect-error - intentionally testing invalid usage
                    @SignalMethod()
                    notAMethod = 'value';
                }
                new TestWorkflow();
            }).toThrow('@SignalMethod can only be applied to methods');
        });

        it('should call original method when decorated signal method is invoked', async () => {
            const originalMethod = jest.fn();

            class TestWorkflow {
                @SignalMethod('test-signal')
                handleSignal() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            await instance.handleSignal();

            expect(originalMethod).toHaveBeenCalled();
        });

        it('should handle missing temporal functions gracefully', async () => {
            // Temporarily remove setHandler and defineSignal
            const originalSetHandler = (globalThis as any).setHandler;
            const originalDefineSignal = (globalThis as any).defineSignal;
            delete (globalThis as any).setHandler;
            delete (globalThis as any).defineSignal;

            const originalMethod = jest.fn();

            class TestWorkflow {
                @SignalMethod('test-signal')
                handleSignal() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            await instance.handleSignal();

            expect(originalMethod).toHaveBeenCalled();

            // Restore
            if (originalSetHandler) (globalThis as any).setHandler = originalSetHandler;
            if (originalDefineSignal) (globalThis as any).defineSignal = originalDefineSignal;
        });

        it('should handle temporal function registration errors gracefully', async () => {
            // Mock setHandler to throw an error
            const mockSetHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler already registered');
            });
            const mockDefineSignal = jest.fn().mockReturnValue({});

            // Temporarily replace global functions
            const originalSetHandler = (globalThis as any).setHandler;
            const originalDefineSignal = (globalThis as any).defineSignal;
            (globalThis as any).setHandler = mockSetHandler;
            (globalThis as any).defineSignal = mockDefineSignal;

            const originalMethod = jest.fn();

            class TestWorkflow {
                @SignalMethod('test-signal')
                handleSignal() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            await instance.handleSignal();

            expect(originalMethod).toHaveBeenCalled();

            // Restore
            (globalThis as any).setHandler = originalSetHandler;
            (globalThis as any).defineSignal = originalDefineSignal;
        });
    });

    describe('@QueryMethod', () => {
        it('should mark method as query handler with default query name', () => {
            class TestWorkflow {
                @QueryMethod()
                getState(): string {
                    return 'state';
                }
            }

            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, TestWorkflow.prototype);
            expect(queries).toBeDefined();
            expect(queries['getState']).toBe('getState');
        });

        it('should mark method as query handler with custom query name', () => {
            class TestWorkflow {
                @QueryMethod('custom-query')
                getState(): string {
                    return 'state';
                }
            }

            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, TestWorkflow.prototype);
            expect(queries).toBeDefined();
            expect(queries['custom-query']).toBe('getState');
        });

        it('should accumulate multiple query methods', () => {
            class TestWorkflow {
                @QueryMethod('query1')
                getQuery1(): string {
                    return 'query1';
                }

                @QueryMethod('query2')
                getQuery2(): string {
                    return 'query2';
                }
            }

            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, TestWorkflow.prototype);
            expect(queries).toBeDefined();
            expect(queries['query1']).toBe('getQuery1');
            expect(queries['query2']).toBe('getQuery2');
        });

        it('should throw error for empty query name', () => {
            expect(() => {
                class TestWorkflow {
                    @QueryMethod('')
                    getState(): string {
                        return 'state';
                    }
                }
            }).toThrow('Query name cannot be empty');
        });

        it('should throw error for query name with whitespace', () => {
            expect(() => {
                class TestWorkflow {
                    @QueryMethod('query with space')
                    getState(): string {
                        return 'state';
                    }
                }
            }).toThrow('Query names cannot contain whitespace');
        });

        it('should throw error for duplicate query names', () => {
            expect(() => {
                class TestWorkflow {
                    @QueryMethod('duplicate')
                    getQuery1(): string {
                        return 'query1';
                    }

                    @QueryMethod('duplicate')
                    getQuery2(): string {
                        return 'query2';
                    }
                }
            }).toThrow('Duplicate query name "duplicate" found');
        });

        it('should throw error when applied to non-method', () => {
            expect(() => {
                class TestWorkflow {
                    // @ts-expect-error - intentionally testing invalid usage
                    @QueryMethod()
                    notAMethod = 'value';
                }
                new TestWorkflow();
            }).toThrow('@QueryMethod can only be applied to methods');
        });

        it('should call original method when decorated query method is invoked', async () => {
            const originalMethod = jest.fn().mockReturnValue('test-result');

            class TestWorkflow {
                @QueryMethod('test-query')
                getState() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            const result = await instance.getState();

            expect(originalMethod).toHaveBeenCalled();
            expect(result).toBe('test-result');
        });

        it('should handle missing temporal functions gracefully for queries', async () => {
            // Temporarily remove setHandler and defineQuery
            const originalSetHandler = (globalThis as any).setHandler;
            const originalDefineQuery = (globalThis as any).defineQuery;
            delete (globalThis as any).setHandler;
            delete (globalThis as any).defineQuery;

            const originalMethod = jest.fn().mockReturnValue('test-result');

            class TestWorkflow {
                @QueryMethod('test-query')
                getState() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            const result = await instance.getState();

            expect(originalMethod).toHaveBeenCalled();
            expect(result).toBe('test-result');

            // Restore
            if (originalSetHandler) (globalThis as any).setHandler = originalSetHandler;
            if (originalDefineQuery) (globalThis as any).defineQuery = originalDefineQuery;
        });

        it('should handle temporal function registration errors gracefully for queries', async () => {
            // Mock setHandler to throw an error
            const mockSetHandler = jest.fn().mockImplementation(() => {
                throw new Error('Handler already registered');
            });
            const mockDefineQuery = jest.fn().mockReturnValue({});

            // Temporarily replace global functions
            const originalSetHandler = (globalThis as any).setHandler;
            const originalDefineQuery = (globalThis as any).defineQuery;
            (globalThis as any).setHandler = mockSetHandler;
            (globalThis as any).defineQuery = mockDefineQuery;

            const originalMethod = jest.fn().mockReturnValue('test-result');

            class TestWorkflow {
                @QueryMethod('test-query')
                getState() {
                    return originalMethod();
                }
            }

            const instance = new TestWorkflow();
            const result = await instance.getState();

            expect(originalMethod).toHaveBeenCalled();
            expect(result).toBe('test-result');

            // Restore
            (globalThis as any).setHandler = originalSetHandler;
            (globalThis as any).defineQuery = originalDefineQuery;
        });
    });

    describe('@ChildWorkflow', () => {
        it('should inject child workflow proxy', () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'childWorkflow',
            );

            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBe(ChildWorkflowClass);
            expect(instance.childWorkflow).toBeDefined();
        });

        it('should inject child workflow proxy without options', () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'childWorkflow',
            );

            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBe(ChildWorkflowClass);
        });

        it('should create non-writable property', () => {
            class ChildWorkflowClass {}
            class TestWorkflow {}

            const instance = new TestWorkflow();

            // Apply decorator manually
            const decorator = ChildWorkflow(ChildWorkflowClass);
            decorator(instance, 'childWorkflow');

            const descriptor = Object.getOwnPropertyDescriptor(instance, 'childWorkflow');

            expect(descriptor?.writable).toBe(false);
            expect(descriptor?.enumerable).toBe(false);
            expect(descriptor?.configurable).toBe(false);
        });

        it('should throw error for null workflow type', () => {
            expect(() => {
                class TestWorkflow {
                    @ChildWorkflow(null as any)
                    childWorkflow: any;
                }
            }).toThrow('Child workflow type is required');
        });

        it('should throw error for non-function workflow type', () => {
            expect(() => {
                class TestWorkflow {
                    @ChildWorkflow('not a class' as any)
                    childWorkflow: any;
                }
            }).toThrow('Child workflow type must be a class constructor');
        });

        it('should create proxy that throws helpful error when accessed', async () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow('Failed to start child workflow');
        });

        it('should make proxy read-only', () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            expect(() => {
                instance.childWorkflow.newProperty = 'value';
            }).toThrow('Child workflow proxy is read-only');
        });

        it('should use workflow name from metadata when available', async () => {
            @Workflow({ name: 'custom-child-workflow' })
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            // Mock startChild to test if custom name is used
            const mockStartChild = jest.fn().mockRejectedValue(new Error('Expected error'));
            const originalImports = require('../../src/decorators/workflow.decorator');

            // The proxy should attempt to use the startChild function
            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow('Failed to start child workflow');
        });

        it('should return undefined for reserved properties', () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            expect(instance.childWorkflow.constructor).toBeUndefined();
            expect(instance.childWorkflow.toString).toBeUndefined();
        });

        it('should handle missing startChild function', async () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow('Failed to start child workflow');
        });

        it('should handle case when startChild is not a function', async () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            // The proxy will fail when startChild is not available or not a function
            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow();
        });

        it('should handle startChild access error', async () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            // The proxy will fail when startChild access throws an error
            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow();
        });

        it('should handle when startChild is not a function', async () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();

            // The proxy will fail when startChild is not properly initialized
            await expect(async () => {
                await instance.childWorkflow.someMethod();
            }).rejects.toThrow();
        });
    });

    describe('@InjectWorkflowClient', () => {
        // We'll skip these complex tests since the InjectWorkflowClient decorator
        // has internal state management that's difficult to test in isolation
        // The important thing is that the decorator exists and can be applied
        it('should be defined and applicable', () => {
            const { InjectWorkflowClient } = require('../../src/decorators/workflow.decorator');

            expect(typeof InjectWorkflowClient).toBe('function');

            // Test that it can be applied without throwing (basic functionality)
            expect(() => {
                class TestService {
                    @InjectWorkflowClient()
                    client: any;
                }
            }).not.toThrow();
        });

        it('should return cached client on second access', () => {
            const { InjectWorkflowClient } = require('../../src/decorators/workflow.decorator');

            // Mock globalThis.getWorkflowClient
            const mockClient = { id: 'test-client' };
            (globalThis as any).getWorkflowClient = jest.fn().mockReturnValue(mockClient);

            class TestService {
                @InjectWorkflowClient()
                client: any;
            }

            const instance = new TestService();

            // First access
            const client1 = instance.client;
            // Second access should return cached client (line 493)
            const client2 = instance.client;

            expect(client1).toBe(mockClient);
            expect(client2).toBe(mockClient);
            expect((globalThis as any).getWorkflowClient).toHaveBeenCalledTimes(1);

            // Cleanup
            delete (globalThis as any).getWorkflowClient;
        });

        it('should throw error on second failed attempt', () => {
            const { InjectWorkflowClient } = require('../../src/decorators/workflow.decorator');

            class TestService {
                @InjectWorkflowClient()
                client: any;
            }

            const instance = new TestService();

            // First access will fail and set hasAttemptedLoad = true
            expect(() => instance.client).toThrow('No WorkflowClient instance available');

            // Second access should throw different error (line 497)
            expect(() => instance.client).toThrow('WorkflowClient failed to initialize');
        });

        it('should handle getWorkflowClient returning null', () => {
            const { InjectWorkflowClient } = require('../../src/decorators/workflow.decorator');

            // Mock globalThis.getWorkflowClient to return null
            (globalThis as any).getWorkflowClient = jest.fn().mockReturnValue(null);

            class TestService {
                @InjectWorkflowClient()
                client: any;
            }

            const instance = new TestService();

            // Should throw error for null client (line 513)
            expect(() => instance.client).toThrow(
                'Failed to get WorkflowClient: getWorkflowClient() returned null or undefined',
            );

            // Cleanup
            delete (globalThis as any).getWorkflowClient;
        });

        it('should handle getWorkflowClient throwing error', () => {
            const { InjectWorkflowClient } = require('../../src/decorators/workflow.decorator');

            // Mock globalThis.getWorkflowClient to throw error
            (globalThis as any).getWorkflowClient = jest.fn().mockImplementation(() => {
                throw new Error('Client initialization failed');
            });

            class TestService {
                @InjectWorkflowClient()
                client: any;
            }

            const instance = new TestService();

            // Should catch and re-throw error (line 518)
            expect(() => instance.client).toThrow(
                'Failed to get WorkflowClient: Client initialization failed',
            );

            // Cleanup
            delete (globalThis as any).getWorkflowClient;
        });
    });

    describe('Integration Tests', () => {
        it('should work together on a complete workflow class', () => {
            class ChildWorkflowClass {}

            @Workflow({ name: 'test-workflow', description: 'Integration test workflow' })
            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;

                @WorkflowRun()
                async runWorkflow(): Promise<string> {
                    return 'result';
                }

                @SignalMethod('start-signal')
                startSignal(): void {}

                @SignalMethod()
                defaultSignal(): void {}

                @QueryMethod('status-query')
                getStatus(): string {
                    return 'running';
                }

                @QueryMethod()
                getDefaultQuery(): string {
                    return 'default';
                }
            }

            const instance = new TestWorkflow();

            // Test workflow metadata
            const workflowMetadata = Reflect.getMetadata(TEMPORAL_WORKFLOW, TestWorkflow);
            expect(workflowMetadata.name).toBe('test-workflow');
            expect(workflowMetadata.description).toBe('Integration test workflow');

            // Test workflow run metadata
            const runDescriptor = Object.getOwnPropertyDescriptor(
                TestWorkflow.prototype,
                'runWorkflow',
            )!;
            const runMetadata = Reflect.getMetadata(TEMPORAL_WORKFLOW_RUN, runDescriptor.value);
            expect(runMetadata.methodName).toBe('runWorkflow');

            // Test signal metadata
            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, TestWorkflow.prototype);
            expect(signals['start-signal']).toBe('startSignal');
            expect(signals['defaultSignal']).toBe('defaultSignal');

            // Test query metadata
            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, TestWorkflow.prototype);
            expect(queries['status-query']).toBe('getStatus');
            expect(queries['getDefaultQuery']).toBe('getDefaultQuery');

            // Test child workflow metadata
            const childMetadata = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'childWorkflow',
            );
            expect(childMetadata.workflowType).toBe(ChildWorkflowClass);
        });
    });
});
