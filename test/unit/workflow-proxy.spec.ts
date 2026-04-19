import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowProxy, IWorkflowProxy } from '../../src/workflow-proxy/workflow-proxy';
import { WorkflowProxyFactory } from '../../src/workflow-proxy/workflow-proxy.factory';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TEMPORAL_CLIENT, TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions, WorkflowProxyConfig } from '../../src/interfaces';

// A plausible workflow function type — used only for the generic parameter.
type OrderWorkflow = (orderId: string, customerId: number) => Promise<{ status: string }>;

describe('WorkflowProxy', () => {
    let clientService: jest.Mocked<Partial<TemporalClientService>>;
    let mockHandle: { workflowId: string; firstExecutionRunId: string };

    const config: WorkflowProxyConfig = {
        workflowType: 'orderWorkflow',
        taskQueue: 'orders',
    };

    beforeEach(() => {
        mockHandle = { workflowId: 'order-42', firstExecutionRunId: 'run-1' };
        clientService = {
            startWorkflow: jest.fn().mockResolvedValue({ ...mockHandle, handle: mockHandle }),
            getWorkflowHandle: jest.fn().mockResolvedValue(mockHandle),
            signalWorkflow: jest.fn().mockResolvedValue(undefined),
            queryWorkflow: jest.fn().mockResolvedValue({ status: 'running' }),
            signalWithStart: jest.fn().mockResolvedValue({ ...mockHandle, handle: mockHandle }),
        };
    });

    describe('start', () => {
        it('should forward args, workflowType, and merged options to clientService.startWorkflow', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            const result = await proxy.start(['order-42', 7], { workflowId: 'custom-id' });

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'orderWorkflow',
                ['order-42', 7],
                { taskQueue: 'orders', workflowId: 'custom-id' },
            );
            expect(result).toMatchObject(mockHandle);
        });

        it('should use only task queue from config when options are omitted', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.start(['order-1', 1]);

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'orderWorkflow',
                ['order-1', 1],
                { taskQueue: 'orders' },
            );
        });

        it('should let caller options override the config taskQueue', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.start(['order-1', 1], { taskQueue: 'priority-orders' });

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'orderWorkflow',
                ['order-1', 1],
                { taskQueue: 'priority-orders' },
            );
        });

        it('should omit taskQueue from merged options when config has none', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                { workflowType: 'orderWorkflow' },
            );

            await proxy.start(['order-1', 1]);

            expect(clientService.startWorkflow).toHaveBeenCalledWith(
                'orderWorkflow',
                ['order-1', 1],
                {},
            );
        });

        it('should propagate errors from clientService.startWorkflow', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            (clientService.startWorkflow as jest.Mock).mockRejectedValue(new Error('boom'));

            await expect(proxy.start(['order-1', 1])).rejects.toThrow('boom');
        });
    });

    describe('getHandle', () => {
        it('should forward workflowId and runId to clientService.getWorkflowHandle', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            const handle = await proxy.getHandle('order-42', 'run-1');

            expect(clientService.getWorkflowHandle).toHaveBeenCalledWith('order-42', 'run-1');
            expect(handle).toBe(mockHandle);
        });

        it('should work when runId is omitted', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.getHandle('order-42');

            expect(clientService.getWorkflowHandle).toHaveBeenCalledWith('order-42', undefined);
        });
    });

    describe('signal', () => {
        it('should forward signal definition name and args to clientService.signalWorkflow', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const approveSignal = { name: 'approve', _: undefined } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[string]>;

            await proxy.signal('order-42', approveSignal, 'manager-approval');

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('order-42', 'approve', [
                'manager-approval',
            ]);
        });

        it('should forward an empty args array when signal takes no args', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const cancelSignal = { name: 'cancel' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[]>;

            await proxy.signal('order-42', cancelSignal);

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('order-42', 'cancel', []);
        });
    });

    describe('signalByName', () => {
        it('should forward workflowId, signalName, and args', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.signalByName('order-42', 'approve', ['reason']);

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('order-42', 'approve', [
                'reason',
            ]);
        });

        it('should pass undefined args when not provided', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.signalByName('order-42', 'ping');

            expect(clientService.signalWorkflow).toHaveBeenCalledWith('order-42', 'ping', undefined);
        });
    });

    describe('query', () => {
        it('should forward query definition name and args and return typed result', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            (clientService.queryWorkflow as jest.Mock).mockResolvedValue({ status: 'approved' });

            const statusQuery = { name: 'getStatus' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').QueryDefinition<{ status: string }>;

            const result = await proxy.query('order-42', statusQuery);

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('order-42', 'getStatus', []);
            expect(result).toEqual({ status: 'approved' });
        });

        it('should forward query args when provided', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const itemQuery = { name: 'getItem' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').QueryDefinition<{ id: string }, [string]>;

            await proxy.query('order-42', itemQuery, 'item-1');

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('order-42', 'getItem', [
                'item-1',
            ]);
        });
    });

    describe('queryByName', () => {
        it('should forward workflowId, queryName, and args', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            (clientService.queryWorkflow as jest.Mock).mockResolvedValue({ state: 'done' });

            const result = await proxy.queryByName<{ state: string }>('order-42', 'getStatus', [
                'extra',
            ]);

            expect(clientService.queryWorkflow).toHaveBeenCalledWith('order-42', 'getStatus', [
                'extra',
            ]);
            expect(result).toEqual({ state: 'done' });
        });

        it('should pass undefined args when not provided', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            await proxy.queryByName('order-42', 'getStatus');

            expect(clientService.queryWorkflow).toHaveBeenCalledWith(
                'order-42',
                'getStatus',
                undefined,
            );
        });
    });

    describe('signalWithStart', () => {
        it('should forward signal definition, signal args, workflow args, and merged options', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const approveSignal = { name: 'approve' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[string]>;

            await proxy.signalWithStart(approveSignal, ['manager'], ['order-42', 7], {
                workflowId: 'order-42',
            });

            expect(clientService.signalWithStart).toHaveBeenCalledWith(
                'orderWorkflow',
                'approve',
                ['manager'],
                ['order-42', 7],
                { taskQueue: 'orders', workflowId: 'order-42' },
            );
        });

        it('should work with empty signal args and no caller options', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const pingSignal = { name: 'ping' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[]>;

            await proxy.signalWithStart(pingSignal, [], ['order-1', 1]);

            expect(clientService.signalWithStart).toHaveBeenCalledWith(
                'orderWorkflow',
                'ping',
                [],
                ['order-1', 1],
                { taskQueue: 'orders' },
            );
        });

        it('should let caller options override the config taskQueue', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            const sig = { name: 's' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[]>;

            await proxy.signalWithStart(sig, [], ['order-1', 1], { taskQueue: 'tq-override' });

            expect(clientService.signalWithStart).toHaveBeenCalledWith(
                'orderWorkflow',
                's',
                [],
                ['order-1', 1],
                { taskQueue: 'tq-override' },
            );
        });

        it('should propagate errors from clientService.signalWithStart', async () => {
            const proxy = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );
            (clientService.signalWithStart as jest.Mock).mockRejectedValue(new Error('failed'));
            const sig = { name: 's' } as unknown as {
                name: string;
            } & import('@temporalio/workflow').SignalDefinition<[]>;

            await expect(proxy.signalWithStart(sig, [], ['o', 1])).rejects.toThrow('failed');
        });
    });

    describe('IWorkflowProxy interface compliance', () => {
        it('should implement all methods of IWorkflowProxy', () => {
            const proxy: IWorkflowProxy<OrderWorkflow> = new WorkflowProxy<OrderWorkflow>(
                clientService as TemporalClientService,
                config,
            );

            expect(typeof proxy.start).toBe('function');
            expect(typeof proxy.getHandle).toBe('function');
            expect(typeof proxy.signal).toBe('function');
            expect(typeof proxy.signalByName).toBe('function');
            expect(typeof proxy.query).toBe('function');
            expect(typeof proxy.queryByName).toBe('function');
            expect(typeof proxy.signalWithStart).toBe('function');
        });
    });
});

