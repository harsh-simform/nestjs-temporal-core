# nestjs-temporal-core

NestJS integration library for Temporal.io (auto-discovery, declarative scheduling, worker management). Published as the `nestjs-temporal-core` npm package.

Full architecture, conventions, subagents, skills, and MCP server docs: see **[CLAUDE.md](./CLAUDE.md)** — it applies to any AI coding agent working in this repo, not just Claude Code.

## Build & Test

```bash
npm run build          # tsc → dist/
npm run test           # jest
npm run lint           # eslint src/**/*.ts
npm run format          # prettier
npm run type-check      # tsc --noEmit
```

## Hard constraint

Workflow code (`@temporalio/workflow` imports) runs in a v8 isolated sandbox — no DI, no NestJS imports, no non-deterministic calls. Violations compile fine and only fail at runtime during replay. See CLAUDE.md's "Important Constraints" section before touching `src/decorators/workflow.decorator.ts` or `src/workflow-proxy/`.
