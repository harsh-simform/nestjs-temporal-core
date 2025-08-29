import * as TemporalCore from '../../src/index';

describe('Main Index Module', () => {
    describe('Module Exports', () => {
        it('should export TemporalModule', () => {
            expect(TemporalCore.TemporalModule).toBeDefined();
            expect(typeof TemporalCore.TemporalModule).toBe('function');
        });
    });

    describe('Service Exports', () => {
        it('should export TemporalService', () => {
            expect(TemporalCore.TemporalService).toBeDefined();
            expect(typeof TemporalCore.TemporalService).toBe('function');
        });

        it('should export TemporalClientService', () => {
            expect(TemporalCore.TemporalClientService).toBeDefined();
            expect(typeof TemporalCore.TemporalClientService).toBe('function');
        });

        it('should export TemporalWorkerManagerService', () => {
            expect(TemporalCore.TemporalWorkerManagerService).toBeDefined();
            expect(typeof TemporalCore.TemporalWorkerManagerService).toBe('function');
        });

        it('should export TemporalActivityService', () => {
            expect(TemporalCore.TemporalActivityService).toBeDefined();
            expect(typeof TemporalCore.TemporalActivityService).toBe('function');
        });

        it('should export TemporalDiscoveryService', () => {
            expect(TemporalCore.TemporalDiscoveryService).toBeDefined();
            expect(typeof TemporalCore.TemporalDiscoveryService).toBe('function');
        });

        it('should export TemporalMetadataAccessor', () => {
            expect(TemporalCore.TemporalMetadataAccessor).toBeDefined();
            expect(typeof TemporalCore.TemporalMetadataAccessor).toBe('function');
        });
    });

    describe('Constants Exports', () => {
        it('should export default values', () => {
            expect(TemporalCore.DEFAULT_NAMESPACE).toBe('default');
            expect(TemporalCore.DEFAULT_TASK_QUEUE).toBe('default-task-queue');
            expect(TemporalCore.DEFAULT_CONNECTION_TIMEOUT_MS).toBe(5000);
        });

        it('should export metadata keys', () => {
            expect(TemporalCore.TEMPORAL_ACTIVITY).toBe('TEMPORAL_ACTIVITY');
            expect(TemporalCore.TEMPORAL_ACTIVITY_METHOD).toBe('TEMPORAL_ACTIVITY_METHOD');
            expect(TemporalCore.TEMPORAL_SIGNAL_METHOD).toBe('TEMPORAL_SIGNAL_METHOD');
            expect(TemporalCore.TEMPORAL_QUERY_METHOD).toBe('TEMPORAL_QUERY_METHOD');
            expect(TemporalCore.WORKFLOW_PARAMS_METADATA).toBe('workflow:params');
        });

        it('should export injection tokens', () => {
            expect(TemporalCore.TEMPORAL_CLIENT).toBe('TEMPORAL_CLIENT');
            expect(TemporalCore.TEMPORAL_MODULE_OPTIONS).toBe('TEMPORAL_MODULE_OPTIONS');
            expect(TemporalCore.TEMPORAL_CONNECTION).toBe('TEMPORAL_CONNECTION');
        });

        it('should export predefined expressions', () => {
            expect(TemporalCore.TIMEOUTS).toBeDefined();
            expect(TemporalCore.RETRY_POLICIES).toBeDefined();
        });
    });

    describe('Utility Exports', () => {
        it('should export metadata utilities', () => {
            expect(TemporalCore.isActivity).toBeDefined();
            expect(typeof TemporalCore.isActivity).toBe('function');
            expect(TemporalCore.getActivityMetadata).toBeDefined();
            expect(typeof TemporalCore.getActivityMetadata).toBe('function');
            expect(TemporalCore.isActivityMethod).toBeDefined();
            expect(typeof TemporalCore.isActivityMethod).toBe('function');
            expect(TemporalCore.getActivityMethodMetadata).toBeDefined();
            expect(typeof TemporalCore.getActivityMethodMetadata).toBe('function');
        });

        it('should export logger utilities', () => {
            expect(TemporalCore.TemporalLoggerManager).toBeDefined();
            expect(TemporalCore.TemporalLogger).toBeDefined();
            expect(TemporalCore.createLogger).toBeDefined();
            expect(typeof TemporalCore.createLogger).toBe('function');
            expect(TemporalCore.LoggerUtils).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        it('should allow importing all major components', () => {
            // Test that we can import and use the main components
            expect(() => {
                const { TemporalModule, TemporalService } = TemporalCore;
                expect(TemporalModule).toBeDefined();
                expect(TemporalService).toBeDefined();
            }).not.toThrow();
        });

        it('should provide working metadata functions', () => {
            const TestClass = class {};
            expect(TemporalCore.isActivity(TestClass)).toBe(false);
            expect(TemporalCore.getActivityMetadata(TestClass)).toBeUndefined();
        });

        it('should provide working logger functions', () => {
            const logger = TemporalCore.createLogger('test');
            expect(logger).toBeDefined();
            expect(typeof logger.log).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        it('should provide working constants', () => {
            expect(TemporalCore.TIMEOUTS.ACTIVITY_SHORT).toBe('1m');
            expect(TemporalCore.RETRY_POLICIES.STANDARD.maximumAttempts).toBe(5);
        });
    });

    describe('Type Safety', () => {
        it('should maintain type safety for all exports', () => {
            // This test ensures that TypeScript types are properly exported
            // The fact that this compiles means the types are correct
            const services = {
                temporal: TemporalCore.TemporalService,
                client: TemporalCore.TemporalClientService,
                worker: TemporalCore.TemporalWorkerManagerService,
                activity: TemporalCore.TemporalActivityService,
                discovery: TemporalCore.TemporalDiscoveryService,
                metadata: TemporalCore.TemporalMetadataAccessor,
            };

            expect(Object.keys(services)).toHaveLength(6);
            Object.values(services).forEach((service) => {
                expect(service).toBeDefined();
                expect(typeof service).toBe('function');
            });
        });

        it('should provide consistent constant types', () => {
            expect(typeof TemporalCore.DEFAULT_NAMESPACE).toBe('string');
            expect(typeof TemporalCore.DEFAULT_TASK_QUEUE).toBe('string');
            expect(typeof TemporalCore.DEFAULT_CONNECTION_TIMEOUT_MS).toBe('number');
            expect(typeof TemporalCore.TEMPORAL_ACTIVITY).toBe('string');
            expect(typeof TemporalCore.TEMPORAL_ACTIVITY_METHOD).toBe('string');
        });
    });

    describe('Module Structure', () => {
        it('should export a complete Temporal framework', () => {
            // Check that all major components are available
            const requiredExports = [
                'TemporalModule',
                'TemporalService',
                'TemporalClientService',
                'TemporalWorkerManagerService',
                'TemporalActivityService',
                'TemporalDiscoveryService',
                'TemporalMetadataAccessor',
                'DEFAULT_NAMESPACE',
                'DEFAULT_TASK_QUEUE',
                'DEFAULT_CONNECTION_TIMEOUT_MS',
                'TEMPORAL_ACTIVITY',
                'TEMPORAL_ACTIVITY_METHOD',
                'TEMPORAL_SIGNAL_METHOD',
                'TEMPORAL_QUERY_METHOD',
                'WORKFLOW_PARAMS_METADATA',
                'TEMPORAL_CLIENT',
                'TEMPORAL_MODULE_OPTIONS',
                'TEMPORAL_CONNECTION',
                'TIMEOUTS',
                'RETRY_POLICIES',
            ];

            requiredExports.forEach((exportName) => {
                expect(TemporalCore).toHaveProperty(exportName);
                expect(TemporalCore[exportName as keyof typeof TemporalCore]).toBeDefined();
            });
        });

        it('should provide utility functions for common tasks', () => {
            // Check that utility functions are available
            const utilityFunctions = [
                'isActivity',
                'getActivityMetadata',
                'isActivityMethod',
                'getActivityMethodMetadata',
                'createLogger',
            ];

            utilityFunctions.forEach((functionName) => {
                expect(TemporalCore).toHaveProperty(functionName);
                expect(typeof TemporalCore[functionName as keyof typeof TemporalCore]).toBe(
                    'function',
                );
            });
        });
    });
});
