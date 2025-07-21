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

            const descriptor = Object.getOwnPropertyDescriptor(TestWorkflow.prototype, 'runWorkflow')!;
            const metadata = Reflect.getMetadata(TEMPORAL_WORKFLOW_RUN, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('runWorkflow');
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
    });

    describe('@ChildWorkflow', () => {
        it('should inject child workflow proxy with default options', () => {
            class ChildWorkflowClass {}

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(TEMPORAL_CHILD_WORKFLOW, instance, 'childWorkflow');
            
            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBe(ChildWorkflowClass);
            expect(metadata.options).toEqual({});
            expect(instance.childWorkflow).toBeDefined();
        });

        it('should inject child workflow proxy with custom options', () => {
            class ChildWorkflowClass {}
            const options = { taskQueue: 'child-queue', timeout: '30s' };

            class TestWorkflow {
                @ChildWorkflow(ChildWorkflowClass, options)
                childWorkflow: any;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(TEMPORAL_CHILD_WORKFLOW, instance, 'childWorkflow');
            
            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBe(ChildWorkflowClass);
            expect(metadata.options).toEqual(options);
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
            const runDescriptor = Object.getOwnPropertyDescriptor(TestWorkflow.prototype, 'runWorkflow')!;
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
            const childMetadata = Reflect.getMetadata(TEMPORAL_CHILD_WORKFLOW, instance, 'childWorkflow');
            expect(childMetadata.workflowType).toBe(ChildWorkflowClass);
        });
    });
});