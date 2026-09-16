---
id: best-practices
title: Best Practices
---

## 1. Workflow Design

**✅ DO:**
- Keep workflows deterministic (no random numbers, current time, network calls)
- Use activities for any non-deterministic operations
- Keep workflow history size manageable (use continue-as-new for long-running workflows)
- Export workflow functions (not classes)
- Use `defineSignal` and `defineQuery` at module level

**❌ DON'T:**
- Don't use `@Injectable()` on workflow functions
- Don't inject NestJS services in workflows
- Don't use `Math.random()` or `Date.now()` directly in workflows
- Don't make HTTP calls or database queries directly in workflows

## 2. Activity Design

**✅ DO:**
- Make activities idempotent (safe to retry)
- Use `@Injectable()` and leverage NestJS DI
- Use `@Activity()` and `@ActivityMethod()` decorators
- Handle errors appropriately
- Log activity execution for debugging

**❌ DON'T:**
- Don't make activities too granular (network overhead)
- Don't rely on activity execution order guarantees
- Don't share mutable state between activity invocations

## 3. Configuration

**✅ DO:**
- Use async configuration for environment-based setup
- Configure appropriate timeouts for your use case
- Set up proper retry policies
- Enable graceful shutdown hooks
- Use task queues to organize work

**❌ DON'T:**
- Don't hardcode connection strings
- Don't use the same task queue for all workflows
- Don't ignore timeout configurations

## 4. Error Handling

**✅ DO:**
- Implement compensation logic in workflows
- Use appropriate retry policies
- Log errors with context
- Define non-retryable error types
- Handle activity failures gracefully

**❌ DON'T:**
- Don't swallow errors silently
- Don't retry indefinitely
- Don't ignore business-level failures

## 5. Testing

**✅ DO:**
- Write unit tests for activities
- Use TestWorkflowEnvironment for integration tests
- Mock external dependencies
- Test failure scenarios
- Test signal and query handlers

**❌ DON'T:**
- Don't skip workflow testing
- Don't test against production Temporal server
- Don't assume workflows are correct without testing

Next: [Health Monitoring](./health-monitoring.md).