describe('WorkflowProxyFactory', () => {
    let factory: WorkflowProxyFactory;
    let clientService: Partial<TemporalClientService>;

    beforeEach(async () => {
        clientService = {
            startWorkflow: jest.fn(),
            getWorkflowHandle: jest.fn(),
            signalWorkflow: jest.fn(),
            queryWorkflow: jest.fn(),
            signalWithStart: jest.fn(),
        };

        const mockOptions: TemporalOptions = {
            taskQueue: 'default',
            connection: { namespace: 'test', address: 'localhost:7233' },
            enableLogger: false,
            logLevel: 'error',
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkflowProxyFactory,
                { provide: TemporalClientService, useValue: clientService },
                { provide: TEMPORAL_CLIENT, useValue: {} },
                { provide: TEMPORAL_MODULE_OPTIONS, useValue: mockOptions },
            ],
        }).compile();

        factory = module.get<WorkflowProxyFactory>(WorkflowProxyFactory);
    });

    it('should create a WorkflowProxy instance', () => {
        const proxy = factory.createProxy<OrderWorkflow>({
            workflowType: 'orderWorkflow',
            taskQueue: 'orders',
        });

        expect(proxy).toBeInstanceOf(WorkflowProxy);
    });

    it('should create a proxy that uses the injected client service and supplied config', async () => {
        const proxy = factory.createProxy<OrderWorkflow>({
            workflowType: 'orderWorkflow',
            taskQueue: 'orders',
        });

        (clientService.startWorkflow as jest.Mock).mockResolvedValue({ workflowId: 'x' });

        await proxy.start(['order-1', 1]);

        expect(clientService.startWorkflow).toHaveBeenCalledWith(
            'orderWorkflow',
            ['order-1', 1],
            { taskQueue: 'orders' },
        );
    });

    it('should create distinct proxy instances per call', () => {
        const p1 = factory.createProxy<OrderWorkflow>({ workflowType: 'wf1' });
        const p2 = factory.createProxy<OrderWorkflow>({ workflowType: 'wf2' });

        expect(p1).not.toBe(p2);
    });

    it('should accept a config without taskQueue', async () => {
        const proxy = factory.createProxy<OrderWorkflow>({ workflowType: 'orderWorkflow' });
        (clientService.startWorkflow as jest.Mock).mockResolvedValue({ workflowId: 'x' });

        await proxy.start(['order-1', 1]);

        expect(clientService.startWorkflow).toHaveBeenCalledWith(
            'orderWorkflow',
            ['order-1', 1],
            {},
        );
    });
});
