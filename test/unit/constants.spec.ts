import {
    // Injection Tokens
    ACTIVITY_MODULE_OPTIONS,
    SCHEDULES_MODULE_OPTIONS,
    TEMPORAL_CLIENT,
    TEMPORAL_CONNECTION,
    TEMPORAL_MODULE_OPTIONS,
    WORKER_MODULE_OPTIONS,
    // Metadata Keys
    RUN_ID_METADATA,
    TASK_QUEUE_METADATA,
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_SCHEDULED_WORKFLOW,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_WORKFLOW,
    TEMPORAL_WORKFLOW_RUN,
    TEMPORAL_CHILD_WORKFLOW,
    WORKFLOW_CONTEXT_METADATA,
    WORKFLOW_ID_METADATA,
    WORKFLOW_PARAMS_METADATA,
    // Default Values
    DEFAULT_CONNECTION_TIMEOUT_MS,
    DEFAULT_NAMESPACE,
    DEFAULT_TASK_QUEUE,
    // Predefined Cron Expressions
    CRON_EXPRESSIONS,
    // Predefined Interval Expressions
    INTERVAL_EXPRESSIONS,
    // Predefined Timeout Values
    TIMEOUTS,
    // Retry Policy Presets
    RETRY_POLICIES,
    // Enums
    ScheduleOverlapPolicy,
    WorkflowIdConflictPolicy,
    WorkflowIdReusePolicy,
} from '../../src/constants';

