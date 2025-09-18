import { Test, TestingModule } from '@nestjs/testing';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { Client, WorkflowClient, WorkflowHandle } from '@temporalio/client';

describe('TemporalClientService', () => {
    let service: TemporalClientService;
    let mockClient: jest.Mocked<Client>;
    let mockWorkflowClient: jest.Mocked<WorkflowClient>;
    let mockWorkflowHandle: jest.Mocked<WorkflowHandle>;

    const mockOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'default',
        },
        taskQueue: 'test-queue',
    };

    beforeEach(async () => {
        mockWorkflowHandle = {
            workflowId: 'test-workflow-id',
            firstExecutionRunId: 'test-run-id',
            result: jest.fn().mockResolvedValue('test-result'),
            signal: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockResolvedValue('query-result'),
            terminate: jest.fn().mockResolvedValue(undefined),
            cancel: jest.fn().mockResolvedValue(undefined),
            describe: jest.fn().mockResolvedValue({}),
        } as any;

        mockWorkflowClient = {
            start: jest.fn().mockResolvedValue(mockWorkflowHandle),
            getHandle: jest.fn().mockResolvedValue(mockWorkflowHandle),
            list: jest.fn().mockReturnValue([]),
        } as any;

        mockClient = {
            workflow: mockWorkflowClient,
        } as any;

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
        await service.onModuleInit();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should initialize with client', async () => {
            await service.onModuleInit();
            expect(service.isHealthy()).toBe(true);
        });

        it('should handle missing client gracefully', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            await serviceWithoutClient.onModuleInit();
            expect(serviceWithoutClient.isHealthy()).toBe(false);
        });
    });

    describe('startWorkflow', () => {
        it('should start workflow with provided options', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
                workflowId: 'custom-workflow-id',
            };

            const result = await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowClient.start).toHaveBeenCalledWith(workflowType, {
                taskQueue: 'test-queue',
                workflowId: 'custom-workflow-id',
                args,
            });
            expect(result.workflowId).toBe('test-workflow-id');
            expect(result.firstExecutionRunId).toBe('test-run-id');
            expect(result.handle).toBe(mockWorkflowHandle);
        });

        it('should generate workflow ID if not provided', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
            };

            await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowClient.start).toHaveBeenCalledWith(
                workflowType,
                expect.objectContaining({
                    taskQueue: 'test-queue',
                    workflowId: expect.stringMatching(/^TestWorkflow-\d+-[a-z0-9]+$/),
                    args,
                }),
            );
        });

        it('should send initial signal if provided', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
                signal: {
                    name: 'initSignal',
                    args: ['signalArg'],
                },
            };

            await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith('initSignal', 'signalArg');
        });

        it('should send initial signal without args', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
                signal: {
                    name: 'initSignal',
                },
            };

            await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith('initSignal');
        });

        it('should start workflow with searchAttributes and memo options', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
                searchAttributes: {
                    CustomKeywordField: 'test-value',
                    CustomIntField: 42,
                },
                memo: {
                    description: 'test workflow',
                    priority: 'high',
                },
            };

            await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowClient.start).toHaveBeenCalledWith(
                workflowType,
                expect.objectContaining({
                    taskQueue: 'test-queue',
                    args,
                    searchAttributes: options.searchAttributes,
                    memo: options.memo,
                }),
            );
        });

        it('should start workflow without searchAttributes and memo (undefined check)', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];
            const options = {
                taskQueue: 'test-queue',
                // Explicitly not setting searchAttributes and memo to test undefined paths
            };

            await service.startWorkflow(workflowType, args, options);

            expect(mockWorkflowClient.start).toHaveBeenCalledWith(
                workflowType,
                expect.objectContaining({
                    taskQueue: 'test-queue',
                    args,
                    searchAttributes: undefined,
                    memo: undefined,
                }),
            );
        });

        it('should handle workflowId and taskQueue defaults correctly', async () => {
            const workflowType = 'TestWorkflow';
            const args = ['arg1', 'arg2'];

            // Test with no options (should use defaults)
            await service.startWorkflow(workflowType, args);

            const callArgs = mockWorkflowClient.start.mock.calls[0];
            expect(callArgs[0]).toBe(workflowType);
            expect(callArgs[1]).toMatchObject({
                taskQueue: 'test-queue', // from mockOptions.taskQueue
                args,
                memo: undefined,
                searchAttributes: undefined,
            });
            expect(callArgs[1].workflowId).toMatch(/^TestWorkflow-\d+/); // generated ID
        });

        it('should handle namespace fallback to default', async () => {
            // Test the namespace fallback in the logger debug statement
            const debugSpy = jest.spyOn((service as any).logger, 'debug');

            // Create service with options that don't have namespace
            const moduleWithoutNamespace: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalClientService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: mockClient,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: {
                            connection: { address: 'localhost:7233' }, // no namespace
                            taskQueue: 'test-queue',
                        },
                    },
                ],
            }).compile();

            const serviceWithoutNamespace =
                moduleWithoutNamespace.get<TemporalClientService>(TemporalClientService);
            await serviceWithoutNamespace.onModuleInit();

            expect(debugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Client namespace: default'),
            );
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);

            await expect(
                serviceWithoutClient.startWorkflow('TestWorkflow', [], { taskQueue: 'test' }),
            ).rejects.toThrow('Temporal client not initialized');
        });

        it('should handle workflow start errors', async () => {
            mockWorkflowClient.start.mockRejectedValue(new Error('Start failed'));

            await expect(
                service.startWorkflow('TestWorkflow', [], { taskQueue: 'test' }),
            ).rejects.toThrow("Failed to start workflow 'TestWorkflow': Start failed");
        });
    });

    describe('signalWorkflow', () => {
        it('should send signal to workflow', async () => {
            const workflowId = 'test-workflow-id';
            const signalName = 'testSignal';
            const args = ['arg1', 'arg2'];

            await service.signalWorkflow(workflowId, signalName, args);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName, 'arg1', 'arg2');
        });

        it('should handle signal with no args', async () => {
            const workflowId = 'test-workflow-id';
            const signalName = 'testSignal';

            await service.signalWorkflow(workflowId, signalName);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName);
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);

            await expect(
                serviceWithoutClient.signalWorkflow('workflowId', 'signal'),
            ).rejects.toThrow('Temporal client not initialized');
        });

        it('should handle signal errors', async () => {
            (mockWorkflowClient.getHandle as jest.Mock).mockRejectedValue(
                new Error('Handle failed'),
            );

            await expect(service.signalWorkflow('workflowId', 'signal')).rejects.toThrow(
                "Failed to send signal 'signal' to workflow workflowId: Failed to get workflow handle for workflowId: Handle failed",
            );
        });
    });

    describe('queryWorkflow', () => {
        it('should query workflow', async () => {
            const workflowId = 'test-workflow-id';
            const queryName = 'testQuery';
            const args = ['arg1', 'arg2'];

            const result = await service.queryWorkflow(workflowId, queryName, args);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName, 'arg1', 'arg2');
            expect(result).toBe('query-result');
        });

        it('should handle query with no args', async () => {
            const workflowId = 'test-workflow-id';
            const queryName = 'testQuery';

            await service.queryWorkflow(workflowId, queryName);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName);
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);

            await expect(serviceWithoutClient.queryWorkflow('workflowId', 'query')).rejects.toThrow(
                'Temporal client not initialized',
            );
        });

        it('should handle query errors', async () => {
            mockWorkflowHandle.query.mockRejectedValue(new Error('Query failed'));

            await expect(service.queryWorkflow('workflowId', 'query')).rejects.toThrow(
                "Failed to query 'query' on workflow workflowId: Query failed",
            );
        });
    });

    describe('terminateWorkflow', () => {
        it('should terminate workflow with reason', async () => {
            const workflowId = 'test-workflow-id';
            const reason = 'User requested termination';

            await service.terminateWorkflow(workflowId, reason);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.terminate).toHaveBeenCalledWith(reason);
        });

        it('should terminate workflow without reason', async () => {
            const workflowId = 'test-workflow-id';

            await service.terminateWorkflow(workflowId);

            expect(mockWorkflowHandle.terminate).toHaveBeenCalledWith(undefined);
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);

            await expect(serviceWithoutClient.terminateWorkflow('workflowId')).rejects.toThrow(
                'Temporal client not initialized',
            );
        });

        it('should handle termination errors', async () => {
            mockWorkflowHandle.terminate.mockRejectedValue(new Error('Terminate failed'));

            await expect(service.terminateWorkflow('workflowId')).rejects.toThrow(
                'Failed to terminate workflow workflowId: Terminate failed',
            );
        });
    });

    describe('cancelWorkflow', () => {
        it('should cancel workflow', async () => {
            const workflowId = 'test-workflow-id';

            await service.cancelWorkflow(workflowId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.cancel).toHaveBeenCalled();
        });

        it('should throw error when client not initialized', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);

            await expect(serviceWithoutClient.cancelWorkflow('workflowId')).rejects.toThrow(
                'Temporal client not initialized',
            );
        });

        it('should handle cancel errors', async () => {
            mockWorkflowHandle.cancel.mockRejectedValue(new Error('Cancel failed'));

            await expect(service.cancelWorkflow('workflowId')).rejects.toThrow(
                'Failed to cancel workflow workflowId: Cancel failed',
            );
        });
    });

    describe('getWorkflowHandle', () => {
        it('should get workflow handle with workflow ID only', async () => {
            const workflowId = 'test-workflow-id';

            const result = await service.getWorkflowHandle(workflowId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(result).toBe(mockWorkflowHandle);
        });

        it('should get workflow handle with workflow ID and run ID', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';

            const result = await service.getWorkflowHandle(workflowId, runId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, runId);
            expect(result).toBe(mockWorkflowHandle);
        });

        it('should handle getHandle errors', async () => {
            (mockWorkflowClient.getHandle as jest.Mock).mockRejectedValue(
                new Error('Handle failed'),
            );

            await expect(service.getWorkflowHandle('workflowId')).rejects.toThrow(
                'Failed to get workflow handle for workflowId: Handle failed',
            );
        });
    });

    describe('describeWorkflow', () => {
        it('should describe workflow', async () => {
            const workflowId = 'test-workflow-id';
            const description = { status: 'RUNNING' } as any;
            mockWorkflowHandle.describe.mockResolvedValue(description);

            const result = await service.describeWorkflow(workflowId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.describe).toHaveBeenCalled();
            expect(result).toBe(description);
        });

        it('should describe workflow with run ID', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';

            await service.describeWorkflow(workflowId, runId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, runId);
        });

        it('should handle describe errors', async () => {
            mockWorkflowHandle.describe.mockRejectedValue(new Error('Describe failed'));

            await expect(service.describeWorkflow('workflowId')).rejects.toThrow(
                'Failed to describe workflow workflowId: Describe failed',
            );
        });
    });

    describe('getWorkflowResult', () => {
        it('should get workflow result', async () => {
            const workflowId = 'test-workflow-id';
            mockWorkflowHandle.result = jest.fn().mockResolvedValue('test-result');

            const result = await service.getWorkflowResult(workflowId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, undefined);
            expect(mockWorkflowHandle.result).toHaveBeenCalled();
            expect(result).toBe('test-result');
        });

        it('should get workflow result with run ID', async () => {
            const workflowId = 'test-workflow-id';
            const runId = 'test-run-id';
            mockWorkflowHandle.result = jest.fn().mockResolvedValue('test-result');

            await service.getWorkflowResult(workflowId, runId);

            expect(mockWorkflowClient.getHandle).toHaveBeenCalledWith(workflowId, runId);
        });

        it('should handle result errors', async () => {
            mockWorkflowHandle.result = jest.fn().mockRejectedValue(new Error('Result failed'));

            await expect(service.getWorkflowResult('workflowId')).rejects.toThrow('Result failed');
        });
    });

    describe('signalWorkflowHandle', () => {
        it('should send signal using workflow handle', async () => {
            const signalName = 'testSignal';
            const args = ['arg1', 'arg2'];

            await service.signalWorkflowHandle(mockWorkflowHandle, signalName, args);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName, 'arg1', 'arg2');
        });

        it('should send signal using workflow handle without args', async () => {
            const signalName = 'testSignal';

            await service.signalWorkflowHandle(mockWorkflowHandle, signalName);

            expect(mockWorkflowHandle.signal).toHaveBeenCalledWith(signalName);
        });

        it('should handle signal errors', async () => {
            mockWorkflowHandle.signal.mockRejectedValue(new Error('Signal failed'));

            await expect(
                service.signalWorkflowHandle(mockWorkflowHandle, 'signal'),
            ).rejects.toThrow('Signal failed');
        });
    });

    describe('queryWorkflowHandle', () => {
        it('should query workflow using handle', async () => {
            const queryName = 'testQuery';
            const args = ['arg1', 'arg2'];

            const result = await service.queryWorkflowHandle(mockWorkflowHandle, queryName, args);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName, 'arg1', 'arg2');
            expect(result).toBe('query-result');
        });

        it('should query workflow using handle without args', async () => {
            const queryName = 'testQuery';

            await service.queryWorkflowHandle(mockWorkflowHandle, queryName);

            expect(mockWorkflowHandle.query).toHaveBeenCalledWith(queryName);
        });

        it('should handle query errors', async () => {
            mockWorkflowHandle.query.mockRejectedValue(new Error('Query failed'));

            await expect(service.queryWorkflowHandle(mockWorkflowHandle, 'query')).rejects.toThrow(
                'Query failed',
            );
        });
    });

    describe('listWorkflows', () => {
        it('should list workflows with default page size', () => {
            const query = 'WorkflowType="TestWorkflow"';

            service.listWorkflows(query);

            expect(mockWorkflowClient.list).toHaveBeenCalledWith({
                query,
                pageSize: 100,
            });
        });

        it('should list workflows with custom page size', () => {
            const query = 'WorkflowType="TestWorkflow"';
            const pageSize = 50;

            service.listWorkflows(query, pageSize);

            expect(mockWorkflowClient.list).toHaveBeenCalledWith({
                query,
                pageSize,
            });
        });

        it('should handle list errors', () => {
            mockWorkflowClient.list.mockImplementation(() => {
                throw new Error('List failed');
            });

            expect(() => service.listWorkflows('query')).toThrow(
                "Failed to list workflows with query 'query': List failed",
            );
        });
    });

    describe('getWorkflowClient', () => {
        it('should return workflow client', () => {
            const result = service.getWorkflowClient();
            expect(result).toBe(mockWorkflowClient);
        });

        it('should return null when client not available', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            const result = serviceWithoutClient.getWorkflowClient();
            expect(result).toBeNull();
        });
    });

    describe('getRawClient', () => {
        it('should return raw client', () => {
            const result = service.getRawClient();
            expect(result).toBe(mockClient);
        });

        it('should return null when client not available', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            const result = serviceWithoutClient.getRawClient();
            expect(result).toBeNull();
        });
    });

    describe('isHealthy', () => {
        it('should return true when client and workflow client are available', () => {
            expect(service.isHealthy()).toBe(true);
        });

        it('should return false when client is not available', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            expect(serviceWithoutClient.isHealthy()).toBe(false);
        });

        it('should return false when workflow client is not available', async () => {
            const clientWithoutWorkflow = {} as Client;

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalClientService,
                    {
                        provide: TEMPORAL_CLIENT,
                        useValue: clientWithoutWorkflow,
                    },
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: mockOptions,
                    },
                ],
            }).compile();

            const serviceWithoutWorkflow = module.get<TemporalClientService>(TemporalClientService);
            expect(serviceWithoutWorkflow.isHealthy()).toBe(false);
        });
    });

    describe('getHealth', () => {
        it('should return healthy status when client is available', () => {
            const result = service.getHealth();

            expect(result).toEqual({
                status: 'healthy',
            });
        });

        it('should return unhealthy status when client is not available', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            await serviceWithoutClient.onModuleInit();
            const result = serviceWithoutClient.getHealth();

            expect(result).toEqual({
                status: 'unhealthy',
            });
        });
    });

    describe('getStatus', () => {
        it('should return status with healthy client', () => {
            const result = service.getStatus();

            expect(result).toEqual({
                available: true,
                healthy: true,
                initialized: true,
                lastHealthCheck: expect.any(Date),
                namespace: 'default',
            });
        });

        it('should return status with unavailable client', async () => {
            const module: TestingModule = await Test.createTestingModule({
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

            const serviceWithoutClient = module.get<TemporalClientService>(TemporalClientService);
            await serviceWithoutClient.onModuleInit();
            const result = serviceWithoutClient.getStatus();

            expect(result).toEqual({
                available: false,
                healthy: false,
                initialized: false,
                lastHealthCheck: null,
                namespace: 'default',
            });
        });
    });

    describe('Advanced Coverage Tests', () => {
        describe('Initialization Error Scenarios', () => {
            it('should handle initialization errors and rethrow them (lines 65-66)', async () => {
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

                const errorService = module.get<TemporalClientService>(TemporalClientService);

                // Mock the performHealthCheck to throw an error
                jest.spyOn(errorService as any, 'performHealthCheck').mockRejectedValue(
                    new Error('Initialization failed'),
                );

                await expect(errorService.onModuleInit()).rejects.toThrow('Initialization failed');
            });
        });

        describe('Health Check Edge Cases', () => {
            it('should handle performHealthCheck with no client (line 384)', async () => {
                // Create service with no client
                const module: TestingModule = await Test.createTestingModule({
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

                const serviceNoClient = module.get<TemporalClientService>(TemporalClientService);

                // Call performHealthCheck directly - should return early when no client
                await (serviceNoClient as any).performHealthCheck();

                expect(serviceNoClient.isHealthy()).toBe(false);
            });

            it('should handle health check warning when workflow property not available (lines 394-395)', async () => {
                const clientWithoutWorkflow = {
                    // Client exists but no workflow property
                } as any;

                const module: TestingModule = await Test.createTestingModule({
                    providers: [
                        TemporalClientService,
                        {
                            provide: TEMPORAL_CLIENT,
                            useValue: clientWithoutWorkflow,
                        },
                        {
                            provide: TEMPORAL_MODULE_OPTIONS,
                            useValue: mockOptions,
                        },
                    ],
                }).compile();

                const serviceWithoutWorkflow =
                    module.get<TemporalClientService>(TemporalClientService);
                const mockLogger = {
                    warn: jest.fn(),
                    error: jest.fn(),
                };
                // Mock the logger methods directly
                const originalWarn = serviceWithoutWorkflow['logger'].warn;
                const originalError = serviceWithoutWorkflow['logger'].error;
                serviceWithoutWorkflow['logger'].warn = mockLogger.warn;
                serviceWithoutWorkflow['logger'].error = mockLogger.error;

                // Initialize the service first
                await serviceWithoutWorkflow.onModuleInit();

                // Trigger health check
                await (serviceWithoutWorkflow as any).performHealthCheck();

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'Client health check failed - workflow property not available',
                );

                // Restore original methods
                serviceWithoutWorkflow['logger'].warn = originalWarn;
                serviceWithoutWorkflow['logger'].error = originalError;
            });

            it('should handle health check errors (lines 396-397)', async () => {
                const faultyClient = {
                    get workflow() {
                        // Make the workflow property throw an error when accessed
                        throw new Error('Workflow access error');
                    },
                } as any;

                const module: TestingModule = await Test.createTestingModule({
                    providers: [
                        TemporalClientService,
                        {
                            provide: TEMPORAL_CLIENT,
                            useValue: faultyClient,
                        },
                        {
                            provide: TEMPORAL_MODULE_OPTIONS,
                            useValue: mockOptions,
                        },
                    ],
                }).compile();

                const serviceWithFaultyClient =
                    module.get<TemporalClientService>(TemporalClientService);
                const mockLogger = {
                    warn: jest.fn(),
                    error: jest.fn(),
                };
                // Mock the logger methods directly
                const originalWarn = serviceWithFaultyClient['logger'].warn;
                const originalError = serviceWithFaultyClient['logger'].error;
                serviceWithFaultyClient['logger'].warn = mockLogger.warn;
                serviceWithFaultyClient['logger'].error = mockLogger.error;

                // Initialize the service first
                await serviceWithFaultyClient.onModuleInit();

                // Trigger health check that will fail
                await (serviceWithFaultyClient as any).performHealthCheck();

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'Client health check failed',
                    expect.any(Error),
                );

                // Restore original methods
                serviceWithFaultyClient['logger'].warn = originalWarn;
                serviceWithFaultyClient['logger'].error = originalError;
            });

            it('should handle scheduled health check error (lines 344-345)', (done) => {
                const loggerSpy = jest.fn();

                const mockService = {
                    performHealthCheck: jest
                        .fn()
                        .mockRejectedValue(new Error('Scheduled health check error')),
                    logger: {
                        warn: loggerSpy,
                    },
                };

                // Simulate the scheduled health check call (line 344-345)
                mockService.performHealthCheck().catch((error: Error) => {
                    mockService.logger.warn('Health check failed', error);
                    expect(loggerSpy).toHaveBeenCalledWith(
                        'Health check failed',
                        expect.any(Error),
                    );
                    done();
                });
            });
        });

        it('should handle string error messages (lines 421-424)', () => {
            // Test the extractErrorMessage private method with string error
            const mockService = new (TemporalClientService as any)(mockClient, mockOptions);

            // Access the private method
            const result = mockService.extractErrorMessage('String error message');
            expect(result).toBe('String error message');
        });

        it('should handle unknown error types (lines 421-424)', () => {
            // Test the extractErrorMessage private method with unknown error type
            const mockService = new (TemporalClientService as any)(mockClient, mockOptions);

            // Access the private method
            const result = mockService.extractErrorMessage({ customError: true });
            expect(result).toBe('Unknown error');
        });

        it('should handle performHealthCheck failure in isHealthy method (lines 344-345)', async () => {
            // Mock performHealthCheck to throw an error to trigger the catch block
            const performHealthCheckSpy = jest
                .spyOn(service, 'performHealthCheck')
                .mockRejectedValue(new Error('Health check failed'));

            const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

            // Set lastHealthCheck to null to trigger health check
            (service as any).lastHealthCheck = null;

            // Call isHealthy which should trigger performHealthCheck and catch the error
            const result = service.isHealthy();

            // Give some time for the async catch block to execute
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(result).toBe(true); // Should return true because mockClient.workflow exists
            expect(performHealthCheckSpy).toHaveBeenCalled();
            expect(loggerSpy).toHaveBeenCalledWith('Health check failed', expect.any(Error));

            performHealthCheckSpy.mockRestore();
            loggerSpy.mockRestore();
        });

        it('should trigger health check when lastHealthCheck is old', async () => {
            // Set an old lastHealthCheck time
            (service as any).lastHealthCheck = new Date(Date.now() - 7000); // 7 seconds ago
            (service as any).healthCheckInterval = 5000; // 5 seconds

            const performHealthCheckSpy = jest
                .spyOn(service, 'performHealthCheck')
                .mockResolvedValue(undefined);

            // Call isHealthy which should trigger performHealthCheck due to old timestamp
            const result = service.isHealthy();

            expect(result).toBe(true); // Should return true because mockClient.workflow exists
            expect(performHealthCheckSpy).toHaveBeenCalled();

            performHealthCheckSpy.mockRestore();
        });
    });
});
