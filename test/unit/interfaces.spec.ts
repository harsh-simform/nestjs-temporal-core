import * as interfaces from '../../src/interfaces';

describe('Interfaces', () => {
    it('should have interface module loaded', () => {
        // Test that the interfaces module loads successfully
        expect(interfaces).toBeDefined();
        expect(typeof interfaces).toBe('object');
    });

    it('should have all type definitions available', () => {
        // Verify interface types are accessible via typeof checks
        const sample: interfaces.ClientConnectionOptions = {
            address: 'localhost:7233',
        };
        expect(sample.address).toBe('localhost:7233');

        const connectionOptions: interfaces.ConnectionOptions = {
            address: 'localhost:7233',
        };
        expect(connectionOptions.address).toBe('localhost:7233');

        const retryPolicy: interfaces.RetryPolicyConfig = {
            maximumAttempts: 3,
            initialInterval: '1s',
            maximumInterval: '30s',
            backoffCoefficient: 2.0,
        };
        expect(retryPolicy.maximumAttempts).toBe(3);
    });

    it('should support TemporalOptions interface', () => {
        const options: interfaces.TemporalOptions = {
            connection: {
                address: 'localhost:7233',
                namespace: 'default',
            },
            taskQueue: 'test-queue',
        };

        expect(options.connection.address).toBe('localhost:7233');
        expect(options.taskQueue).toBe('test-queue');
    });

    it('should support activity-related interfaces', () => {
        const activityOptions: interfaces.ActivityOptions = {
            name: 'testActivity',
        };
        expect(activityOptions.name).toBe('testActivity');

        const activityMethodOptions: interfaces.ActivityMethodOptions = {
            name: 'testMethod',
            timeout: '30s',
            maxRetries: 3,
        };
        expect(activityMethodOptions.name).toBe('testMethod');
        expect(activityMethodOptions.timeout).toBe('30s');
        expect(activityMethodOptions.maxRetries).toBe(3);
    });

    it('should support workflow-related interfaces', () => {
        const workflowOptions: interfaces.WorkflowOptions = {
            name: 'testWorkflow',
            description: 'Test workflow description',
        };
        expect(workflowOptions.name).toBe('testWorkflow');
        expect(workflowOptions.description).toBe('Test workflow description');

        const startOptions: interfaces.StartWorkflowOptions = {
            taskQueue: 'test-queue',
            workflowId: 'test-workflow-id',
        };
        expect(startOptions.taskQueue).toBe('test-queue');
        expect(startOptions.workflowId).toBe('test-workflow-id');
    });

    // Note: Schedule-related interfaces have been removed
    // as they required static configuration that should be dynamic

    it('should support signal and query interfaces', () => {
        const signalOptions: interfaces.SignalOptions = {
            name: 'testSignal',
        };
        expect(signalOptions.name).toBe('testSignal');

        const queryOptions: interfaces.QueryOptions = {
            name: 'testQuery',
        };
        expect(queryOptions.name).toBe('testQuery');
    });

    it('should support logger interfaces', () => {
        const loggerConfig: interfaces.LoggerConfig = {
            enableLogger: true,
            logLevel: 'info',
        };
        expect(loggerConfig.enableLogger).toBe(true);
        expect(loggerConfig.logLevel).toBe('info');

        const globalLoggerConfig: interfaces.GlobalLoggerConfig = {
            enableLogger: true,
            logLevel: 'debug',
            appName: 'test-app',
            logToFile: false,
        };
        expect(globalLoggerConfig.appName).toBe('test-app');
        expect(globalLoggerConfig.logToFile).toBe(false);
    });

    it('should support system status interfaces', () => {
        const workerStatus: interfaces.WorkerStatus = {
            isInitialized: true,
            isRunning: true,
            isHealthy: true,
            taskQueue: 'test-queue',
            namespace: 'default',
            workflowSource: 'filesystem',
            activitiesCount: 5,
            startedAt: new Date(),
            uptime: 3600,
        };

        expect(workerStatus.isInitialized).toBe(true);
        expect(workerStatus.taskQueue).toBe('test-queue');
        expect(workerStatus.workflowSource).toBe('filesystem');
        expect(workerStatus.activitiesCount).toBe(5);

        const discoveryStats: interfaces.DiscoveryStats = {
            controllers: 1,
            methods: 2,
            signals: 4,
            queries: 5,
            workflows: 6,
            childWorkflows: 7,
        };
        expect(discoveryStats.controllers).toBe(1);
        expect(discoveryStats.workflows).toBe(6);
    });

    it('should support workflow metadata interfaces', () => {
        const workflowMeta: interfaces.WorkflowMetadata = {
            name: 'TestWorkflow',
            description: 'desc',
            className: 'TestWorkflowClass',
        };
        expect(workflowMeta.name).toBe('TestWorkflow');
        expect(workflowMeta.className).toBe('TestWorkflowClass');

        const runMeta: interfaces.WorkflowRunMetadata = {
            methodName: 'run',
        };
        expect(runMeta.methodName).toBe('run');

        const signalMeta: interfaces.SignalMethodMetadata = {
            signalName: 'mySignal',
            methodName: 'signalHandler',
        };
        expect(signalMeta.signalName).toBe('mySignal');
        expect(signalMeta.methodName).toBe('signalHandler');

        const queryMeta: interfaces.QueryMethodMetadata = {
            queryName: 'myQuery',
            methodName: 'queryHandler',
        };
        expect(queryMeta.queryName).toBe('myQuery');
        expect(queryMeta.methodName).toBe('queryHandler');

        const childMeta: interfaces.ChildWorkflowMetadata = {
            workflowType: class Child {},
            options: { foo: 'bar' },
            propertyKey: 'child',
        };
        expect(childMeta.workflowType).toBeDefined();
        expect(childMeta.options?.foo).toBe('bar');
        expect(childMeta.propertyKey).toBe('child');
    });
});
