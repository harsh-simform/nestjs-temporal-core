import * as Decorators from '../../src/decorators';
import {
    Workflow,
    WorkflowRun,
    SignalMethod,
    QueryMethod,
    ChildWorkflow,
} from '../../src/decorators/workflow.decorator';

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

        it('should export InjectActivity decorator', () => {
            expect(Decorators.InjectActivity).toBeDefined();
            expect(typeof Decorators.InjectActivity).toBe('function');
        });

        it('should export InjectWorkflowClient decorator', () => {
            expect(Decorators.InjectWorkflowClient).toBeDefined();
            expect(typeof Decorators.InjectWorkflowClient).toBe('function');
        });
    });

    describe('Scheduling Decorators', () => {
        it('should export Scheduled decorator', () => {
            expect(Decorators.Scheduled).toBeDefined();
            expect(typeof Decorators.Scheduled).toBe('function');
        });

        it('should export Cron decorator', () => {
            expect(Decorators.Cron).toBeDefined();
            expect(typeof Decorators.Cron).toBe('function');
        });

        it('should export Interval decorator', () => {
            expect(Decorators.Interval).toBeDefined();
            expect(typeof Decorators.Interval).toBe('function');
        });
    });

    describe('Workflow Decorators', () => {
        it('should export Workflow decorator', () => {
            expect(Decorators.Workflow).toBeDefined();
            expect(typeof Decorators.Workflow).toBe('function');
        });

        it('should export WorkflowRun decorator', () => {
            expect(Decorators.WorkflowRun).toBeDefined();
            expect(typeof Decorators.WorkflowRun).toBe('function');
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

        it('should mark class with workflow metadata', () => {
            @Workflow()
            class TestWorkflow {}
            const metadata = Reflect.getMetadata('TEMPORAL_WORKFLOW', TestWorkflow);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('TestWorkflow');
        });
        it('should mark method with workflow run metadata', () => {
            class TestWorkflow {}
            Object.defineProperty(TestWorkflow.prototype, 'run', {
                value: function () {},
                writable: true,
            });
            const descriptor = Object.getOwnPropertyDescriptor(TestWorkflow.prototype, 'run') || {
                value: function () {},
            };
            WorkflowRun()(TestWorkflow.prototype, 'run', descriptor);
            const metadata = Reflect.getMetadata('TEMPORAL_WORKFLOW_RUN', descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.methodName).toBe('run');
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
            ChildWorkflow(class Child {}, { foo: 'bar' })(TestWorkflow.prototype, 'child');
            const metadata = Reflect.getMetadata(
                'TEMPORAL_CHILD_WORKFLOW',
                TestWorkflow.prototype,
                'child',
            );
            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBeDefined();
            expect(metadata.options.foo).toBe('bar');
        });
    });

    describe('Type Safety', () => {
        it('should maintain type safety for all decorator exports', () => {
            // This test ensures that TypeScript types are properly exported
            const decorators = {
                Activity: Decorators.Activity,
                ActivityMethod: Decorators.ActivityMethod,
                Scheduled: Decorators.Scheduled,
                Cron: Decorators.Cron,
                Interval: Decorators.Interval,
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
            expect(() =>
                Decorators.Scheduled({ scheduleId: 'test', cron: '0 8 * * *' }),
            ).not.toThrow();
            expect(() => Decorators.Cron('0 8 * * *', { scheduleId: 'test' })).not.toThrow();
            expect(() => Decorators.Interval('5m', { scheduleId: 'test' })).not.toThrow();
        });
    });

    describe('Module Structure', () => {
        it('should export all required decorators', () => {
            const requiredExports = ['Activity', 'ActivityMethod', 'Scheduled', 'Cron', 'Interval'];

            requiredExports.forEach((exportName) => {
                expect(Decorators).toHaveProperty(exportName);
                expect(Decorators[exportName as keyof typeof Decorators]).toBeDefined();
            });
        });

        it('should provide decorators for all major domains', () => {
            // Check that we have decorators for all major areas
            const activityDecorators = ['Activity', 'ActivityMethod'];
            const schedulingDecorators = ['Scheduled', 'Cron', 'Interval'];

            activityDecorators.forEach((decorator) => {
                expect(Decorators).toHaveProperty(decorator);
            });

            schedulingDecorators.forEach((decorator) => {
                expect(Decorators).toHaveProperty(decorator);
            });
        });
    });

    describe('Functionality Tests', () => {
        it('should provide working activity decorators', () => {
            const activityDecorator = Decorators.Activity();
            const activityMethodDecorator = Decorators.ActivityMethod();

            expect(typeof activityDecorator).toBe('function');
            expect(typeof activityMethodDecorator).toBe('function');
        });

        it('should provide working scheduling decorators', () => {
            const scheduledDecorator = Decorators.Scheduled({
                scheduleId: 'test',
                cron: '0 8 * * *',
            });
            const cronDecorator = Decorators.Cron('0 8 * * *', { scheduleId: 'test' });
            const intervalDecorator = Decorators.Interval('5m', { scheduleId: 'test' });

            expect(typeof scheduledDecorator).toBe('function');
            expect(typeof cronDecorator).toBe('function');
            expect(typeof intervalDecorator).toBe('function');
        });

        it('should handle decorator parameters correctly', () => {
            // Test that decorators accept appropriate parameters
            expect(() => Decorators.Activity({ name: 'test' })).not.toThrow();
            expect(() => Decorators.ActivityMethod({ name: 'test' })).not.toThrow();
            expect(() => Decorators.Scheduled({ scheduleId: 'test' })).not.toThrow();
            expect(() => Decorators.Cron('0 8 * * *', { scheduleId: 'test' })).not.toThrow();
            expect(() => Decorators.Interval('5m', { scheduleId: 'test' })).not.toThrow();
        });
    });

    describe('Decorator Categories', () => {
        it('should provide activity-related decorators', () => {
            expect(Decorators.Activity).toBeDefined();
            expect(Decorators.ActivityMethod).toBeDefined();
        });

        it('should provide scheduling-related decorators', () => {
            expect(Decorators.Scheduled).toBeDefined();
            expect(Decorators.Cron).toBeDefined();
            expect(Decorators.Interval).toBeDefined();
        });
    });
});
