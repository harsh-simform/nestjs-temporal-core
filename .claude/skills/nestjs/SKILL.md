---
name: nestjs
description: NestJS module/DI conventions this repo follows — dynamic modules, DI tokens, DiscoveryModule auto-discovery, provider registration, lifecycle/shutdown hooks. Triggers on: register/registerAsync, dynamic module, DI token, provider, module registration, DiscoveryModule, lifecycle hook, useFactory, useClass, useExisting, shutdown hook, testing a provider.
---

# NestJS conventions in this repo

`TemporalModule` (`src/temporal.module.ts`) is a `DynamicModule` — the pattern to follow for any new module-level feature here.

## Registration decision matrix

| Need | API |
|------|-----|
| Static, synchronous config | `TemporalModule.register(options: Partial<TemporalOptions>)` |
| Config from another provider/async source | `TemporalModule.registerAsync({ useFactory \| useClass \| useExisting })` — matches `TemporalOptionsFactory` in `src/interfaces.ts` |

Both paths converge on the same `createCoreProviders(options)` internals — don't duplicate provider wiring between the two; add new providers once and let both entry points share it.

## DI tokens (`src/constants.ts`)

- `TEMPORAL_CLIENT` — the `@temporalio/client` `Client` instance.
- `TEMPORAL_CONNECTION` — the `NativeConnection` used by workers (separate lifecycle from the client connection — see `temporal-connection.factory.ts`).
- `TEMPORAL_MODULE_OPTIONS`, `WORKER_MODULE_OPTIONS`, `ACTIVITY_MODULE_OPTIONS` — resolved options objects injected into services.

Reuse these tokens via `@Inject(TOKEN)`; don't introduce a new string token for something an existing one already covers.

## DiscoveryModule auto-discovery

`TemporalModule.register`/`registerAsync` both import `DiscoveryModule` and register `TemporalDiscoveryService`, which scans the compiled Nest module graph at bootstrap for classes carrying `@Activity` metadata (written by `src/decorators/activity.decorator.ts`, read by `TemporalMetadataAccessor` in `src/services/temporal-metadata.service.ts`). This only works because the decorator writes metadata to **both** the class constructor and prototype — see the `decorator-metadata-auditor` subagent before changing decorator internals.

## Lifecycle / shutdown

- Worker start/stop is wired to Nest's lifecycle in `TemporalWorkerManagerService` (`src/services/temporal-worker.service.ts`).
- Graceful worker shutdown requires the consuming app to call `app.enableShutdownHooks()` in `main.ts` — this is a hard external requirement, not something the module can enforce; if you touch shutdown logic, check `temporal.module.ts`'s class doc-comment, which already documents this.

## Testing

- Tests live under `test/unit` (see `jest.config.js`); `test/integration` is referenced by `npm run test:integration` in `package.json` but doesn't currently exist as a directory — check before assuming an integration suite is present.
- Mock at the DI-token boundary (`TEMPORAL_CLIENT`, `TEMPORAL_CONNECTION`) rather than mocking `@temporalio/client` internals directly, matching how the existing services are constructed via Nest's testing module.
