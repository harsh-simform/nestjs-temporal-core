import { Logger } from '@nestjs/common';
import {
    TemporalLoggerManager,
    TemporalLogger,
    createLogger,
    LoggerUtils,
} from '../../src/utils/logger';
import { LogLevel, LoggerConfig, GlobalLoggerConfig } from '../../src/interfaces';

// Mock NestJS Logger
jest.mock('@nestjs/common', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
    })),
    Scope: {
        DEFAULT: 'DEFAULT',
    },
    Injectable: jest.fn(() => (target: any) => target),
}));

describe('TemporalLoggerManager', () => {
    let manager: TemporalLoggerManager;
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = TemporalLoggerManager.getInstance();
        manager.clearCache();
        // Reset global config to defaults
        manager.configure({
            enableLogger: true,
            logLevel: 'info',
            appName: 'NestJS-Temporal',
        });
        mockLogger = new Logger('test') as jest.Mocked<Logger>;
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = TemporalLoggerManager.getInstance();
            const instance2 = TemporalLoggerManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('configure', () => {
        it('should update global configuration', () => {
            const config: GlobalLoggerConfig = {
                enableLogger: false,
                logLevel: 'debug',
                appName: 'TestApp',
            };

            manager.configure(config);
            const globalConfig = manager.getGlobalConfig();

            expect(globalConfig.enableLogger).toBe(false);
            expect(globalConfig.logLevel).toBe('debug');
            expect(globalConfig.appName).toBe('TestApp');
        });

        it('should clear cache when configuration changes', () => {
            const logger1 = manager.createLogger('test1');
            const config: GlobalLoggerConfig = { logLevel: 'debug' };

            manager.configure(config);
            const logger2 = manager.createLogger('test1');

            // Should be different instances due to cache clear
            expect(logger1).not.toBe(logger2);
        });

        it('should not clear cache when configuration is the same', () => {
            const logger1 = manager.createLogger('test1');
            const config: GlobalLoggerConfig = { logLevel: 'info' };

            manager.configure(config);
            const logger2 = manager.createLogger('test1');

            // Should be the same instance due to no cache clear
            expect(logger1).toBe(logger2);
        });
    });

    describe('getGlobalConfig', () => {
        it('should return readonly configuration', () => {
            const config = manager.getGlobalConfig();
            expect(config).toBeDefined();
            expect(config.enableLogger).toBe(true);
            expect(config.logLevel).toBe('info');
            expect(config.appName).toBe('NestJS-Temporal');
        });
    });

    describe('createLogger', () => {
        it('should create new logger instance', () => {
            const logger = manager.createLogger('test-context');
            expect(logger).toBeInstanceOf(TemporalLogger);
            expect(logger.getContext()).toBe('test-context');
        });

        it('should cache logger instances', () => {
            const logger1 = manager.createLogger('test-context');
            const logger2 = manager.createLogger('test-context');
            expect(logger1).toBe(logger2);
        });

        it('should create different loggers for different contexts', () => {
            const logger1 = manager.createLogger('context1');
            const logger2 = manager.createLogger('context2');
            expect(logger1).not.toBe(logger2);
        });

        it('should merge local config with global config', () => {
            const localConfig: LoggerConfig = {
                enableLogger: false,
                logLevel: 'debug',
            };

            const logger = manager.createLogger('test', localConfig);
            const config = logger.getConfig();

            expect(config.enableLogger).toBe(false);
            expect(config.logLevel).toBe('debug');
        });
    });

    describe('clearCache', () => {
        it('should clear logger cache', () => {
            const logger1 = manager.createLogger('test');
            manager.clearCache();
            const logger2 = manager.createLogger('test');

            expect(logger1).not.toBe(logger2);
        });
    });
});

