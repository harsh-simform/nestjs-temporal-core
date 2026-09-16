import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TemporalMcpModule } from '../../src/mcp/temporal-mcp.module';
import { TemporalMcpServer } from '../../src/mcp/temporal-mcp.server';
import { TEMPORAL_MCP_MODULE_OPTIONS } from '../../src/constants';
import { TemporalService } from '../../src/services/temporal.service';

describe('TemporalMcpModule', () => {
    const temporalServiceStub = {} as TemporalService;

    // Stands in for the real `TemporalModule`, which normally provides
    // `TemporalService` alongside `TemporalMcpModule` in a consuming app.
    @Global()
    @Module({
        providers: [{ provide: TemporalService, useValue: temporalServiceStub }],
        exports: [TemporalService],
    })
    class TemporalStubModule {}

    beforeEach(() => {
        jest.spyOn(McpServer.prototype, 'registerTool').mockImplementation(
            (() => undefined) as typeof McpServer.prototype.registerTool,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('registers TemporalMcpServer with default options', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [TemporalStubModule, TemporalMcpModule.forRoot()],
        }).compile();

        const server = moduleRef.get(TemporalMcpServer);
        const options = moduleRef.get(TEMPORAL_MCP_MODULE_OPTIONS);

        expect(server).toBeInstanceOf(TemporalMcpServer);
        expect(options).toEqual({});
    });

    it('exposes the options provided to forRoot', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                TemporalStubModule,
                TemporalMcpModule.forRoot({ name: 'custom-mcp', autoStart: false }),
            ],
        }).compile();

        const options = moduleRef.get(TEMPORAL_MCP_MODULE_OPTIONS);

        expect(options).toEqual({ name: 'custom-mcp', autoStart: false });
    });
});
