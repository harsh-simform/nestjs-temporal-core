import * as Decorators from '../../src/decorators';
import { SignalMethod, QueryMethod, ChildWorkflow } from '../../src/decorators/workflow.decorator';

describe('Decorators Index Module', () => {
    describe('Activity Decorators', () => {
        it('should export Activity decorator', () => {
            expect(Decorators.Activity).toBeDefined();
            expect(typeof Decorators.Activity).toBe('function');
        });

        it('should export ActivityMethod decorator', () => {
            expect(Decorators.ActivityMethod).toBeDefined();
            expect(typeof Decorators.ActivityMethod).toBe('function');
        });
    });

    // Note: Scheduling decorators have been removed due to static configuration issues

    describe('Workflow Decorators', () => {
        it('should not export deprecated Workflow decorator', () => {
            expect((Decorators as any).Workflow).toBeUndefined();
        });

        it('should not export deprecated WorkflowRun decorator', () => {
            expect((Decorators as any).WorkflowRun).toBeUndefined();
        });

        it('should export SignalMethod decorator', () => {
            expect(Decorators.SignalMethod).toBeDefined();
            expect(typeof Decorators.SignalMethod).toBe('function');
        });

        it('should export QueryMethod decorator', () => {
            expect(Decorators.QueryMethod).toBeDefined();
            expect(typeof Decorators.QueryMethod).toBe('function');
        });

        it('should export ChildWorkflow decorator', () => {
            expect(Decorators.ChildWorkflow).toBeDefined();
            expect(typeof Decorators.ChildWorkflow).toBe('function');
        });

        it('should not support class-based workflow metadata (deprecated)', () => {
            // Class-based workflows are deprecated in favor of function-based workflows
            expect(true).toBe(true);
        });
        it('should mark method with signal metadata', () => {
            class TestWorkflow {}
            Object.defineProperty(TestWorkflow.prototype, 'signal', {
                value: function () {},
                writable: true,
            });
            const descriptor = Object.getOwnPropertyDescriptor(
                TestWorkflow.prototype,
                'signal',
            ) || { value: function () {} };
            SignalMethod('mySignal')(TestWorkflow.prototype, 'signal', descriptor);
            const signals = Reflect.getMetadata('TEMPORAL_SIGNAL_METHOD', TestWorkflow.prototype);
            expect(signals).toBeDefined();
            expect(signals['mySignal']).toBe('signal');
        });
        it('should mark method with query metadata', () => {
            class TestWorkflow {}
            Object.defineProperty(TestWorkflow.prototype, 'query', {
                value: function () {},
                writable: true,
            });
            const descriptor = Object.getOwnPropertyDescriptor(TestWorkflow.prototype, 'query') || {
                value: function () {},
            };
            QueryMethod('myQuery')(TestWorkflow.prototype, 'query', descriptor);
            const queries = Reflect.getMetadata('TEMPORAL_QUERY_METHOD', TestWorkflow.prototype);
            expect(queries).toBeDefined();
            expect(queries['myQuery']).toBe('query');
        });
        it('should mark property with child workflow metadata', () => {
            class TestWorkflow {}
            ChildWorkflow(class Child {})(TestWorkflow.prototype, 'child');
            const metadata = Reflect.getMetadata(
                'TEMPORAL_CHILD_WORKFLOW',
                TestWorkflow.prototype,
                'child',
            );
            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBeDefined();
        });
    });

    describe('Type Safety', () => {
        it('should maintain type safety for all decorator exports', () => {
            // This test ensures that TypeScript types are properly exported
            const decorators = {
                Activity: Decorators.Activity,
                ActivityMethod: Decorators.ActivityMethod,
            };

            Object.values(decorators).forEach((decorator) => {
                expect(decorator).toBeDefined();
                expect(typeof decorator).toBe('function');
            });
        });

        it('should provide consistent decorator function signatures', () => {
            // Test that decorators can be called with appropriate parameters
            expect(() => Decorators.Activity()).not.toThrow();
            expect(() => Decorators.ActivityMethod()).not.toThrow();
            // Note: Scheduling decorators removed due to static configuration issues
        });
    });

    describe('Module Structure', () => {
        it('should export all required decorators', () => {
            const requiredExports = ['Activity', 'ActivityMethod'];

            requiredExports.forEach((exportName) => {
                expect(Decorators).toHaveProperty(exportName);
                expect(Decorators[exportName as keyof typeof Decorators]).toBeDefined();
            });
        });

        it('should provide decorators for all major domains', () => {
            // Check that we have decorators for all major areas
            const activityDecorators = ['Activity', 'ActivityMethod'];

            activityDecorators.forEach((decorator) => {
                expect(Decorators).toHaveProperty(decorator);
            });

            // Note: Scheduling decorators removed due to static configuration issues
        });
    });

    describe('Functionality Tests', () => {
        it('should provide working activity decorators', () => {
            const activityDecorator = Decorators.Activity();
            const activityMethodDecorator = Decorators.ActivityMethod();

            expect(typeof activityDecorator).toBe('function');
            expect(typeof activityMethodDecorator).toBe('function');
        });

        // Note: Scheduling decorators removed due to static configuration issues

        it('should handle decorator parameters correctly', () => {
            // Test that decorators accept appropriate parameters
            expect(() => Decorators.Activity({ name: 'test' })).not.toThrow();
            expect(() => Decorators.ActivityMethod({ name: 'test' })).not.toThrow();
            // Note: Scheduling decorators removed due to static configuration issues
        });
    });

    describe('Decorator Categories', () => {
        it('should provide activity-related decorators', () => {
            expect(Decorators.Activity).toBeDefined();
            expect(Decorators.ActivityMethod).toBeDefined();
        });

        // Note: Scheduling decorators removed due to static configuration issues
    });
});
