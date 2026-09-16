/**
 * Sandbox-safe helpers for use *inside* Temporal workflow files.
 *
 * Workflow code runs in a v8-isolated sandbox with no NestJS/DI access and
 * no non-deterministic calls. This module (and everything it imports) is
 * kept free of NestJS/Temporal-worker/Temporal-client imports - and free of
 * `reflect-metadata`/`Reflect.getMetadata` reads, which would require the
 * real `@Injectable()`-decorated activity class as a *value* here, pulling
 * its whole NestJS/DI import graph into the workflow bundle - so it's safe
 * to import from a workflow file's module graph.
 *
 * Import from the `nestjs-temporal-core/workflow-utils` subpath, not the
 * main package entry - the main entry pulls in NestJS-DI-heavy code that
 * has no business being reachable from a workflow bundle.
 */
import { LOCAL_ACTIVITY_PRESETS } from './constants';
import type { LocalActivityOptions } from './interfaces';

/**
 * Merges explicit `LocalActivityOptions` over a preset baseline (default:
 * `LOCAL_ACTIVITY_PRESETS.STANDARD`), for passing straight into
 * `proxyLocalActivities()`.
 *
 * To keep the worker-side `@ActivityMethod({ localActivityOptions })` and
 * this workflow-side call from drifting apart, define the options object as
 * a plain, NestJS-free constant in a shared file and import it on both
 * sides - see the example below. This function never reads decorator
 * metadata itself (that would require value-importing the DI-decorated
 * activity class into the workflow bundle), so it takes the options
 * directly instead.
 *
 * @param options - Explicit options; take precedence over `defaults`
 * @param defaults - Baseline options
 *
 * @example
 * ```typescript
 * // activities/pricing.local-activity-options.ts (plain, NestJS-free — shared by both sides)
 * export const QUICK_PRICE_LOOKUP_OPTIONS = { scheduleToCloseTimeout: '2s' };
 *
 * // activities/pricing.activity.ts
 * import { QUICK_PRICE_LOOKUP_OPTIONS } from './pricing.local-activity-options';
 *
 * @Injectable()
 * @Activity({ name: 'pricing-activities' })
 * export class PricingActivity {
 *   @ActivityMethod({ local: true, localActivityOptions: QUICK_PRICE_LOOKUP_OPTIONS })
 *   quickPriceLookup(sku: string): number { ... }
 * }
 *
 * // workflows/pricing.workflow.ts (runs in the sandbox — no NestJS imports here)
 * import { proxyLocalActivities } from '@temporalio/workflow';
 * import { buildLocalActivityProxyOptions } from 'nestjs-temporal-core/workflow-utils';
 * import { QUICK_PRICE_LOOKUP_OPTIONS } from '../activities/pricing.local-activity-options';
 * import type { PricingActivity } from '../activities/pricing.activity';
 *
 * const { quickPriceLookup } = proxyLocalActivities<Pick<PricingActivity, 'quickPriceLookup'>>(
 *   buildLocalActivityProxyOptions(QUICK_PRICE_LOOKUP_OPTIONS),
 * );
 * ```
 */
export function buildLocalActivityProxyOptions(
    options: Partial<LocalActivityOptions> = {},
    defaults: Partial<LocalActivityOptions> = LOCAL_ACTIVITY_PRESETS.STANDARD as Partial<LocalActivityOptions>,
): LocalActivityOptions {
    return { ...defaults, ...options } as LocalActivityOptions;
}
