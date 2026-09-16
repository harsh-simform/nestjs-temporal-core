import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TEMPORAL_MCP_MODULE_OPTIONS } from '../constants';
import { TemporalMcpServer } from './temporal-mcp.server';
import { TemporalMcpModuleOptions } from './mcp.interfaces';

/**
 * Exposes this app's Temporal integration as an MCP server over stdio, so
 * MCP-aware clients (Claude Code, Claude Desktop, etc.) can start, signal,
 * query, and manage workflows and schedules through `TemporalService`.
 *
 * Requires `TemporalModule` to be registered in the app — `TemporalMcpModule`
 * only adds the MCP transport layer on top of the existing `TemporalService`.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     TemporalModule.register({ connection: { address: 'localhost:7233' } }),
 *     TemporalMcpModule.forRoot(),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TemporalMcpModule {
    static forRoot(options: TemporalMcpModuleOptions = {}): DynamicModule {
        const optionsProvider: Provider = {
            provide: TEMPORAL_MCP_MODULE_OPTIONS,
            useValue: options,
        };

        return {
            module: TemporalMcpModule,
            providers: [optionsProvider, TemporalMcpServer],
            exports: [TemporalMcpServer],
        };
    }
}
