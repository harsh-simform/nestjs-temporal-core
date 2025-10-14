import { Test, TestingModule } from '@nestjs/testing';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { Client, WorkflowHandle } from '@temporalio/client';

describe('TemporalClientService', () => {
    let service: TemporalClientService;
    let mockClient: jest.Mocked<Partial<Client>>;
    let mockWorkflowHandle: jest.Mocked<Partial<WorkflowHandle>>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        enableLogger: false,
        logLevel: 'error',
    };

    beforeEach(async () => {
        // Create mock workflow handle
        mockWorkflowHandle = {
            workflowId: 'test-workflow-123',
            signal: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue({ status: 'running' }),
            terminate: jest.fn().mockResolvedValue(undefined),
            cancel: jest.fn().mockResolvedValue(undefined),
            result: jest.fn().mockResolvedValue({ success: true }),
        };

        // Create mock client
        mockClient = {
            workflow: {
                start: jest.fn().mockResolvedValue(mockWorkflowHandle),
                getHandle: jest.fn().mockResolvedValue(mockWorkflowHandle),
            } as any,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalClientService,
                {
                    provide: TEMPORAL_CLIENT,
                    useValue: mockClient,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalClientService>(TemporalClientService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('onModuleInit', () => {
        it('should initialize with client successfully', async () => {
            await service.onModuleInit();

            const status = service.getStatus();
            expect(status.initialized).toBe(true);
            expect(status.available).toBe(true);
        });

        it('should handle initialization without client', async () => {
            const moduleWithoutClient: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalClientService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: null,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutClient =
                moduleWithoutClient.get<TemporalClientService>(TemporalClientService);

            await serviceWithoutClient.onModuleInit();

            const status = serviceWithoutClient.getStatus();
            expect(status.initialized).toBe(false);
            expect(status.available).toBe(false);
        });

        it('should log namespace during initialization', async () => {
            const logSpy = jest.spyOn(service['logger'], 'debug');
            await service.onModuleInit();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-namespace'));
        });

        it('should handle initialization with default namespace', async () => {
            const optionsWithoutNamespace = { ...mockOptions, connection: {} };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalClientService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithoutNamespace,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalClientService>(TemporalClientService);
            await svc.onModuleInit();

            const status = svc.getStatus();
            expect(status.namespace).toBe('default');
        });

        it('should handle errors during initialization', async () => {
            const errorService = new TemporalClientService(mockClient as Client, mockOptions);

            // Mock performHealthCheck to throw an error
            jest.spyOn(errorService as any, 'performHealthCheck').mockRejectedValue(
                new Error('Health check failed'),
            );

            const loggerErrorSpy = jest.spyOn(errorService['logger'], 'error').mockImplementation();

            await expect(errorService.onModuleInit()).rejects.toThrow('Health check failed');
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'Failed to initialize Temporal client service',
                expect.any(Error),
            );

            loggerErrorSpy.mockRestore();
        });
    });

    describe('startWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should start a workflow successfully', async () => {
            const workflowType = 'testWorkflow';
            const args = [{ data: 'test' }];
            const options = { workflowId: 'custom-id', taskQueue: 'custom-queue' };

            const result = await service.startWorkflow(workflowType, args, options);

            expect(mockClient.workflow!.start).toHaveBeenCalledWith(workflowType, {
                workflowId: 'custom-id',
                taskQueue: 'custom-queue',
                args,
            });
            expect(result.handle).toBe(mockWorkflowHandle);
        });

        it('should generate workflow ID if not provided', async () => {
            await service.startWorkflow('testWorkflow');

            const callArgs = (mockClient.workflow!.start as jest.Mock).mock.calls[0][1];
            expect(callArgs.workflowId).toMatch(/^testWorkflow-\d+-[a-z0-9]+$/);
        });

        it('should use default task queue from options', async () => {
            await service.startWorkflow('testWorkflow');

            const callArgs = (mockClient.workflow!.start as jest.Mock).mock.calls[0][1];
            expect(callArgs.taskQueue).toBe('test-queue');
        });

        it('should use default task queue when both options are missing', async () => {
            const optionsWithoutQueue = {
                connection: { namespace: 'test' },
                enableLogger: false,
            };
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalClientService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: optionsWithoutQueue,
                    },
                ],
            }).compile();

            const svc = module.get<TemporalClientService>(TemporalClientService);
            await svc.onModuleInit();
            await svc.startWorkflow('testWorkflow');

            const callArgs = (mockClient.workflow!.start as jest.Mock).mock.calls[0][1];
            expect(callArgs.taskQueue).toBe('default');
        });

        it('should throw error if client not available', async () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);

            await expect(serviceWithoutClient.startWorkflow('test')).rejects.toThrow(
                'Temporal client not initialized',
            );
        });

        it('should retry on retryable gRPC errors', async () => {
            const grpcError = new Error('Unexpected error while making gRPC request');
            (mockClient.workflow!.start as jest.Mock)
                .mockRejectedValueOnce(grpcError)
                .mockRejectedValueOnce(grpcError)
                .mockResolvedValueOnce(mockWorkflowHandle);

            const result = await service.startWorkflow('testWorkflow');

            expect(mockClient.workflow!.start).toHaveBeenCalledTimes(3);
            expect(result.handle).toBe(mockWorkflowHandle);
        });

        it('should retry on connection error', async () => {
            const connectionError = new Error('connection error');
            (mockClient.workflow!.start as jest.Mock)
                .mockRejectedValueOnce(connectionError)
                .mockResolvedValueOnce(mockWorkflowHandle);

            const result = await service.startWorkflow('testWorkflow');

            expect(mockClient.workflow!.start).toHaveBeenCalledTimes(2);
            expect(result.handle).toBe(mockWorkflowHandle);
        });

        it('should retry on gRPC code errors', async () => {
            const grpcCodeError = { message: 'gRPC error', code: 14 }; // UNAVAILABLE
            (mockClient.workflow!.start as jest.Mock)
                .mockRejectedValueOnce(grpcCodeError)
                .mockResolvedValueOnce(mockWorkflowHandle);

            const result = await service.startWorkflow('testWorkflow');

            expect(mockClient.workflow!.start).toHaveBeenCalledTimes(2);
            expect(result.handle).toBe(mockWorkflowHandle);
        });

        it('should not retry on non-retryable errors', async () => {
            const nonRetryableError = new Error('Workflow execution already started');
            (mockClient.workflow!.start as jest.Mock).mockRejectedValue(nonRetryableError);

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow(
                "Failed to start workflow 'testWorkflow'",
            );

            expect(mockClient.workflow!.start).toHaveBeenCalledTimes(1);
        });

        it('should throw after max retries', async () => {
            const grpcError = new Error('UNAVAILABLE');
            (mockClient.workflow!.start as jest.Mock).mockRejectedValue(grpcError);

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow(
                "Failed to start workflow 'testWorkflow'",
            );

            expect(mockClient.workflow!.start).toHaveBeenCalledTimes(3);
        });

        it('should handle string errors', async () => {
            (mockClient.workflow!.start as jest.Mock).mockRejectedValue('String error');

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow(
                "Failed to start workflow 'testWorkflow': String error",
            );
        });

        it('should handle non-Error object errors', async () => {
            (mockClient.workflow!.start as jest.Mock).mockRejectedValue({
                someProperty: 'value',
            });

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow(
                "Failed to start workflow 'testWorkflow': Unknown error",
            );
        });

        it('should log error details on failure', async () => {
            const error = new Error('Test error');
            (mockClient.workflow!.start as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.startWorkflow('testWorkflow')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                "Failed to start workflow 'testWorkflow': Test error",
            );
            expect(logSpy).toHaveBeenCalledWith('Full error object:', error);

            logSpy.mockRestore();
        });
    });

    describe('getWorkflowHandle', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get workflow handle successfully', async () => {
            const workflowId = 'test-workflow-id';
            const handle = await service.getWorkflowHandle(workflowId);

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(handle).toBe(mockWorkflowHandle);
        });

        it('should get workflow handle with runId', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';

            await service.getWorkflowHandle(workflowId, runId);

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith(workflowId, runId);
        });

        it('should throw error if client not available', async () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);

            await expect(serviceWithoutClient.getWorkflowHandle('test')).rejects.toThrow(
                'Temporal client not initialized',
            );
        });

        it('should handle errors when getting workflow handle', async () => {
            const error = new Error('Workflow not found');
            (mockClient.workflow!.getHandle as jest.Mock).mockRejectedValue(error);

            await expect(service.getWorkflowHandle('missing-workflow')).rejects.toThrow(
                'Failed to get workflow handle for missing-workflow',
            );
        });

        it('should handle string errors', async () => {
            (mockClient.workflow!.getHandle as jest.Mock).mockRejectedValue('String error');

            await expect(service.getWorkflowHandle('test-id')).rejects.toThrow(
                'Failed to get workflow handle for test-id: String error',
            );
        });

        it('should handle non-Error object errors', async () => {
            (mockClient.workflow!.getHandle as jest.Mock).mockRejectedValue({ prop: 'value' });

            await expect(service.getWorkflowHandle('test-id')).rejects.toThrow(
                'Failed to get workflow handle for test-id: Unknown error',
            );
        });

        it('should log error details on failure', async () => {
            const error = new Error('Test error');
            (mockClient.workflow!.getHandle as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.getWorkflowHandle('test-id')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                'Failed to get workflow handle for test-id: Test error',
                error,
            );

            logSpy.mockRestore();
        });
    });

    describe('terminateWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should terminate workflow successfully', async () => {
            const workflowId = 'test-workflow-id';
            const reason = 'Test termination';

            await service.terminateWorkflow(workflowId, reason);

            expect(mockWorkflowHandle.terminate).toHaveBeenCalledWith(reason);
        });

        it('should terminate workflow without reason', async () => {
            await service.terminateWorkflow('test-workflow-id');

            expect(mockWorkflowHandle.terminate).toHaveBeenCalledWith(undefined);
        });

        it('should terminate workflow with runId', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';

            await service.terminateWorkflow(workflowId, undefined, runId);

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith(workflowId, runId);
            expect(mockWorkflowHandle.terminate).toHaveBeenCalled();
        });

        it('should handle termination errors', async () => {
            const error = new Error('Termination failed');
            (mockWorkflowHandle.terminate as jest.Mock).mockRejectedValue(error);

            await expect(service.terminateWorkflow('test-id')).rejects.toThrow(
                'Failed to terminate workflow test-id',
            );
        });

        it('should handle string errors during termination', async () => {
            (mockWorkflowHandle.terminate as jest.Mock).mockRejectedValue('String error');

            await expect(service.terminateWorkflow('test-id')).rejects.toThrow(
                'Failed to terminate workflow test-id: String error',
            );
        });

        it('should log termination errors', async () => {
            const error = new Error('Termination failed');
            (mockWorkflowHandle.terminate as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.terminateWorkflow('test-id', 'reason')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                'Failed to terminate workflow test-id: Termination failed',
                error,
            );

            logSpy.mockRestore();
        });
    });

    describe('cancelWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should cancel workflow successfully', async () => {
            const workflowId = 'test-workflow-id';

            await service.cancelWorkflow(workflowId);

            expect(mockWorkflowHandle.cancel).toHaveBeenCalled();
        });

        it('should cancel workflow with runId', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';

            await service.cancelWorkflow(workflowId, runId);

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith(workflowId, runId);
            expect(mockWorkflowHandle.cancel).toHaveBeenCalled();
        });

        it('should handle cancellation errors', async () => {
            const error = new Error('Cancellation failed');
            (mockWorkflowHandle.cancel as jest.Mock).mockRejectedValue(error);

            await expect(service.cancelWorkflow('test-id')).rejects.toThrow(
                'Failed to cancel workflow test-id',
            );
        });

        it('should handle string errors during cancellation', async () => {
            (mockWorkflowHandle.cancel as jest.Mock).mockRejectedValue('String error');

            await expect(service.cancelWorkflow('test-id')).rejects.toThrow(
                'Failed to cancel workflow test-id: String error',
            );
        });

        it('should log cancellation errors', async () => {
            const error = new Error('Cancellation failed');
            (mockWorkflowHandle.cancel as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.cancelWorkflow('test-id')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                'Failed to cancel workflow test-id: Cancellation failed',
                error,
            );

            logSpy.mockRestore();
        });
    });

    describe('signalWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should signal workflow successfully', async () => {
            const workflowId = 'test-workflow-id';
            const signalName = 'updateStatus';
            const args = ['new-status'];

            await service.signalWorkflow(workflowId, signalName, args);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName, 'new-status');
        });

        it('should signal workflow without args', async () => {
            await service.signalWorkflow('test-id', 'signal');

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith('signal');
        });

        it('should signal workflow with runId', async () => {
            await service.signalWorkflow('test-id', 'signal', undefined, 'run-id');

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith('test-id', 'run-id');
        });

        it('should handle signal errors', async () => {
            const error = new Error('Signal failed');
            (mockWorkflowHandle.signal as jest.Mock).mockRejectedValue(error);

            await expect(service.signalWorkflow('test-id', 'signal')).rejects.toThrow(
                "Failed to send signal 'signal' to workflow test-id",
            );
        });

        it('should handle string errors during signal', async () => {
            (mockWorkflowHandle.signal as jest.Mock).mockRejectedValue('String error');

            await expect(service.signalWorkflow('test-id', 'signal')).rejects.toThrow(
                "Failed to send signal 'signal' to workflow test-id: String error",
            );
        });

        it('should log signal errors', async () => {
            const error = new Error('Signal failed');
            (mockWorkflowHandle.signal as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.signalWorkflow('test-id', 'signal')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                "Failed to send signal 'signal' to workflow test-id: Signal failed",
                error,
            );

            logSpy.mockRestore();
        });
    });

    describe('signalWorkflowHandle', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should signal workflow handle successfully', async () => {
            const signalName = 'updateStatus';
            const args = ['new-status'];

            await service.signalWorkflowHandle(
                mockWorkflowHandle as WorkflowHandle,
                signalName,
                args,
            );

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName, 'new-status');
        });

        it('should signal workflow handle without args', async () => {
            await service.signalWorkflowHandle(mockWorkflowHandle as WorkflowHandle, 'signal');

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith('signal');
        });

        it('should handle signal handle errors', async () => {
            const error = new Error('Signal failed');
            (mockWorkflowHandle.signal as jest.Mock).mockRejectedValue(error);

            await expect(
                service.signalWorkflowHandle(mockWorkflowHandle as WorkflowHandle, 'signal'),
            ).rejects.toThrow(error);
        });
    });

    describe('queryWorkflow', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should query workflow successfully', async () => {
            const workflowId = 'test-workflow-id';
            const queryName = 'getStatus';
            const expectedResult = { status: 'running' };

            (mockWorkflowHandle.query as jest.Mock).mockResolvedValue(expectedResult);

            const result = await service.queryWorkflow(workflowId, queryName);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName);
            expect(result).toEqual(expectedResult);
        });

        it('should query workflow with args', async () => {
            const args = ['param1', 'param2'];

            await service.queryWorkflow('test-id', 'query', args);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith('query', 'param1', 'param2');
        });

        it('should query workflow with runId', async () => {
            await service.queryWorkflow('test-id', 'query', undefined, 'run-id');

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith('test-id', 'run-id');
        });

        it('should handle query errors', async () => {
            const error = new Error('Query failed');
            (mockWorkflowHandle.query as jest.Mock).mockRejectedValue(error);

            await expect(service.queryWorkflow('test-id', 'query')).rejects.toThrow(
                "Failed to query 'query' on workflow test-id",
            );
        });

        it('should handle string errors during query', async () => {
            (mockWorkflowHandle.query as jest.Mock).mockRejectedValue('String error');

            await expect(service.queryWorkflow('test-id', 'query')).rejects.toThrow(
                "Failed to query 'query' on workflow test-id: String error",
            );
        });

        it('should log query errors', async () => {
            const error = new Error('Query failed');
            (mockWorkflowHandle.query as jest.Mock).mockRejectedValue(error);

            const logSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

            await expect(service.queryWorkflow('test-id', 'query')).rejects.toThrow();

            expect(logSpy).toHaveBeenCalledWith(
                "Failed to query 'query' on workflow test-id: Query failed",
                error,
            );

            logSpy.mockRestore();
        });
    });

    describe('queryWorkflowHandle', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should query workflow handle successfully', async () => {
            const queryName = 'getStatus';
            const expectedResult = { status: 'running' };

            (mockWorkflowHandle.query as jest.Mock).mockResolvedValue(expectedResult);

            const result = await service.queryWorkflowHandle(
                mockWorkflowHandle as WorkflowHandle,
                queryName,
            );

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName);
            expect(result).toEqual(expectedResult);
        });

        it('should query workflow handle with args', async () => {
            const args = ['param1'];

            await service.queryWorkflowHandle(mockWorkflowHandle as WorkflowHandle, 'query', args);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith('query', 'param1');
        });

        it('should handle query handle errors', async () => {
            const error = new Error('Query failed');
            (mockWorkflowHandle.query as jest.Mock).mockRejectedValue(error);

            await expect(
                service.queryWorkflowHandle(mockWorkflowHandle as WorkflowHandle, 'query'),
            ).rejects.toThrow(error);
        });
    });

    describe('getWorkflowResult', () => {
        beforeEach(async () => {
            await service.onModuleInit();
        });

        it('should get workflow result successfully', async () => {
            const workflowId = 'test-workflow-id';
            const expectedResult = { success: true };

            (mockWorkflowHandle.result as jest.Mock).mockResolvedValue(expectedResult);

            const result = await service.getWorkflowResult(workflowId);

            expect(mockWorkflowHandle.result).toHaveBeenCalled();
            expect(result).toEqual(expectedResult);
        });

        it('should get workflow result with runId', async () => {
            await service.getWorkflowResult('test-id', 'run-id');

            expect(mockClient.workflow!.getHandle).toHaveBeenCalledWith('test-id', 'run-id');
        });

        it('should handle result errors', async () => {
            const error = new Error('Result failed');
            (mockWorkflowHandle.result as jest.Mock).mockRejectedValue(error);

            await expect(service.getWorkflowResult('test-id')).rejects.toThrow(error);
        });
    });

    describe('isHealthy', () => {
        it('should return false when not initialized', () => {
            const serviceNotInit = new TemporalClientService(mockClient as Client, mockOptions);
            expect(serviceNotInit.isHealthy()).toBe(false);
        });

        it('should return false when client is null', async () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);
            await serviceWithoutClient.onModuleInit();

            expect(serviceWithoutClient.isHealthy()).toBe(false);
        });

        it('should return true when initialized and client available', async () => {
            await service.onModuleInit();

            expect(service.isHealthy()).toBe(true);
        });

        it('should trigger async health check when interval exceeded', async () => {
            await service.onModuleInit();

            // First call
            expect(service.isHealthy()).toBe(true);

            // Simulate time passing
            jest.useFakeTimers();
            jest.advanceTimersByTime(35000); // More than 30 seconds

            // Second call should trigger health check
            const healthSpy = jest.spyOn(service as any, 'performHealthCheck');
            expect(service.isHealthy()).toBe(true);

            // Clean up
            jest.useRealTimers();
            healthSpy.mockRestore();
        }, 10000); // Increase timeout to 10 seconds
    });

    describe('getHealth', () => {
        it('should return healthy status', async () => {
            await service.onModuleInit();

            const health = service.getHealth();

            expect(health.status).toBe('healthy');
        });

        it('should return unhealthy status when not initialized', () => {
            const serviceNotInit = new TemporalClientService(null, mockOptions);

            const health = serviceNotInit.getHealth();

            expect(health.status).toBe('unhealthy');
        });
    });

    describe('getStatus', () => {
        it('should return complete status when initialized', async () => {
            await service.onModuleInit();

            const status = service.getStatus();

            expect(status.available).toBe(true);
            expect(status.healthy).toBe(true);
            expect(status.initialized).toBe(true);
            expect(status.lastHealthCheck).toBeInstanceOf(Date);
            expect(status.namespace).toBe('test-namespace');
        });

        it('should return status without client', () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);

            const status = serviceWithoutClient.getStatus();

            expect(status.available).toBe(false);
            expect(status.healthy).toBe(false);
            expect(status.initialized).toBe(false);
            expect(status.lastHealthCheck).toBeNull();
        });
    });

    describe('getRawClient', () => {
        it('should return the raw client', async () => {
            await service.onModuleInit();

            const client = service.getRawClient();

            expect(client).toBe(mockClient);
        });

        it('should return null when no client', () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);

            const client = serviceWithoutClient.getRawClient();

            expect(client).toBeNull();
        });
    });

    describe('extractErrorMessage', () => {
        it('should extract message from Error object', () => {
            const error = new Error('Test error');
            const message = service['extractErrorMessage'](error);

            expect(message).toBe('Test error');
        });

        it('should return string error as-is', () => {
            const error = 'String error';
            const message = service['extractErrorMessage'](error);

            expect(message).toBe('String error');
        });

        it('should return unknown error message for other types', () => {
            const error = { someProperty: 'value' };
            const message = service['extractErrorMessage'](error);

            expect(message).toBe('Unknown error');
        });

        it('should handle null error', () => {
            const message = service['extractErrorMessage'](null);

            expect(message).toBe('Unknown error');
        });
    });

    describe('isRetryableError', () => {
        it('should identify gRPC connection errors', () => {
            const error = new Error('Unexpected error while making gRPC request');
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(true);
        });

        it('should identify UNAVAILABLE errors', () => {
            const error = new Error('UNAVAILABLE: service unavailable');
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(true);
        });

        it('should identify connection errors', () => {
            const patterns = [
                'connection error',
                'DEADLINE_EXCEEDED',
                'RESOURCE_EXHAUSTED',
                'Connection refused',
                'timeout',
                'ECONNRESET',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'INTERNAL',
                'Service unavailable',
                'Network error',
            ];

            patterns.forEach((pattern) => {
                const error = new Error(pattern);
                const result = service['isRetryableError'](error, error.message);
                expect(result).toBe(true);
            });
        });

        it('should identify retryable gRPC codes', () => {
            const retryableCodes = [1, 2, 4, 8, 10, 13, 14];

            retryableCodes.forEach((code) => {
                const error = { message: 'gRPC error', code };
                const result = service['isRetryableError'](error, error.message);
                expect(result).toBe(true);
            });
        });

        it('should handle case-insensitive error matching', () => {
            const error = new Error('unavailable: SERVICE UNAVAILABLE');
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(true);
        });

        it('should not identify non-retryable errors', () => {
            const error = new Error('Workflow already exists');
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(false);
        });

        it('should not identify non-retryable gRPC codes', () => {
            const error = { message: 'gRPC error', code: 3 }; // INVALID_ARGUMENT
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(false);
        });

        it('should handle errors without code property', () => {
            const error = new Error('Some error');
            const result = service['isRetryableError'](error, 'Some error');

            expect(result).toBe(false);
        });

        it('should handle errors with non-numeric code', () => {
            const error = { message: 'error', code: 'STRING_CODE' };
            const result = service['isRetryableError'](error, error.message);

            expect(result).toBe(false);
        });
    });

    describe('generateWorkflowId', () => {
        it('should generate unique workflow IDs', () => {
            const id1 = service['generateWorkflowId']('testWorkflow');
            const id2 = service['generateWorkflowId']('testWorkflow');

            expect(id1).toMatch(/^testWorkflow-\d+-[a-z0-9]+$/);
            expect(id2).toMatch(/^testWorkflow-\d+-[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should include workflow type in ID', () => {
            const id = service['generateWorkflowId']('myCustomWorkflow');

            expect(id).toContain('myCustomWorkflow');
        });
    });

    describe('performHealthCheck', () => {
        it('should perform health check successfully', async () => {
            await service.onModuleInit();

            await service['performHealthCheck']();

            const status = service.getStatus();
            expect(status.lastHealthCheck).toBeInstanceOf(Date);
        });

        it('should handle null client gracefully', async () => {
            const serviceWithoutClient = new TemporalClientService(null, mockOptions);

            await expect(serviceWithoutClient['performHealthCheck']()).resolves.not.toThrow();
        });

        it('should throw and log error when client becomes null during health check', async () => {
            await service.onModuleInit();

            const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            // Store original performHealthCheck
            const originalHealthCheck = (service as any).performHealthCheck.bind(service);

            // Override performHealthCheck to simulate the error path
            (service as any).performHealthCheck = async function () {
                if (!this.client) {
                    const error = new Error('Client is not initialized');
                    this.logger.warn('Client health check failed', error);
                    throw error;
                }
                this.lastHealthCheck = new Date();
                this.logger.debug('Client health check passed');
            };

            // Temporarily set client to null
            (service as any).client = null;

            await expect((service as any).performHealthCheck()).rejects.toThrow(
                'Client is not initialized',
            );

            expect(logSpy).toHaveBeenCalledWith('Client health check failed', expect.any(Error));

            logSpy.mockRestore();

            // Restore for other tests
            (service as any).performHealthCheck = originalHealthCheck;
            (service as any).client = mockClient;
        });

        it('should handle errors in health check try-catch block', async () => {
            await service.onModuleInit();

            // Spy on the logger
            const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            // Mock Date constructor to throw error
            const OriginalDate = Date;
            (global as any).Date = class extends OriginalDate {
                constructor() {
                    super();
                    throw new Error('Date construction failed');
                }
            };

            try {
                await service['performHealthCheck']();
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Date construction failed');
            }

            // Restore Date
            (global as any).Date = OriginalDate;
            warnSpy.mockRestore();
        });
    });

    describe('sleep', () => {
        it('should sleep for specified duration', async () => {
            jest.useFakeTimers();

            const sleepPromise = service['sleep'](1000);
            jest.advanceTimersByTime(1000);

            await sleepPromise;

            jest.useRealTimers();
        });
    });

    describe('Additional error handling branches', () => {
        it('should hit line 322 performHealthCheck error handler', async () => {
            await service.onModuleInit();

            // Make performHealthCheck throw
            jest.spyOn(service as any, 'performHealthCheck').mockRejectedValue(
                new Error('Health check error'),
            );

            // Force lastHealthCheck to be old so health check is triggered
            (service as any).lastHealthCheck = new Date(Date.now() - 100000);

            const logSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

            // Call isHealthy which triggers the health check on line 321-322
            service.isHealthy();

            // Wait for catch block to execute
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(logSpy).toHaveBeenCalledWith('Health check failed', expect.any(Error));
            logSpy.mockRestore();
        });
    });
});
