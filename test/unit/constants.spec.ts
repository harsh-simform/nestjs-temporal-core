import {
    // Injection Tokens
    ACTIVITY_MODULE_OPTIONS,
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
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
    WORKFLOW_CONTEXT_METADATA,
    WORKFLOW_ID_METADATA,
    WORKFLOW_PARAMS_METADATA,
    // Default Values
    DEFAULT_CONNECTION_TIMEOUT_MS,
    DEFAULT_NAMESPACE,
    DEFAULT_TASK_QUEUE,
    // Predefined Timeout Values
    TIMEOUTS,
    // Retry Policy Presets
    RETRY_POLICIES,
    // Enums
    WorkflowIdConflictPolicy,
    WorkflowIdReusePolicy,
} from '../../src/constants';

describe('Constants', () => {
    describe('Injection Tokens', () => {
        it('should export all injection tokens', () => {
            expect(ACTIVITY_MODULE_OPTIONS).toBe('ACTIVITY_MODULE_OPTIONS');
            expect(TEMPORAL_CLIENT).toBe('TEMPORAL_CLIENT');
            expect(TEMPORAL_CONNECTION).toBe('TEMPORAL_CONNECTION');
            expect(TEMPORAL_MODULE_OPTIONS).toBe('TEMPORAL_MODULE_OPTIONS');
            expect(WORKER_MODULE_OPTIONS).toBe('WORKER_MODULE_OPTIONS');
        });

        it('should have unique injection token values', () => {
            const tokens = [
                ACTIVITY_MODULE_OPTIONS,
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
            expect(TEMPORAL_SIGNAL_METHOD).toBe('TEMPORAL_SIGNAL_METHOD');
            // TEMPORAL_WORKFLOW and TEMPORAL_WORKFLOW_RUN constants removed
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
                TEMPORAL_SIGNAL_METHOD,
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
            // Note: Cron and interval expressions removed due to static configuration issues

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
            // Note: ScheduleOverlapPolicy removed due to static configuration issues
        });
    });
});
