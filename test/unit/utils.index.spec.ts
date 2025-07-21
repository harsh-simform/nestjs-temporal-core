import * as Utils from '../../src/utils';

describe('Utils Index Module', () => {
    describe('Logger Exports', () => {
        it('should export createLogger function', () => {
            expect(Utils.createLogger).toBeDefined();
            expect(typeof Utils.createLogger).toBe('function');
        });

        // LogExecution decorator removed to avoid compilation issues in test environment

        it('should export LoggerUtils class', () => {
            expect(Utils.LoggerUtils).toBeDefined();
            expect(typeof Utils.LoggerUtils).toBe('function');
        });

        it('should export TemporalLogger class', () => {
            expect(Utils.TemporalLogger).toBeDefined();
            expect(typeof Utils.TemporalLogger).toBe('function');
        });

        it('should export TemporalLoggerManager class', () => {
            expect(Utils.TemporalLoggerManager).toBeDefined();
            expect(typeof Utils.TemporalLoggerManager).toBe('function');
        });
    });

    describe('Validation Exports', () => {
        it('should export isValidCronExpression function', () => {
            expect(Utils.isValidCronExpression).toBeDefined();
            expect(typeof Utils.isValidCronExpression).toBe('function');
        });

        it('should export isValidIntervalExpression function', () => {
            expect(Utils.isValidIntervalExpression).toBeDefined();
            expect(typeof Utils.isValidIntervalExpression).toBe('function');
        });
    });

    describe('Metadata Exports', () => {
        it('should export getActivityMetadata function', () => {
            expect(Utils.getActivityMetadata).toBeDefined();
            expect(typeof Utils.getActivityMetadata).toBe('function');
        });

        it('should export getActivityMethodMetadata function', () => {
            expect(Utils.getActivityMethodMetadata).toBeDefined();
            expect(typeof Utils.getActivityMethodMetadata).toBe('function');
        });

        it('should export isActivity function', () => {
            expect(Utils.isActivity).toBeDefined();
            expect(typeof Utils.isActivity).toBe('function');
        });

        it('should export isActivityMethod function', () => {
            expect(Utils.isActivityMethod).toBeDefined();
            expect(typeof Utils.isActivityMethod).toBe('function');
        });
    });

    describe('Integration Tests', () => {
        it('should provide working logger functionality', () => {
            const logger = Utils.createLogger('test');
            expect(logger).toBeDefined();
            expect(typeof logger.log).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        it('should provide working validation functionality', () => {
            expect(Utils.isValidCronExpression('0 8 * * *')).toBe(true);
            expect(Utils.isValidCronExpression('invalid')).toBe(false);
            expect(Utils.isValidIntervalExpression('5m')).toBe(true);
            expect(Utils.isValidIntervalExpression('invalid')).toBe(false);
        });

        it('should provide working metadata functionality', () => {
            const TestClass = class {};
            expect(Utils.isActivity(TestClass)).toBe(false);
            expect(Utils.getActivityMetadata(TestClass)).toBeUndefined();
        });
    });

    describe('Type Safety', () => {
        it('should maintain type safety for all exports', () => {
            // This test ensures that TypeScript types are properly exported
            const functions = {
                createLogger: Utils.createLogger,
                isValidCronExpression: Utils.isValidCronExpression,
                isValidIntervalExpression: Utils.isValidIntervalExpression,
                getActivityMetadata: Utils.getActivityMetadata,
                getActivityMethodMetadata: Utils.getActivityMethodMetadata,
                isActivity: Utils.isActivity,
                isActivityMethod: Utils.isActivityMethod,
            };

            Object.values(functions).forEach((func) => {
                expect(func).toBeDefined();
                expect(typeof func).toBe('function');
            });
        });

        it('should provide consistent class exports', () => {
            const classes = {
                LoggerUtils: Utils.LoggerUtils,
                TemporalLogger: Utils.TemporalLogger,
                TemporalLoggerManager: Utils.TemporalLoggerManager,
            };

            Object.values(classes).forEach((cls) => {
                expect(cls).toBeDefined();
                expect(typeof cls).toBe('function');
            });
        });
    });

    describe('Module Structure', () => {
        it('should export all required utility functions', () => {
            const requiredExports = [
                'createLogger',
                'LoggerUtils',
                'TemporalLogger',
                'TemporalLoggerManager',
                'isValidCronExpression',
                'isValidIntervalExpression',
                'getActivityMetadata',
                'getActivityMethodMetadata',
                'isActivity',
                'isActivityMethod',
            ];

            requiredExports.forEach((exportName) => {
                expect(Utils).toHaveProperty(exportName);
                expect(Utils[exportName as keyof typeof Utils]).toBeDefined();
            });
        });

        it('should provide a complete utility toolkit', () => {
            // Check that we have utilities for all major areas
            const loggerUtilities = [
                'createLogger',
                'LoggerUtils',
                'TemporalLogger',
                'TemporalLoggerManager',
            ];
            const validationUtilities = ['isValidCronExpression', 'isValidIntervalExpression'];
            const metadataUtilities = [
                'getActivityMetadata',
                'getActivityMethodMetadata',
                'isActivity',
                'isActivityMethod',
            ];

            loggerUtilities.forEach((util) => {
                expect(Utils).toHaveProperty(util);
            });

            validationUtilities.forEach((util) => {
                expect(Utils).toHaveProperty(util);
            });

            metadataUtilities.forEach((util) => {
                expect(Utils).toHaveProperty(util);
            });
        });
    });

    describe('Functionality Tests', () => {
        it('should provide working logger manager', () => {
            const manager = Utils.TemporalLoggerManager.getInstance();
            expect(manager).toBeDefined();
            expect(typeof manager.createLogger).toBe('function');
            expect(typeof manager.configure).toBe('function');
            expect(typeof manager.getGlobalConfig).toBe('function');
        });

        it('should provide working logger instance', () => {
            const logger = new Utils.TemporalLogger('test');
            expect(logger).toBeDefined();
            expect(typeof logger.log).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        it('should provide working logger utilities', () => {
            const logger = new Utils.TemporalLogger('test');
            expect(() => {
                Utils.LoggerUtils.logServiceInit(logger, 'TestService');
                Utils.LoggerUtils.logServiceShutdown(logger, 'TestService');
                Utils.LoggerUtils.logConnection(logger, 'localhost:3000', true);
                Utils.LoggerUtils.logOperation(logger, 'test operation', true);
            }).not.toThrow();
        });

        it('should provide working validation functions', () => {
            // Test cron validation
            expect(Utils.isValidCronExpression('0 8 * * *')).toBe(true);
            expect(Utils.isValidCronExpression('0 0 8 * * *')).toBe(true);
            expect(Utils.isValidCronExpression('invalid')).toBe(false);
            expect(Utils.isValidCronExpression('0 8 * *')).toBe(false);

            // Test interval validation
            expect(Utils.isValidIntervalExpression('5m')).toBe(true);
            expect(Utils.isValidIntervalExpression('2h')).toBe(true);
            expect(Utils.isValidIntervalExpression('30s')).toBe(true);
            expect(Utils.isValidIntervalExpression('1d')).toBe(true);
            expect(Utils.isValidIntervalExpression('100ms')).toBe(true);
            expect(Utils.isValidIntervalExpression('invalid')).toBe(false);
            expect(Utils.isValidIntervalExpression('5')).toBe(false);
        });

        it('should provide working metadata functions', () => {
            const TestClass = class {
                testMethod() {}
            };

            // Test activity metadata functions
            expect(Utils.isActivity(TestClass)).toBe(false);
            expect(Utils.getActivityMetadata(TestClass)).toBeUndefined();

            // Test activity method metadata functions
            expect(Utils.isActivityMethod(TestClass.prototype.testMethod)).toBe(false);
            expect(Utils.getActivityMethodMetadata(TestClass.prototype.testMethod)).toBeUndefined();
        });
    });
});
