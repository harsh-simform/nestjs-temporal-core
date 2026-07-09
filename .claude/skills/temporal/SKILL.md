---
name: temporal
description: Temporal.io SDK concepts and this repo's conventions for workflows, activities, signals/queries/updates, schedules, and worker/client wiring. Triggers on: add a workflow, add an activity, signal handler, query handler, update handler, schedule, worker configuration, connection setup, workflow proxy, Temporal client usage, task queue, retry policy, timeout.
---

# Temporal.io in this repo

This library wraps `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/common` (peer deps, version range in `package.json`; verify current SDK behavior with the `temporal-sdk-researcher` subagent before relying on a signature from memory).

## Concept decision matrix

| Need | Use | Runs in |
|------|-----|---------|
| Business logic, orchestration, waiting | Workflow | v8 isolate sandbox — deterministic only |
| I/O, DB, HTTP, non-deterministic work | Activity (`@Activity`/`@ActivityMethod`, `src/decorators/activity.decorator.ts`) | Normal Node context, full DI |
| External event pushed into a running workflow | `@SignalMethod` | Workflow sandbox |
| Read workflow state without mutating it | `@QueryMethod` | Workflow sandbox |
| Mutate + return a value synchronously | `@UpdateMethod` | Workflow sandbox |
| Spawn a workflow from another workflow | `@ChildWorkflow` | Workflow sandbox |
| Recurring/cron-like execution | `TemporalScheduleService` (`src/services/temporal-schedule.service.ts`) | Client-side, not sandboxed |

If a change adds/edits workflow code, run the `workflow-sandbox-reviewer` subagent afterward — sandbox violations (DI, non-determinism) compile fine and only fail at runtime during replay.

## Where things live

- `src/decorators/activity.decorator.ts`, `src/decorators/workflow.decorator.ts` — decorator definitions, write `Reflect.defineMetadata` on both constructor and prototype (see `decorator-metadata-auditor` subagent).
- `src/services/temporal.service.ts` — public facade; prefer this over reaching for `@temporalio/client` directly in application code.
- `src/services/temporal-client.service.ts` — wraps `Client`, owns the client-side connection.
- `src/services/temporal-worker.service.ts` — worker lifecycle (start/stop/graceful shutdown), tied to NestJS shutdown hooks.
- `src/services/temporal-connection.factory.ts` (+ `src/providers/temporal-connection.factory.ts`) — separate connections for client vs worker; do not share one connection across both.
- `src/services/temporal-discovery.service.ts` — scans the Nest module graph via `DiscoveryModule` for `@Activity` classes at bootstrap.
- `src/workflow-proxy/` — `WorkflowProxyFactory.createProxy<T>({ workflowType, taskQueue })` returns a typed proxy over `client.workflow.start`; prefer this over hand-rolling `client.workflow.start` calls in consumer code.
- `src/constants.ts` — injection tokens (`TEMPORAL_CLIENT`, `TEMPORAL_CONNECTION`, `TEMPORAL_MODULE_OPTIONS`, `WORKER_MODULE_OPTIONS`, `ACTIVITY_MODULE_OPTIONS`), metadata keys (`TEMPORAL_ACTIVITY`, `TEMPORAL_SIGNAL_METHOD`, etc.), `TIMEOUTS` and `RETRY_POLICIES` presets — reuse these presets instead of inlining new timeout/retry literals.

## Conventions

- Timeouts/retries: pull from `TIMEOUTS`/`RETRY_POLICIES` in `constants.ts` when a preset fits; only add a bespoke value when none of the presets apply.
- `WorkflowIdConflictPolicy` / `WorkflowIdReusePolicy` enums in `constants.ts` mirror the SDK's own enums — reuse them rather than importing the SDK enum directly, to keep the public API stable across SDK version bumps.
- Before implementing a feature against a `@temporalio/*` API you're not certain about, invoke `temporal-sdk-researcher` rather than assuming the signature — this repo has already shipped a fix for SDK API drift (`fix: update Temporal.io dependencies to version 1.19.1`).
