#!/usr/bin/env node
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TemporalModule } from '../temporal.module';
import { TemporalMcpModule } from '../mcp';

/**
 * Standalone MCP server process, independent of any NestJS app. Connects
 * directly to Temporal using environment variables, for MCP clients that
 * spawn their own server process (e.g. Claude Desktop's stdio config).
 */
@Module({
    imports: [
        TemporalModule.register({
            connection: {
                address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
                namespace: process.env.TEMPORAL_NAMESPACE || 'default',
                apiKey: process.env.TEMPORAL_API_KEY,
            },
            taskQueue: process.env.TEMPORAL_TASK_QUEUE,
            enableLogger: process.env.TEMPORAL_MCP_LOG === 'true',
        }),
        TemporalMcpModule.forRoot({
            name: process.env.TEMPORAL_MCP_NAME,
            version: process.env.TEMPORAL_MCP_VERSION,
        }),
    ],
})
class TemporalMcpBootstrapModule {}

NestFactory.createApplicationContext(TemporalMcpBootstrapModule, { logger: false }).catch(
    (error) => {
        console.error('Failed to start Temporal MCP server:', error);
        process.exit(1);
    },
);
