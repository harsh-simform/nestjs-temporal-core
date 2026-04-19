import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, Inject } from '@nestjs/common';
import {
    createWorkflowToken,
    createWorkflowProvider,
} from '../../src/utils/workflow-token';
import { WorkflowProxyFactory } from '../../src/workflow-proxy/workflow-proxy.factory';
import { WorkflowProxy, IWorkflowProxy } from '../../src/workflow-proxy/workflow-proxy';
import { TemporalClientService } from '../../src/services/temporal-client.service';

type OrderWorkflow = (orderId: string) => Promise<void>;

describe('createWorkflowToken', () => {
    it('should return an uppercase token prefixed with TEMPORAL_WORKFLOW_', () => {
        const token = createWorkflowToken('orderWorkflow');
        expect(token).toBe('TEMPORAL_WORKFLOW_ORDERWORKFLOW');
    });

    it('should normalize casing to uppercase', () => {
        expect(createWorkflowToken('Foo')).toBe('TEMPORAL_WORKFLOW_FOO');
        expect(createWorkflowToken('FOO')).toBe('TEMPORAL_WORKFLOW_FOO');
        expect(createWorkflowToken('foo')).toBe('TEMPORAL_WORKFLOW_FOO');
    });

    it('should produce the same token for equivalent input regardless of call order', () => {
        const t1 = createWorkflowToken('foo');
        const t2 = createWorkflowToken('foo');
        expect(t1).toBe(t2);
    });

    it('should produce distinct tokens for distinct workflow names', () => {
        expect(createWorkflowToken('a')).not.toBe(createWorkflowToken('b'));
    });

    it('should preserve non-letter characters', () => {
        expect(createWorkflowToken('order_workflow')).toBe('TEMPORAL_WORKFLOW_ORDER_WORKFLOW');
        expect(createWorkflowToken('order-42')).toBe('TEMPORAL_WORKFLOW_ORDER-42');
    });

    it('should accept an empty string (edge case)', () => {
        expect(createWorkflowToken('')).toBe('TEMPORAL_WORKFLOW_');
    });
});

describe('createWorkflowProvider', () => {
    it('should produce a FactoryProvider with the supplied token', () => {
        const token = createWorkflowToken('orderWorkflow');
        const provider = createWorkflowProvider<OrderWorkflow>(token, {
            workflowType: 'orderWorkflow',
            taskQueue: 'orders',
        });

        expect(provider.provide).toBe(token);
        expect(provider.inject).toEqual([WorkflowProxyFactory]);
        expect(typeof provider.useFactory).toBe('function');
    });

    it('should resolve to a WorkflowProxy created from WorkflowProxyFactory', () => {
        const factory = {
            createProxy: jest.fn().mockReturnValue({ marker: 'proxy' }),
        } as unknown as WorkflowProxyFactory;

        const provider = createWorkflowProvider<OrderWorkflow>(
            createWorkflowToken('orderWorkflow'),
            { workflowType: 'orderWorkflow', taskQueue: 'orders' },
        );

        const result = provider.useFactory(factory);

        expect(factory.createProxy).toHaveBeenCalledWith({
            workflowType: 'orderWorkflow',
            taskQueue: 'orders',
        });
        expect(result).toEqual({ marker: 'proxy' });
    });

    it('should pass the supplied config through to createProxy verbatim', () => {
        const factory = { createProxy: jest.fn() } as unknown as WorkflowProxyFactory;
        const config = { workflowType: 'noQueue' };

        const provider = createWorkflowProvider<OrderWorkflow>(
            createWorkflowToken('noQueue'),
            config,
        );
        provider.useFactory(factory);

        expect(factory.createProxy).toHaveBeenCalledWith(config);
    });
});

describe('createWorkflowProvider (integration with NestJS DI container)', () => {
    const ORDER_TOKEN = createWorkflowToken('orderWorkflow');

    @Injectable()
    class OrderConsumer {
        constructor(@Inject(ORDER_TOKEN) public readonly proxy: IWorkflowProxy<OrderWorkflow>) {}
    }

    it('should be resolvable via NestJS DI with a real WorkflowProxyFactory', async () => {
        const clientService = {
            startWorkflow: jest.fn().mockResolvedValue({ workflowId: 'x' }),
        } as unknown as TemporalClientService;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                { provide: TemporalClientService, useValue: clientService },
                WorkflowProxyFactory,
                createWorkflowProvider<OrderWorkflow>(ORDER_TOKEN, {
                    workflowType: 'orderWorkflow',
                    taskQueue: 'orders',
                }),
                OrderConsumer,
            ],
        }).compile();

        const consumer = module.get(OrderConsumer);
        expect(consumer.proxy).toBeInstanceOf(WorkflowProxy);

        // Exercise the proxy so we know it's wired correctly
        await consumer.proxy.start(['order-1']);
        expect(clientService.startWorkflow).toHaveBeenCalledWith(
            'orderWorkflow',
            ['order-1'],
            { taskQueue: 'orders' },
        );
    });
});