describe('Constants', () => {
    describe('Injection Tokens', () => {
        it('should export all injection tokens', () => {
            expect(ACTIVITY_MODULE_OPTIONS).toBe('ACTIVITY_MODULE_OPTIONS');
            expect(SCHEDULES_MODULE_OPTIONS).toBe('SCHEDULES_MODULE_OPTIONS');
            expect(TEMPORAL_CLIENT).toBe('TEMPORAL_CLIENT');
            expect(TEMPORAL_CONNECTION).toBe('TEMPORAL_CONNECTION');
            expect(TEMPORAL_MODULE_OPTIONS).toBe('TEMPORAL_MODULE_OPTIONS');
            expect(WORKER_MODULE_OPTIONS).toBe('WORKER_MODULE_OPTIONS');
        });

        it('should have unique injection token values', () => {
            const tokens = [
                ACTIVITY_MODULE_OPTIONS,
                SCHEDULES_MODULE_OPTIONS,
                TEMPORAL_CLIENT,
                TEMPORAL_CONNECTION,
                TEMPORAL_MODULE_OPTIONS,
                WORKER_MODULE_OPTIONS,
            ];
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);
        });
    });

    describe('Metadata Keys', () => {
        it('should export all metadata keys', () => {
            expect(RUN_ID_METADATA).toBe('workflow:runId');
            expect(TASK_QUEUE_METADATA).toBe('workflow:taskQueue');
            expect(TEMPORAL_ACTIVITY).toBe('TEMPORAL_ACTIVITY');
            expect(TEMPORAL_ACTIVITY_METHOD).toBe('TEMPORAL_ACTIVITY_METHOD');
            expect(TEMPORAL_QUERY_METHOD).toBe('TEMPORAL_QUERY_METHOD');
            expect(TEMPORAL_SCHEDULED_WORKFLOW).toBe('TEMPORAL_SCHEDULED_WORKFLOW');
            expect(TEMPORAL_SIGNAL_METHOD).toBe('TEMPORAL_SIGNAL_METHOD');
            expect(TEMPORAL_WORKFLOW).toBe('TEMPORAL_WORKFLOW');
            expect(TEMPORAL_WORKFLOW_RUN).toBe('TEMPORAL_WORKFLOW_RUN');
            expect(TEMPORAL_CHILD_WORKFLOW).toBe('TEMPORAL_CHILD_WORKFLOW');
            expect(WORKFLOW_CONTEXT_METADATA).toBe('workflow:context');
            expect(WORKFLOW_ID_METADATA).toBe('workflow:id');
            expect(WORKFLOW_PARAMS_METADATA).toBe('workflow:params');
        });

        it('should have unique metadata key values', () => {
            const keys = [
                RUN_ID_METADATA,
                TASK_QUEUE_METADATA,
                TEMPORAL_ACTIVITY,
                TEMPORAL_ACTIVITY_METHOD,
                TEMPORAL_QUERY_METHOD,
                TEMPORAL_SCHEDULED_WORKFLOW,
                TEMPORAL_SIGNAL_METHOD,
                TEMPORAL_WORKFLOW,
                TEMPORAL_WORKFLOW_RUN,
                TEMPORAL_CHILD_WORKFLOW,
                WORKFLOW_CONTEXT_METADATA,
                WORKFLOW_ID_METADATA,
                WORKFLOW_PARAMS_METADATA,
            ];
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
        });
    });

    describe('Default Values', () => {
        it('should export default connection timeout', () => {
            expect(DEFAULT_CONNECTION_TIMEOUT_MS).toBe(5000);
            expect(typeof DEFAULT_CONNECTION_TIMEOUT_MS).toBe('number');
        });

        it('should export default namespace', () => {
            expect(DEFAULT_NAMESPACE).toBe('default');
            expect(typeof DEFAULT_NAMESPACE).toBe('string');
        });

        it('should export default task queue', () => {
            expect(DEFAULT_TASK_QUEUE).toBe('default-task-queue');
            expect(typeof DEFAULT_TASK_QUEUE).toBe('string');
        });
    });

    describe('CRON_EXPRESSIONS', () => {
        it('should export all cron expressions', () => {
            expect(CRON_EXPRESSIONS.EVERY_15_MINUTES).toBe('*/15 * * * *');
            expect(CRON_EXPRESSIONS.EVERY_2_HOURS).toBe('0 */2 * * *');
            expect(CRON_EXPRESSIONS.EVERY_30_MINUTES).toBe('*/30 * * * *');
            expect(CRON_EXPRESSIONS.EVERY_5_MINUTES).toBe('*/5 * * * *');
            expect(CRON_EXPRESSIONS.EVERY_6_HOURS).toBe('0 */6 * * *');
            expect(CRON_EXPRESSIONS.EVERY_12_HOURS).toBe('0 */12 * * *');
            expect(CRON_EXPRESSIONS.EVERY_HOUR).toBe('0 * * * *');
            expect(CRON_EXPRESSIONS.EVERY_MINUTE).toBe('* * * * *');
            expect(CRON_EXPRESSIONS.DAILY_6AM).toBe('0 6 * * *');
            expect(CRON_EXPRESSIONS.DAILY_6PM).toBe('0 18 * * *');
            expect(CRON_EXPRESSIONS.DAILY_8AM).toBe('0 8 * * *');
            expect(CRON_EXPRESSIONS.DAILY_MIDNIGHT).toBe('0 0 * * *');
            expect(CRON_EXPRESSIONS.DAILY_NOON).toBe('0 12 * * *');
            expect(CRON_EXPRESSIONS.MONTHLY_FIRST).toBe('0 0 1 * *');
            expect(CRON_EXPRESSIONS.MONTHLY_LAST).toBe('0 0 28-31 * *');
            expect(CRON_EXPRESSIONS.WEEKLY_FRIDAY_5PM).toBe('0 17 * * 5');
            expect(CRON_EXPRESSIONS.WEEKLY_MONDAY_9AM).toBe('0 9 * * 1');
            expect(CRON_EXPRESSIONS.WEEKLY_SUNDAY_MIDNIGHT).toBe('0 0 * * 0');
            expect(CRON_EXPRESSIONS.YEARLY).toBe('0 0 1 1 *');
        });

        it('should have valid cron expression format', () => {
            const cronExpressions = Object.values(CRON_EXPRESSIONS);
            cronExpressions.forEach((expression) => {
                expect(typeof expression).toBe('string');
                expect(expression.length).toBeGreaterThan(0);
                expect(expression.split(' ').length).toBe(5);
            });
        });

        it('should be readonly', () => {
            expect(() => {
                (CRON_EXPRESSIONS as any).EVERY_15_MINUTES = 'invalid';
            }).toThrow();
        });
    });

    describe('INTERVAL_EXPRESSIONS', () => {
        it('should export all interval expressions', () => {
            expect(INTERVAL_EXPRESSIONS.DAILY).toBe('24h');
            expect(INTERVAL_EXPRESSIONS.EVERY_10_SECONDS).toBe('10s');
            expect(INTERVAL_EXPRESSIONS.EVERY_15_MINUTES).toBe('15m');
            expect(INTERVAL_EXPRESSIONS.EVERY_2_DAYS).toBe('48h');
            expect(INTERVAL_EXPRESSIONS.EVERY_2_HOURS).toBe('2h');
            expect(INTERVAL_EXPRESSIONS.EVERY_30_MINUTES).toBe('30m');
            expect(INTERVAL_EXPRESSIONS.EVERY_30_SECONDS).toBe('30s');
            expect(INTERVAL_EXPRESSIONS.EVERY_5_MINUTES).toBe('5m');
            expect(INTERVAL_EXPRESSIONS.EVERY_6_HOURS).toBe('6h');
            expect(INTERVAL_EXPRESSIONS.EVERY_12_HOURS).toBe('12h');
            expect(INTERVAL_EXPRESSIONS.EVERY_HOUR).toBe('1h');
            expect(INTERVAL_EXPRESSIONS.EVERY_MINUTE).toBe('1m');
            expect(INTERVAL_EXPRESSIONS.WEEKLY).toBe('168h');
        });

        it('should have valid interval expression format', () => {
            const intervalExpressions = Object.values(INTERVAL_EXPRESSIONS);
            intervalExpressions.forEach((expression) => {
                expect(typeof expression).toBe('string');
                expect(expression.length).toBeGreaterThan(0);
                expect(/^\d+[smhd]$/.test(expression)).toBe(true);
            });
        });

        it('should be readonly', () => {
            expect(() => {
                (INTERVAL_EXPRESSIONS as any).DAILY = 'invalid';
            }).toThrow();
        });
    });

    describe('TIMEOUTS', () => {
        it('should export all timeout values', () => {
            expect(TIMEOUTS.ACTIVITY_LONG).toBe('30m');
            expect(TIMEOUTS.ACTIVITY_MEDIUM).toBe('5m');
            expect(TIMEOUTS.ACTIVITY_SHORT).toBe('1m');
            expect(TIMEOUTS.CONNECTION_TIMEOUT).toBe('10s');
            expect(TIMEOUTS.HEARTBEAT).toBe('30s');
            expect(TIMEOUTS.QUERY_TIMEOUT).toBe('5s');
            expect(TIMEOUTS.SIGNAL_TIMEOUT).toBe('10s');
            expect(TIMEOUTS.STARTUP_TIMEOUT).toBe('30s');
            expect(TIMEOUTS.WORKFLOW_LONG).toBe('7d');
            expect(TIMEOUTS.WORKFLOW_MEDIUM).toBe('24h');
            expect(TIMEOUTS.WORKFLOW_SHORT).toBe('1h');
        });

        it('should have valid timeout format', () => {
            const timeouts = Object.values(TIMEOUTS);
            timeouts.forEach((timeout) => {
                expect(typeof timeout).toBe('string');
                expect(timeout.length).toBeGreaterThan(0);
                expect(/^\d+[smhd]$/.test(timeout)).toBe(true);
            });
        });

        it('should be readonly', () => {
            expect(() => {
                (TIMEOUTS as any).ACTIVITY_LONG = 'invalid';
            }).toThrow();
        });
    });

    describe('RETRY_POLICIES', () => {
        it('should export all retry policy presets', () => {
            expect(RETRY_POLICIES.AGGRESSIVE).toBeDefined();
            expect(RETRY_POLICIES.CONSERVATIVE).toBeDefined();
            expect(RETRY_POLICIES.QUICK).toBeDefined();
            expect(RETRY_POLICIES.STANDARD).toBeDefined();
        });

        it('should have valid retry policy structure', () => {
            Object.values(RETRY_POLICIES).forEach((policy) => {
                expect(policy).toHaveProperty('maximumAttempts');
                expect(policy).toHaveProperty('initialInterval');
                expect(policy).toHaveProperty('maximumInterval');
                expect(policy).toHaveProperty('backoffCoefficient');

                expect(typeof policy.maximumAttempts).toBe('number');
                expect(typeof policy.initialInterval).toBe('string');
                expect(typeof policy.maximumInterval).toBe('string');
                expect(typeof policy.backoffCoefficient).toBe('number');
            });
        });

        it('should have reasonable retry policy values', () => {
            expect(RETRY_POLICIES.AGGRESSIVE.maximumAttempts).toBe(10);
            expect(RETRY_POLICIES.CONSERVATIVE.maximumAttempts).toBe(3);
            expect(RETRY_POLICIES.QUICK.maximumAttempts).toBe(3);
            expect(RETRY_POLICIES.STANDARD.maximumAttempts).toBe(5);
        });

        it('should be readonly', () => {
            expect(() => {
                (RETRY_POLICIES as any).AGGRESSIVE = {};
            }).toThrow();
        });
    });

    describe('ScheduleOverlapPolicy enum', () => {
        it('should export all overlap policy values', () => {
            expect(ScheduleOverlapPolicy.ALLOW_ALL).toBe('ALLOW_ALL');
            expect(ScheduleOverlapPolicy.SKIP).toBe('SKIP');
            expect(ScheduleOverlapPolicy.BUFFER_ONE).toBe('BUFFER_ONE');
            expect(ScheduleOverlapPolicy.BUFFER_ALL).toBe('BUFFER_ALL');
            expect(ScheduleOverlapPolicy.CANCEL_OTHER).toBe('CANCEL_OTHER');
        });

        it('should have unique values', () => {
            const values = Object.values(ScheduleOverlapPolicy);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });
    });

    describe('WorkflowIdConflictPolicy enum', () => {
        it('should export all conflict policy values', () => {
            expect(WorkflowIdConflictPolicy.REJECT_DUPLICATE).toBe('REJECT_DUPLICATE');
            expect(WorkflowIdConflictPolicy.TERMINATE_IF_RUNNING).toBe('TERMINATE_IF_RUNNING');
            expect(WorkflowIdConflictPolicy.ALLOW_DUPLICATE).toBe('ALLOW_DUPLICATE');
        });

        it('should have unique values', () => {
            const values = Object.values(WorkflowIdConflictPolicy);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });
    });

    describe('WorkflowIdReusePolicy enum', () => {
        it('should export all reuse policy values', () => {
            expect(WorkflowIdReusePolicy.ALLOW_DUPLICATE).toBe(0);
            expect(WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY).toBe(1);
            expect(WorkflowIdReusePolicy.REJECT_DUPLICATE).toBe(2);
            expect(WorkflowIdReusePolicy.TERMINATE_IF_RUNNING).toBe(3);
        });

        it('should have numeric values', () => {
            // Check the actual enum values directly
            expect(WorkflowIdReusePolicy.ALLOW_DUPLICATE).toBe(0);
            expect(WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY).toBe(1);
            expect(WorkflowIdReusePolicy.REJECT_DUPLICATE).toBe(2);
            expect(WorkflowIdReusePolicy.TERMINATE_IF_RUNNING).toBe(3);
        });

        it('should have unique values', () => {
            const values = Object.values(WorkflowIdReusePolicy);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });
    });

    describe('Integration Tests', () => {
        it('should work with common scheduling patterns', () => {
            // Test cron expressions
            expect(CRON_EXPRESSIONS.DAILY_MIDNIGHT).toBe('0 0 * * *');
            expect(CRON_EXPRESSIONS.EVERY_HOUR).toBe('0 * * * *');
            expect(CRON_EXPRESSIONS.WEEKLY_MONDAY_9AM).toBe('0 9 * * 1');

            // Test interval expressions
            expect(INTERVAL_EXPRESSIONS.DAILY).toBe('24h');
            expect(INTERVAL_EXPRESSIONS.EVERY_HOUR).toBe('1h');
            expect(INTERVAL_EXPRESSIONS.EVERY_5_MINUTES).toBe('5m');

            // Test timeouts
            expect(TIMEOUTS.ACTIVITY_SHORT).toBe('1m');
            expect(TIMEOUTS.WORKFLOW_LONG).toBe('7d');
            expect(TIMEOUTS.CONNECTION_TIMEOUT).toBe('10s');
        });

        it('should provide consistent retry policies', () => {
            expect(RETRY_POLICIES.STANDARD.maximumAttempts).toBe(5);
            expect(RETRY_POLICIES.STANDARD.initialInterval).toBe('5s');
            expect(RETRY_POLICIES.STANDARD.maximumInterval).toBe('60s');
            expect(RETRY_POLICIES.STANDARD.backoffCoefficient).toBe(2.0);
        });

        it('should provide valid enum values for workflow policies', () => {
            expect(WorkflowIdReusePolicy.ALLOW_DUPLICATE).toBe(0);
            expect(WorkflowIdConflictPolicy.REJECT_DUPLICATE).toBe('REJECT_DUPLICATE');
            expect(ScheduleOverlapPolicy.ALLOW_ALL).toBe('ALLOW_ALL');
        });
    });
});
