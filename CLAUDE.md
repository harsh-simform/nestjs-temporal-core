# nestjs-temporal-core

NestJS integration library for Temporal.io. Provides auto-discovery, declarative scheduling, worker management, and enterprise features for running Temporal workflows in NestJS apps.

## Architecture

```
src/
  temporal.module.ts          # Main DynamicModule (register / registerAsync)
  interfaces.ts               # All TypeScript interfaces (TemporalOptions, etc.)
  constants.ts                # DI tokens: TEMPORAL_CLIENT, TEMPORAL_CONNECTION, etc.
  decorators/
    activity.decorator.ts     # @Activity, @ActivityMethod
    workflow.decorator.ts     # @SignalMethod, @QueryMethod, @UpdateMethod, @ChildWorkflow
  services/
    temporal.service.ts       # Public facade — start/signal/query/cancel workflows
    temporal-client.service.ts     # Wraps @temporalio/client Client
    temporal-connection.factory.ts # Connection pooling (client + worker connections)
    temporal-discovery.service.ts  # Auto-discovers @Activity classes via NestJS DiscoveryModule
    temporal-schedule.service.ts   # CRUD for Temporal schedules
    temporal-worker.service.ts     # Worker lifecycle (start/stop/graceful shutdown)
    temporal-metadata.service.ts   # Reads Reflect.metadata from decorators
  providers/
    temporal-connection.factory.ts # NestJS provider wrapping connection factory
  health/
    temporal-health.controller.ts  # /health endpoint
    temporal-health.module.ts
  utils/
    logger.ts         # Singleton TemporalLoggerManager, createLogger()
    metadata.ts       # Helpers for reading @Activity/@ActivityMethod metadata
    validation.ts     # validateSignalName/validateQueryName/validateUpdateName
    workflow-token.ts # Generates DI tokens for workflow proxies
  workflow-proxy/
    workflow-proxy.ts          # WorkflowProxy class
    workflow-proxy.factory.ts  # WorkflowProxyFactory — typed proxy creation
  types/
    reflect-metadata.d.ts      # Ambient Reflect.metadata typings
```

Each folder (`decorators/`, `utils/`, `workflow-proxy/`) and `src/` itself re-exports its public surface via `index.ts`.

## Key Patterns

- **Module registration**: `TemporalModule.register(options)` or `TemporalModule.registerAsync({useFactory, useClass, useExisting})`
- **DI tokens**: `TEMPORAL_CLIENT` (Temporal Client), `TEMPORAL_CONNECTION` (NativeConnection for workers)
- **Decorators store metadata via `Reflect.defineMetadata`** on both constructor and prototype for compatibility with DiscoveryModule
- **Auto-discovery**: `TemporalDiscoveryService` scans NestJS module graph for classes decorated with `@Activity`
- **WorkflowProxy**: `WorkflowProxyFactory.createProxy<T>({workflowType, taskQueue})` returns a typed proxy that wraps `client.workflow.start`
- **Graceful shutdown**: Worker shutdown hooks are registered on NestJS lifecycle; requires `app.enableShutdownHooks()` in main.ts

## Build & Test

```bash
npm run build          # tsc → dist/
npm run test           # jest
npm run lint           # eslint src/**/*.ts
npm run format         # prettier
```

## Important Constraints

- Workflows run in v8 isolated sandbox — no DI, no imports from NestJS context
- Signal/Query/Update decorators register Reflect metadata only; actual handler wiring happens at worker runtime
- Connection factory creates separate connections for client vs worker (different lifecycle)
- `TemporalLoggerManager` is a singleton; call `getInstance()` then `configure()` to set log level

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- This rule holds for the entire session, not just the first message — and it applies to any subagent spawned for code exploration in this repo. When delegating exploration via the Agent tool, tell the subagent explicitly to run `graphify query`/`explain`/`path` before grepping or reading raw files.
- `.claude/settings.json` runs `graphify update .` automatically via a PostToolUse hook after every Edit/Write to a `.ts` file made through Claude Code tools (incremental, ~1-2s) — the graph should already be current. Only run it manually after edits made outside Claude Code (a plain editor, a merge, a generated file).

## claude-mem

This project's memory (`~/.claude-mem`) is global, not project-scoped, and injects relevant context passively at session start and per prompt. For non-trivial tasks (multi-file changes, bug investigations, "did we solve this before" questions, or anything where past decisions matter), explicitly search it before drafting a solution rather than relying only on passive injection — use the `mcp__plugin_claude-mem_mcp-search__search` (or `smart_search`) tool. Skip this for trivial, single-file, no-context-needed edits — it's not worth the round trip.
