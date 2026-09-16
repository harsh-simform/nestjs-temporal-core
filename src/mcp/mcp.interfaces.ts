/**
 * Configuration options for `TemporalMcpModule.forRoot()`.
 */
export interface TemporalMcpModuleOptions {
    /**
     * MCP server name advertised to connecting clients.
     * @default 'nestjs-temporal-core'
     */
    name?: string;
    /**
     * MCP server version advertised to connecting clients.
     * @default '1.0.0'
     */
    version?: string;
    /**
     * Connect the stdio transport automatically on module init.
     * Disable when the host process manages its own stdio (e.g. embedding the
     * MCP server inside a larger app) and call `TemporalMcpServer.start()` manually.
     * @default true
     */
    autoStart?: boolean;
}
