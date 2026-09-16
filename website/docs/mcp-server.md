---
id: mcp-server
title: MCP Server
---

`TemporalMcpModule` exposes your app's `TemporalService` as an [MCP](https://modelcontextprotocol.io/) server, so MCP-aware clients — Claude Code, Claude Desktop, Cursor, or your own agent — can start, signal, query, and manage workflows and schedules directly, without you writing a bespoke tool layer.

## Use Case

- Let an AI coding assistant kick off a workflow and inspect its result while you're debugging.
- Give an on-call agent read/write access to schedules (pause a runaway schedule, trigger a catch-up run) without shelling into the cluster.
- Prototype an operator chat tool over your existing Temporal integration in minutes.

It is **not** a replacement for `TemporalService` in application code — use it alongside your existing controllers/services for the AI-facing surface only.

## Installation

```bash
npm install @modelcontextprotocol/sdk zod
```

Both are optional peer dependencies — only needed if you use `TemporalMcpModule`.

## Embedded in Your App

Import `TemporalMcpModule` alongside `TemporalModule`. It reuses the app's existing `TemporalService`, so no separate connection is created.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule, TemporalMcpModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalModule.register({
      connection: { address: 'localhost:7233' },
      taskQueue: 'my-queue',
    }),
    TemporalMcpModule.forRoot(),
  ],
})
export class AppModule {}
```

| Option | Default | Description |
|---|---|---|
| `name` | `'nestjs-temporal-core'` | Server name advertised to connecting clients |
| `version` | `'1.0.0'` | Server version advertised to connecting clients |
| `autoStart` | `true` | Connect the stdio transport on module init. Set `false` if the host process manages its own stdio, then call `TemporalMcpServer.start()` manually |

:::caution
The stdio transport takes over the process's stdin/stdout. Only enable it in a process an MCP client spawns directly — not inside a long-running HTTP server sharing the same stdio.
:::

## Standalone CLI

For MCP clients that spawn their own server process (e.g. Claude Desktop's stdio config), use the bundled CLI instead of wiring it into your app:

```bash
npx nestjs-temporal-core-mcp
```

Configured entirely through environment variables:

| Variable | Default | Description |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_API_KEY` | — | API key, for Temporal Cloud |
| `TEMPORAL_TASK_QUEUE` | — | Default task queue for `start_workflow` calls |
| `TEMPORAL_MCP_NAME` / `TEMPORAL_MCP_VERSION` | — | Override the advertised server name/version |
| `TEMPORAL_MCP_LOG` | `false` | Set `true` to enable internal logging |

Example Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "temporal": {
      "command": "npx",
      "args": ["nestjs-temporal-core-mcp"],
      "env": {
        "TEMPORAL_ADDRESS": "localhost:7233",
        "TEMPORAL_NAMESPACE": "default",
        "TEMPORAL_TASK_QUEUE": "my-queue"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|---|---|
| `start_workflow` | Start a new workflow execution (`workflowType`, `args`, `taskQueue`, `workflowId`) |
| `signal_workflow` | Send a signal to a running workflow |
| `query_workflow` | Query a running or completed workflow |
| `cancel_workflow` | Request cancellation of a running workflow |
| `terminate_workflow` | Forcibly terminate a running workflow |
| `list_schedules` | List schedules in the namespace |
| `describe_schedule` | Describe a schedule's current configuration and state |
| `pause_schedule` / `unpause_schedule` | Pause or resume a schedule |
| `trigger_schedule` | Trigger an immediate schedule action |
| `get_health` | Overall Temporal integration health status |
| `get_stats` | Activity/schedule/worker statistics |

Every tool returns the same result shape `TemporalService` itself produces (e.g. `{ success, result, error }`) serialized as JSON text, so failures are visible to the calling agent instead of silently swallowed.

Next: [Troubleshooting](./troubleshooting.md).
