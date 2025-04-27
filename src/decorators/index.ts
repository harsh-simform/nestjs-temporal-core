/**
 * Re-export all decorators for easier imports
 */

// Activity decorators
export * from './activity.decorator';
export * from './activity-method.decorator';

// Workflow decorators
export * from './workflow.decorator';
export * from './workflow-method.decorator';
export * from './signal-method.decorator';
export * from './query-method.decorator';

/**
 * Example usage:
 *
 * Activity definition:
 * ```typescript
 * import { Activity, ActivityMethod } from 'nestjs-temporal-core';
 *
 * @Activity()
 * export class EmailActivities {
 *   @ActivityMethod()
 *   async sendWelcomeEmail(to: string): Promise<boolean> {
 *     // Send email implementation
 *     return true;
 *   }
 * }
 * ```
 *
 * Workflow definition:
 * ```typescript
 * import { Workflow, WorkflowMethod, SignalMethod, QueryMethod } from 'nestjs-temporal-core';
 *
 * @Workflow({
 *   name: 'UserOnboardingWorkflow',
 *   taskQueue: 'user-onboarding'
 * })
 * export class UserOnboardingWorkflow {
 *   private status = 'pending';
 *   private userData: any = {};
 *
 *   @WorkflowMethod()
 *   async onboardUser(userId: string): Promise<string> {
 *     this.status = 'started';
 *     // Workflow implementation
 *     this.status = 'completed';
 *     return 'completed';
 *   }
 *
 *   @SignalMethod()
 *   async updateUserData(data: any): void {
 *     this.userData = { ...this.userData, ...data };
 *   }
 *
 *   @QueryMethod()
 *   getStatus(): string {
 *     return this.status;
 *   }
 * }
 * ```
 */