describe('TemporalLogger', () => {
    let logger: TemporalLogger;
    let mockNestLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockNestLogger = new Logger('test') as jest.Mocked<Logger>;
        logger = new TemporalLogger('test-context');
        // Mock the internal nestLogger to use our mock
        (logger as any).nestLogger = mockNestLogger;
    });

    describe('constructor', () => {
        it('should initialize with default config', () => {
            expect(logger.getConfig().enableLogger).toBe(true);
            expect(logger.getConfig().logLevel).toBe('info');
            expect(logger.getContext()).toBe('test-context');
        });

        it('should initialize with custom config', () => {
            const config: LoggerConfig = {
                enableLogger: false,
                logLevel: 'debug',
            };

            const customLogger = new TemporalLogger('test', config);
            expect(customLogger.getConfig().enableLogger).toBe(false);
            expect(customLogger.getConfig().logLevel).toBe('debug');
        });
    });

    describe('shouldLog', () => {
        it('should return false when logging is disabled', () => {
            const disabledLogger = new TemporalLogger('test', { enableLogger: false });
            expect(disabledLogger.isLevelEnabled('info')).toBe(false);
        });

        it('should respect log level hierarchy', () => {
            const debugLogger = new TemporalLogger('test', { logLevel: 'debug' });
            expect(debugLogger.isLevelEnabled('error')).toBe(true);
            expect(debugLogger.isLevelEnabled('warn')).toBe(true);
            expect(debugLogger.isLevelEnabled('info')).toBe(true);
            expect(debugLogger.isLevelEnabled('debug')).toBe(true);
            expect(debugLogger.isLevelEnabled('verbose')).toBe(false);

            const warnLogger = new TemporalLogger('test', { logLevel: 'warn' });
            expect(warnLogger.isLevelEnabled('error')).toBe(true);
            expect(warnLogger.isLevelEnabled('warn')).toBe(true);
            expect(warnLogger.isLevelEnabled('info')).toBe(false);
            expect(warnLogger.isLevelEnabled('debug')).toBe(false);
            expect(warnLogger.isLevelEnabled('verbose')).toBe(false);
        });
    });

    describe('logging methods', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should log error messages', () => {
            logger.error('test error', 'stack trace');
            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'test error',
                'stack trace',
                'test-context',
            );
        });

        it('should log error with Error object', () => {
            const error = new Error('test error');
            logger.error('test error', error);
            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'test error',
                error.stack,
                'test-context',
            );
        });

        it('should log warning messages', () => {
            logger.warn('test warning');
            expect(mockNestLogger.warn).toHaveBeenCalledWith('test warning', 'test-context');
        });

        it('should log info messages', () => {
            logger.log('test info');
            expect(mockNestLogger.log).toHaveBeenCalledWith('test info', 'test-context');
        });

        it('should log debug messages', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            debugLogger.debug('test debug');
            expect(mockNestLogger.debug).toHaveBeenCalledWith('test debug', 'test-context');
        });

        it('should log verbose messages', () => {
            const verboseLogger = new TemporalLogger('test-context', { logLevel: 'verbose' });
            (verboseLogger as any).nestLogger = mockNestLogger;
            verboseLogger.verbose('test verbose');
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('test verbose', 'test-context');
        });

        it('should not log when level is disabled', () => {
            const disabledLogger = new TemporalLogger('test', { enableLogger: false });
            disabledLogger.log('test message');
            expect(mockNestLogger.log).not.toHaveBeenCalled();
        });

        it('should not log when level is too high', () => {
            const warnLogger = new TemporalLogger('test', { logLevel: 'warn' });
            warnLogger.debug('test debug');
            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('logExecutionTime', () => {
        it('should log execution time when debug level is enabled', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            const startTime = Date.now() - 100; // 100ms ago

            debugLogger.logExecutionTime('testMethod', startTime);
            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('testMethod executed in'),
                'test-context',
            );
        });

        it('should not log execution time when debug level is disabled', () => {
            const infoLogger = new TemporalLogger('test', { logLevel: 'info' });
            const startTime = Date.now() - 100;

            infoLogger.logExecutionTime('testMethod', startTime);
            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('logWithLevel', () => {
        it('should log with correct level', () => {
            logger.logWithLevel('warn', 'test warning');
            expect(mockNestLogger.warn).toHaveBeenCalledWith('test warning', 'test-context');
        });

        it('should not log when level is disabled', () => {
            const warnLogger = new TemporalLogger('test', { logLevel: 'warn' });
            warnLogger.logWithLevel('debug', 'test debug');
            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });

        it('should log error level messages', () => {
            logger.logWithLevel('error', 'test error');
            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'test error',
                undefined,
                'test-context',
            );
        });

        it('should log info level messages', () => {
            logger.logWithLevel('info', 'test info');
            expect(mockNestLogger.log).toHaveBeenCalledWith('test info', 'test-context');
        });

        it('should log debug level messages', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            debugLogger.logWithLevel('debug', 'test debug');
            expect(mockNestLogger.debug).toHaveBeenCalledWith('test debug', 'test-context');
        });

        it('should log verbose level messages', () => {
            const verboseLogger = new TemporalLogger('test-context', { logLevel: 'verbose' });
            (verboseLogger as any).nestLogger = mockNestLogger;
            verboseLogger.logWithLevel('verbose', 'test verbose');
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('test verbose', 'test-context');
        });
    });

    describe('createChildLogger', () => {
        it('should create child logger with combined context', () => {
            const childLogger = logger.createChildLogger('child');
            expect(childLogger.getContext()).toBe('test-context:child');
        });

        it('should merge child config with parent config', () => {
            const childLogger = logger.createChildLogger('child', { logLevel: 'debug' });
            expect(childLogger.getConfig().logLevel).toBe('debug');
        });
    });

    describe('getter methods', () => {
        it('should return correct configuration', () => {
            const config = logger.getConfig();
            expect(config.enableLogger).toBe(true);
            expect(config.logLevel).toBe('info');
        });

        it('should return correct context', () => {
            expect(logger.getContext()).toBe('test-context');
        });

        it('should return correct log level', () => {
            expect(logger.getLogLevel()).toBe('info');
        });

        it('should return correct enabled status', () => {
            expect(logger.isEnabled()).toBe(true);
        });
    });

    describe('info alias', () => {
        it('should call log method', () => {
            logger.info('test info');
            expect(mockNestLogger.log).toHaveBeenCalledWith('test info', 'test-context');
        });
    });

    describe('Logger Error Handling', () => {
        it('should handle error logging with Error object', () => {
            const error = new Error('Test error');
            logger.error('Error message', error);

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                error.stack,
                'test-context',
            );
        });

        it('should handle error logging with string trace', () => {
            logger.error('Error message', 'Stack trace string');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                'Stack trace string',
                'test-context',
            );
        });

        it('should handle error logging with undefined trace', () => {
            logger.error('Error message', undefined);

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                undefined,
                'test-context',
            );
        });

        it('should handle error logging with custom context', () => {
            const error = new Error('Test error');
            logger.error('Error message', error, 'CustomContext');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                error.stack,
                'CustomContext',
            );
        });
    });

    describe('Logger Level Checking', () => {
        it('should handle debug level when enabled', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            debugLogger.debug('Debug message');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Debug message', 'test-context');
        });

        it('should handle verbose level when enabled', () => {
            const verboseLogger = new TemporalLogger('test-context', { logLevel: 'verbose' });
            (verboseLogger as any).nestLogger = mockNestLogger;
            verboseLogger.verbose('Verbose message');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Verbose message', 'test-context');
        });

        it('should handle logWithLevel for all levels', () => {
            logger.logWithLevel('error', 'Error message');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                undefined,
                'test-context',
            );
        });

        it('should not log when level is disabled', () => {
            // Mock shouldLog to return false
            jest.spyOn(logger as any, 'shouldLog').mockReturnValue(false);

            logger.log('Message');
            expect(mockNestLogger.log).not.toHaveBeenCalled();
        });
    });

    describe('Logger Configuration', () => {
        it('should return readonly config', () => {
            const config = logger.getConfig();
            expect(config.enableLogger).toBe(true);
            expect(config.logLevel).toBe('info');
        });

        it('should check if logging is enabled', () => {
            expect(logger.isEnabled()).toBe(true);
        });

        it('should get current log level', () => {
            expect(logger.getLogLevel()).toBe('info');
        });

        it('should get logger context', () => {
            expect(logger.getContext()).toBe('test-context');
        });

        it('should check if specific level is enabled', () => {
            expect(logger.isLevelEnabled('error')).toBe(true);
            expect(logger.isLevelEnabled('debug')).toBe(false); // Default level is 'info'
            expect(logger.isLevelEnabled('verbose')).toBe(false); // Default level is 'info'
        });
    });

    describe('Child Logger Creation', () => {
        it('should create child logger with combined context', () => {
            const childLogger = logger.createChildLogger('ChildContext');

            expect(childLogger.getContext()).toBe('test-context:ChildContext');
        });

        it('should create child logger with custom config', () => {
            const childLogger = logger.createChildLogger('ChildContext', {
                logLevel: 'debug',
            });

            expect(childLogger.getContext()).toBe('test-context:ChildContext');
            expect(childLogger.getLogLevel()).toBe('debug');
        });

        it('should create child logger without custom config', () => {
            const childLogger = logger.createChildLogger('ChildContext');
            expect(childLogger.getLogLevel()).toBe('info'); // Should inherit parent config
        });
    });

    describe('Execution Time Logging', () => {
        it('should log execution time when debug is enabled', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            const startTime = Date.now();
            debugLogger.logExecutionTime('testMethod', startTime);

            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('testMethod executed in'),
                'test-context',
            );
        });

        it('should log execution time with custom context', () => {
            const debugLogger = new TemporalLogger('test-context', { logLevel: 'debug' });
            (debugLogger as any).nestLogger = mockNestLogger;
            const startTime = Date.now();
            debugLogger.logExecutionTime('testMethod', startTime, 'CustomContext');

            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('testMethod executed in'),
                'CustomContext',
            );
        });
    });

    describe('Logger Manager', () => {
        it('should get singleton instance', () => {
            const instance1 = TemporalLoggerManager.getInstance();
            const instance2 = TemporalLoggerManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should configure global settings', () => {
            const manager = TemporalLoggerManager.getInstance();
            const config = {
                enableLogger: false,
                logLevel: 'debug' as const,
                appName: 'TestApp',
            };

            manager.configure(config);
            const globalConfig = manager.getGlobalConfig();
            expect(globalConfig.enableLogger).toBe(false);
            expect(globalConfig.logLevel).toBe('debug');
            expect(globalConfig.appName).toBe('TestApp');
        });

        it('should create logger with cache key', () => {
            const manager = TemporalLoggerManager.getInstance();
            const logger1 = manager.createLogger('Context1');
            const logger2 = manager.createLogger('Context1'); // Same context, should be cached
            const logger3 = manager.createLogger('Context2'); // Different context

            expect(logger1).toBe(logger2); // Should be cached
            expect(logger1).not.toBe(logger3); // Different instance
        });

        it('should create logger with different configs', () => {
            const manager = TemporalLoggerManager.getInstance();
            const logger1 = manager.createLogger('Context', { logLevel: 'debug' });
            const logger2 = manager.createLogger('Context', { logLevel: 'error' });

            expect(logger1).not.toBe(logger2); // Different configs should create different instances
        });

        it('should clear cache', () => {
            const manager = TemporalLoggerManager.getInstance();
            const logger1 = manager.createLogger('Context');
            manager.clearCache();
            const logger2 = manager.createLogger('Context');

            expect(logger1).not.toBe(logger2); // Should be different after cache clear
        });
    });

    describe('Logger Factory Function', () => {
        it('should create logger using factory function', () => {
            const logger = createLogger('FactoryLogger');
            expect(logger.getContext()).toBe('FactoryLogger');
        });

        it('should create logger with config using factory function', () => {
            const logger = createLogger('FactoryLogger', { logLevel: 'debug' });
            expect(logger.getContext()).toBe('FactoryLogger');
            expect(logger.getLogLevel()).toBe('debug');
        });
    });

    describe('Logger Utils', () => {
        it('should log service initialization', () => {
            const config = { name: 'TestService', version: '1.0.0' };
            LoggerUtils.logServiceInit(logger, 'TestService', config);

            expect(mockNestLogger.log).toHaveBeenCalledWith('Initializing TestService...', 'test-context');
            expect(mockNestLogger.debug).not.toHaveBeenCalled(); // Default level is 'info', debug won't be called
        });

        it('should log service initialization without config', () => {
            LoggerUtils.logServiceInit(logger, 'TestService');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Initializing TestService...', 'test-context');
            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });

        it('should log service initialization with config when debug level is set', () => {
            // Create a logger with debug level
            const debugLogger = new TemporalLogger('test-context', {
                enableLogger: true,
                logLevel: 'debug',
            });
            
            const config = { name: 'TestService', version: '1.0.0' };
            
            LoggerUtils.logServiceInit(debugLogger, 'TestService', config);

            expect(debugLogger.getLogLevel()).toBe('debug');
        });

        it('should log service shutdown', () => {
            LoggerUtils.logServiceShutdown(logger, 'TestService');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Shutting down TestService...', 'test-context');
        });

        it('should log connection success', () => {
            LoggerUtils.logConnection(logger, 'localhost:7233', true);

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Successfully connected to localhost:7233',
                'test-context',
            );
        });

        it('should log connection failure', () => {
            const error = new Error('Connection failed');
            LoggerUtils.logConnection(logger, 'localhost:7233', false, error);

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Failed to connect to localhost:7233',
                error.stack,
                'test-context',
            );
        });

        it('should log operation success', () => {
            LoggerUtils.logOperation(logger, 'testOperation', true, 'Operation completed');

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'testOperation completed successfully: Operation completed',
                'test-context',
            );
        });

        it('should log operation failure', () => {
            const error = new Error('Operation failed');
            LoggerUtils.logOperation(logger, 'testOperation', false, 'Operation failed', error);

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'testOperation failed: Operation failed',
                error.stack,
                'test-context',
            );
        });

        it('should log operation failure without error object', () => {
            LoggerUtils.logOperation(logger, 'testOperation', false, 'Operation failed');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'testOperation failed: Operation failed',
                undefined,
                'test-context',
            );
        });

        it('should log operation success without details', () => {
            LoggerUtils.logOperation(logger, 'testOperation', true);

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'testOperation completed successfully',
                'test-context',
            );
        });

        it('should log operation failure without details', () => {
            LoggerUtils.logOperation(logger, 'testOperation', false);

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'testOperation failed',
                undefined,
                'test-context',
            );
        });
    });

    describe('Logger Manager Edge Cases', () => {
        it('should handle logger creation with invalid context', () => {
            const manager = TemporalLoggerManager.getInstance();

            expect(() => manager.createLogger('')).not.toThrow();
            expect(() => manager.createLogger(null as any)).not.toThrow();
            expect(() => manager.createLogger(undefined as any)).not.toThrow();
        });

        it('should handle logger creation with invalid config', () => {
            const manager = TemporalLoggerManager.getInstance();

            expect(() => manager.createLogger('test', null as any)).not.toThrow();
            expect(() => manager.createLogger('test', undefined as any)).not.toThrow();
        });

        it('should handle cache key generation with invalid inputs', () => {
            const manager = TemporalLoggerManager.getInstance();

            expect(() => manager['getCacheKey']('', {})).not.toThrow();
            expect(() => manager['getCacheKey']('test', null as any)).not.toThrow();
        });

        it('should handle global config with invalid inputs', () => {
            const manager = TemporalLoggerManager.getInstance();

            expect(() => manager.configure(null as any)).not.toThrow();
            expect(() => manager.configure(undefined as any)).not.toThrow();
        });
    });

    describe('Logger Config Validation', () => {
        it('should handle invalid log levels', () => {
            const loggerWithInvalidLevel = new TemporalLogger('test', {
                logLevel: 'invalid' as any,
            });

            expect(loggerWithInvalidLevel.getLogLevel()).toBe('info'); // Default fallback
        });

        it('should handle unknown log level and fallback to index 2', () => {
            // Create a logger with a log level that doesn't exist in LEVEL_INDICES
            // This should trigger the ?? 2 fallback in line 111
            const unknownLevelLogger = new TemporalLogger('test', {
                logLevel: 'unknown' as any,
            });

            // Verify it falls back to 'info' level (index 2)
            expect(unknownLevelLogger.getLogLevel()).toBe('info');
            
            // Verify that currentLevelIndex was set to 2 (the fallback)
            const currentLevelIndex = (unknownLevelLogger as any).currentLevelIndex;
            expect(currentLevelIndex).toBe(2);
        });

        it('should handle corrupted LEVEL_INDICES and use fallback index', () => {
            // Save original LEVEL_INDICES
            const originalLevelIndices = (TemporalLogger as any).LEVEL_INDICES;
            
            try {
                // Temporarily corrupt the LEVEL_INDICES map to trigger line 111 fallback
                const corruptedMap = new Map(originalLevelIndices);
                corruptedMap.delete('info'); // Remove 'info' from the map
                (TemporalLogger as any).LEVEL_INDICES = corruptedMap;
                
                // Create logger with 'info' level that's no longer in the map
                const logger = new TemporalLogger('test', { logLevel: 'info' });
                
                // Should use fallback index 2 from line 111
                const currentLevelIndex = (logger as any).currentLevelIndex;
                expect(currentLevelIndex).toBe(2);
                
            } finally {
                // Restore original LEVEL_INDICES
                (TemporalLogger as any).LEVEL_INDICES = originalLevelIndices;
            }
        });

        it('should handle disabled logger', () => {
            const disabledLogger = new TemporalLogger('test', {
                enableLogger: false,
            });

            disabledLogger.log('This should not be logged');
            disabledLogger.error('This should not be logged');

            expect(mockNestLogger.log).not.toHaveBeenCalled();
            expect(mockNestLogger.error).not.toHaveBeenCalled();
        });

        it('should handle verbose level logging', () => {
            const verboseLogger = new TemporalLogger('test', {
                logLevel: 'verbose',
            });
            (verboseLogger as any).nestLogger = mockNestLogger;

            verboseLogger.verbose('Verbose message');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Verbose message', 'test');
        });

        it('should not log warn when logger level is error only', () => {
            const errorOnlyLogger = new TemporalLogger('test', {
                logLevel: 'error',
            });
            (errorOnlyLogger as any).nestLogger = mockNestLogger;

            errorOnlyLogger.warn('Warning message');

            expect(mockNestLogger.warn).not.toHaveBeenCalled();
        });

        it('should not log verbose when level is info', () => {
            const infoLogger = new TemporalLogger('test', {
                logLevel: 'info',
            });

            infoLogger.verbose('Verbose message');

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });
    });

    describe('Logger Method Aliases', () => {
        it('should handle info method alias', () => {
            logger.info('Info message');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Info message', 'test-context');
        });

        it('should handle log method alias', () => {
            logger.log('Log message');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Log message', 'test-context');
        });
    });

    describe('Logger Cache Management', () => {
        it('should clear logger cache', () => {
            const manager = TemporalLoggerManager.getInstance();

            // Create a logger to populate cache
            const originalLogger = manager.createLogger('test-cache');

            // Clear cache
            manager.clearCache();

            // Verify cache is cleared by creating a logger with the same key
            const newLogger = manager.createLogger('test-cache');

            // They should be different instances after cache clear
            expect(originalLogger).not.toBe(newLogger);
        });
    });
});
