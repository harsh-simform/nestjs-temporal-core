import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TemporalMcpServer } from '../../src/mcp/temporal-mcp.server';
import { TemporalService } from '../../src/services/temporal.service';

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

describe('TemporalMcpServer', () => {
    let registeredTools: Map<string, ToolHandler>;
    let scheduleService: Record<string, jest.Mock>;
    let temporalService: jest.Mocked<Partial<TemporalService>>;
    let mcpServer: TemporalMcpServer;

    beforeEach(() => {
        registeredTools = new Map();
        jest.spyOn(McpServer.prototype, 'registerTool').mockImplementation(
            ((name: string, _config: unknown, handler: ToolHandler) => {
                registeredTools.set(name, handler);
                return undefined;
            }) as typeof McpServer.prototype.registerTool,
        );

        scheduleService = {
            listSchedules: jest.fn(),
            describeSchedule: jest.fn(),
            pauseSchedule: jest.fn(),
            unpauseSchedule: jest.fn(),
            triggerSchedule: jest.fn(),
        };

        temporalService = {
            startWorkflow: jest.fn(),
            signalWorkflow: jest.fn(),
            queryWorkflow: jest.fn(),
            cancelWorkflow: jest.fn(),
            terminateWorkflow: jest.fn(),
            getHealth: jest.fn(),
            getStats: jest.fn(),
            get schedule() {
                return scheduleService as unknown as TemporalService['schedule'];
            },
        } as unknown as jest.Mocked<Partial<TemporalService>>;

        mcpServer = new TemporalMcpServer(temporalService as TemporalService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('registers the expected tool set', () => {
        expect(Array.from(registeredTools.keys())).toEqual([
            'start_workflow',
            'signal_workflow',
            'query_workflow',
            'cancel_workflow',
            'terminate_workflow',
            'list_schedules',
            'describe_schedule',
            'pause_schedule',
            'unpause_schedule',
            'trigger_schedule',
            'get_health',
            'get_stats',
        ]);
    });

    it('start_workflow forwards to TemporalService and serializes the result', async () => {
        (temporalService.startWorkflow as jest.Mock).mockResolvedValue({
            success: true,
            result: { workflowId: 'wf-1' },
        });

        const result = await registeredTools.get('start_workflow')!({
            workflowType: 'orderWorkflow',
            args: [1],
            taskQueue: 'orders',
            workflowId: 'wf-1',
        });

        expect(temporalService.startWorkflow).toHaveBeenCalledWith('orderWorkflow', [1], {
            taskQueue: 'orders',
            workflowId: 'wf-1',
        });
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text)).toEqual({
            success: true,
            result: { workflowId: 'wf-1' },
        });
    });

    it('start_workflow surfaces thrown errors as tool errors', async () => {
        (temporalService.startWorkflow as jest.Mock).mockRejectedValue(new Error('boom'));

        const result = await registeredTools.get('start_workflow')!({ workflowType: 'x' });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe('boom');
    });

    it('signal_workflow forwards to TemporalService', async () => {
        (temporalService.signalWorkflow as jest.Mock).mockResolvedValue({
            success: true,
            workflowId: 'wf-1',
            signalName: 'go',
        });

        const result = await registeredTools.get('signal_workflow')!({
            workflowId: 'wf-1',
            signalName: 'go',
            args: ['payload'],
        });

        expect(temporalService.signalWorkflow).toHaveBeenCalledWith('wf-1', 'go', ['payload']);
        expect(JSON.parse(result.content[0].text).success).toBe(true);
    });

    it('query_workflow forwards to TemporalService', async () => {
        (temporalService.queryWorkflow as jest.Mock).mockResolvedValue({
            success: true,
            result: 'status',
            workflowId: 'wf-1',
            queryName: 'getStatus',
        });

        const result = await registeredTools.get('query_workflow')!({
            workflowId: 'wf-1',
            queryName: 'getStatus',
        });

        expect(temporalService.queryWorkflow).toHaveBeenCalledWith('wf-1', 'getStatus', undefined);
        expect(JSON.parse(result.content[0].text).result).toBe('status');
    });

    it('cancel_workflow forwards to TemporalService', async () => {
        (temporalService.cancelWorkflow as jest.Mock).mockResolvedValue({
            success: true,
            workflowId: 'wf-1',
        });

        await registeredTools.get('cancel_workflow')!({ workflowId: 'wf-1' });

        expect(temporalService.cancelWorkflow).toHaveBeenCalledWith('wf-1');
    });

    it('terminate_workflow forwards to TemporalService', async () => {
        (temporalService.terminateWorkflow as jest.Mock).mockResolvedValue({
            success: true,
            workflowId: 'wf-1',
        });

        await registeredTools.get('terminate_workflow')!({ workflowId: 'wf-1', reason: 'stuck' });

        expect(temporalService.terminateWorkflow).toHaveBeenCalledWith('wf-1', 'stuck');
    });

    it('list_schedules drains the async iterable of schedules', async () => {
        async function* schedules() {
            yield { scheduleId: 'a' };
            yield { scheduleId: 'b' };
        }
        scheduleService.listSchedules.mockReturnValue({ success: true, schedules: schedules() });

        const result = await registeredTools.get('list_schedules')!({});

        expect(JSON.parse(result.content[0].text)).toEqual([
            { scheduleId: 'a' },
            { scheduleId: 'b' },
        ]);
    });

    it('list_schedules surfaces an unavailable schedule client as a tool error', async () => {
        scheduleService.listSchedules.mockReturnValue({
            success: false,
            error: new Error('no client'),
        });

        const result = await registeredTools.get('list_schedules')!({});

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe('no client');
    });

    it('describe_schedule forwards to the schedule service', async () => {
        scheduleService.describeSchedule.mockResolvedValue({
            success: true,
            scheduleId: 'daily',
            description: { state: { paused: false } },
        });

        const result = await registeredTools.get('describe_schedule')!({ scheduleId: 'daily' });

        expect(scheduleService.describeSchedule).toHaveBeenCalledWith('daily');
        expect(JSON.parse(result.content[0].text).scheduleId).toBe('daily');
    });

    it('pause_schedule, unpause_schedule, and trigger_schedule forward to the schedule service', async () => {
        scheduleService.pauseSchedule.mockResolvedValue({ success: true, scheduleId: 'daily' });
        scheduleService.unpauseSchedule.mockResolvedValue({ success: true, scheduleId: 'daily' });
        scheduleService.triggerSchedule.mockResolvedValue({ success: true, scheduleId: 'daily' });

        await registeredTools.get('pause_schedule')!({ scheduleId: 'daily', note: 'incident' });
        await registeredTools.get('unpause_schedule')!({ scheduleId: 'daily' });
        await registeredTools.get('trigger_schedule')!({ scheduleId: 'daily' });

        expect(scheduleService.pauseSchedule).toHaveBeenCalledWith('daily', 'incident');
        expect(scheduleService.unpauseSchedule).toHaveBeenCalledWith('daily', undefined);
        expect(scheduleService.triggerSchedule).toHaveBeenCalledWith('daily');
    });

    it('get_health and get_stats return TemporalService data', async () => {
        (temporalService.getHealth as jest.Mock).mockReturnValue({ status: 'healthy' });
        (temporalService.getStats as jest.Mock).mockReturnValue({ activities: { total: 2 } });

        const health = await registeredTools.get('get_health')!({});
        const stats = await registeredTools.get('get_stats')!({});

        expect(JSON.parse(health.content[0].text)).toEqual({ status: 'healthy' });
        expect(JSON.parse(stats.content[0].text)).toEqual({ activities: { total: 2 } });
    });

    describe('start / onModuleInit', () => {
        it('connects the stdio transport once when autoStart is not disabled', async () => {
            const connectSpy = jest
                .spyOn(McpServer.prototype, 'connect')
                .mockResolvedValue(undefined);

            await mcpServer.onModuleInit();
            await mcpServer.start();

            expect(connectSpy).toHaveBeenCalledTimes(1);
        });

        it('does not connect automatically when autoStart is false', async () => {
            const connectSpy = jest
                .spyOn(McpServer.prototype, 'connect')
                .mockResolvedValue(undefined);
            const server = new TemporalMcpServer(temporalService as TemporalService, {
                autoStart: false,
            });

            await server.onModuleInit();

            expect(connectSpy).not.toHaveBeenCalled();
        });
    });
});
