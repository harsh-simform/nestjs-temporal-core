import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { TemporalService } from '../services/temporal.service';
import { createLogger, TemporalLogger } from '../utils/logger';
import { TEMPORAL_MCP_MODULE_OPTIONS } from '../constants';
import { TemporalMcpModuleOptions } from './mcp.interfaces';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function serialize(value: unknown): string {
    return JSON.stringify(
        value,
        (_key, val) => (val instanceof Error ? { name: val.name, message: val.message } : val),
        2,
    );
}

/**
 * Wraps this app's `TemporalService` as an MCP server, connectable over stdio so
 * MCP-aware clients can start, signal, query, and manage workflows and schedules.
 */
@Injectable()
export class TemporalMcpServer implements OnModuleInit {
    private readonly logger: TemporalLogger;
    readonly server: McpServer;
    private connected = false;

    constructor(
        private readonly temporalService: TemporalService,
        @Optional()
        @Inject(TEMPORAL_MCP_MODULE_OPTIONS)
        private readonly options: TemporalMcpModuleOptions = {},
    ) {
        this.logger = createLogger(TemporalMcpServer.name);
        this.server = new McpServer({
            name: this.options.name || 'nestjs-temporal-core',
            version: this.options.version || '1.0.0',
        });
        this.registerTools();
    }

    async onModuleInit(): Promise<void> {
        if (this.options.autoStart !== false) {
            await this.start();
        }
    }

    /** Connect the MCP server over stdio. Idempotent — later calls are no-ops. */
    async start(): Promise<void> {
        if (this.connected) {
            return;
        }
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.connected = true;
        this.logger.info('Temporal MCP server connected over stdio');
    }

    private async safeCall(fn: () => Promise<unknown> | unknown): Promise<ToolResult> {
        try {
            return { content: [{ type: 'text', text: serialize(await fn()) }] };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { content: [{ type: 'text', text: message }], isError: true };
        }
    }

    private registerTools(): void {
        this.server.registerTool(
            'start_workflow',
            {
                description: 'Start a new Temporal workflow execution',
                inputSchema: z.object({
                    workflowType: z.string().describe('Registered workflow type name'),
                    args: z.array(z.unknown()).optional().describe('Workflow arguments'),
                    taskQueue: z
                        .string()
                        .optional()
                        .describe('Task queue (defaults to module config)'),
                    workflowId: z.string().optional().describe('Explicit workflow ID'),
                }),
            },
            ({ workflowType, args, taskQueue, workflowId }) =>
                this.safeCall(() =>
                    this.temporalService.startWorkflow(workflowType, args, {
                        ...(taskQueue ? { taskQueue } : {}),
                        ...(workflowId ? { workflowId } : {}),
                    }),
                ),
        );

        this.server.registerTool(
            'signal_workflow',
            {
                description: 'Send a signal to a running workflow',
                inputSchema: z.object({
                    workflowId: z.string(),
                    signalName: z.string(),
                    args: z.array(z.unknown()).optional(),
                }),
            },
            ({ workflowId, signalName, args }) =>
                this.safeCall(() =>
                    this.temporalService.signalWorkflow(workflowId, signalName, args),
                ),
        );

        this.server.registerTool(
            'query_workflow',
            {
                description: 'Query a running or completed workflow',
                inputSchema: z.object({
                    workflowId: z.string(),
                    queryName: z.string(),
                    args: z.array(z.unknown()).optional(),
                }),
            },
            ({ workflowId, queryName, args }) =>
                this.safeCall(() =>
                    this.temporalService.queryWorkflow(workflowId, queryName, args),
                ),
        );

        this.server.registerTool(
            'cancel_workflow',
            {
                description: 'Request cancellation of a running workflow',
                inputSchema: z.object({ workflowId: z.string() }),
            },
            ({ workflowId }) =>
                this.safeCall(() => this.temporalService.cancelWorkflow(workflowId)),
        );

        this.server.registerTool(
            'terminate_workflow',
            {
                description: 'Forcibly terminate a running workflow',
                inputSchema: z.object({ workflowId: z.string(), reason: z.string().optional() }),
            },
            ({ workflowId, reason }) =>
                this.safeCall(() => this.temporalService.terminateWorkflow(workflowId, reason)),
        );

        this.server.registerTool(
            'list_schedules',
            {
                description: 'List Temporal schedules in the namespace',
                inputSchema: z.object({}),
            },
            () =>
                this.safeCall(async () => {
                    const result = this.temporalService.schedule.listSchedules();
                    if (!result.success || !result.schedules) {
                        throw result.error || new Error('Schedule client unavailable');
                    }
                    const schedules = [];
                    for await (const schedule of result.schedules) {
                        schedules.push(schedule);
                    }
                    return schedules;
                }),
        );

        this.server.registerTool(
            'describe_schedule',
            {
                description: 'Describe a Temporal schedule',
                inputSchema: z.object({ scheduleId: z.string() }),
            },
            ({ scheduleId }) =>
                this.safeCall(() => this.temporalService.schedule.describeSchedule(scheduleId)),
        );

        this.server.registerTool(
            'pause_schedule',
            {
                description: 'Pause a Temporal schedule',
                inputSchema: z.object({ scheduleId: z.string(), note: z.string().optional() }),
            },
            ({ scheduleId, note }) =>
                this.safeCall(() => this.temporalService.schedule.pauseSchedule(scheduleId, note)),
        );

        this.server.registerTool(
            'unpause_schedule',
            {
                description: 'Unpause a Temporal schedule',
                inputSchema: z.object({ scheduleId: z.string(), note: z.string().optional() }),
            },
            ({ scheduleId, note }) =>
                this.safeCall(() =>
                    this.temporalService.schedule.unpauseSchedule(scheduleId, note),
                ),
        );

        this.server.registerTool(
            'trigger_schedule',
            {
                description: 'Trigger an immediate action for a Temporal schedule',
                inputSchema: z.object({ scheduleId: z.string() }),
            },
            ({ scheduleId }) =>
                this.safeCall(() => this.temporalService.schedule.triggerSchedule(scheduleId)),
        );

        this.server.registerTool(
            'get_health',
            {
                description: 'Get overall Temporal integration health status',
                inputSchema: z.object({}),
            },
            () => this.safeCall(() => this.temporalService.getHealth()),
        );

        this.server.registerTool(
            'get_stats',
            {
                description: 'Get Temporal integration statistics (activities, schedules, worker)',
                inputSchema: z.object({}),
            },
            () => this.safeCall(() => this.temporalService.getStats()),
        );
    }
}
