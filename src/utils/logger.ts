import { Injectable, Logger, Scope } from '@nestjs/common';
import { LogLevel, LoggerConfig } from '../interfaces';

/**
 * Centralized logger configuration
 */
interface GlobalLoggerConfig extends LoggerConfig {
    /** Application name prefix for all logs */
    appName?: string;
    /** Custom log formatter */
    formatter?: (level: string, message: string, context: string, timestamp: string) => string;
    /** Log to file */
    logToFile?: boolean;
    /** File path for logs */
    logFilePath?: string;
}

/**
 * Singleton class to manage global logger configuration
 */
@Injectable({ scope: Scope.DEFAULT })
export class TemporalLoggerManager {
    private static instance: TemporalLoggerManager;
    private globalConfig: GlobalLoggerConfig = {
        enableLogger: true,
        logLevel: 'info',
        appName: 'NestJS-Temporal',
    };

    static getInstance(): TemporalLoggerManager {
        if (!TemporalLoggerManager.instance) {
            TemporalLoggerManager.instance = new TemporalLoggerManager();
        }
        return TemporalLoggerManager.instance;
    }

    /**
     * Configure global logger settings
     */
    configure(config: GlobalLoggerConfig): void {
        this.globalConfig = { ...this.globalConfig, ...config };
    }

    /**
     * Get current global configuration
     */
    getGlobalConfig(): GlobalLoggerConfig {
        return { ...this.globalConfig };
    }

    /**
     * Create a new logger instance with global configuration
     */
    createLogger(context: string, localConfig: LoggerConfig = {}): TemporalLogger {
        const mergedConfig = {
            ...this.globalConfig,
            ...localConfig,
        };
        return new TemporalLogger(context, mergedConfig);
    }
}

/**
 * TemporalLogger utility
 * Provides logging functionality that respects logger configuration
 */
export class TemporalLogger {
    private readonly nestLogger: Logger;
    private readonly config: LoggerConfig;
    private readonly context: string;

    constructor(context: string, config: LoggerConfig = {}) {
        this.context = context;
        this.nestLogger = new Logger(context);
        this.config = {
            enableLogger: config.enableLogger ?? true,
            logLevel: config.logLevel ?? 'info',
        };
    }

    /**
     * Check if logging is enabled and level is appropriate
     */
    private shouldLog(level: LogLevel): boolean {
        // First check if logging is globally disabled
        if (this.config.enableLogger === false) {
            return false;
        }

        const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel!);
        const requestedLevelIndex = levels.indexOf(level);

        return requestedLevelIndex <= currentLevelIndex;
    }

    /**
     * Log error message with optional stack trace
     */
    error(message: unknown, trace?: string | Error, context?: string): void {
        if (this.shouldLog('error')) {
            const errorContext = context || this.context;
            if (trace instanceof Error) {
                this.nestLogger.error(message, trace.stack, errorContext);
            } else {
                this.nestLogger.error(message, trace, errorContext);
            }
        }
    }

    /**
     * Log warning message
     */
    warn(message: unknown, context?: string): void {
        if (this.shouldLog('warn')) {
            this.nestLogger.warn(message, context || this.context);
        }
    }

    /**
     * Log info message
     */
    log(message: unknown, context?: string): void {
        if (this.shouldLog('info')) {
            this.nestLogger.log(message, context || this.context);
        }
    }

    /**
     * Log info message (alias for log)
     */
    info(message: unknown, context?: string): void {
        this.log(message, context);
    }

    /**
     * Log debug message
     */
    debug(message: unknown, context?: string): void {
        if (this.shouldLog('debug')) {
            this.nestLogger.debug(message, context || this.context);
        }
    }

    /**
     * Log verbose message
     */
    verbose(message: unknown, context?: string): void {
        if (this.shouldLog('verbose')) {
            this.nestLogger.verbose(message, context || this.context);
        }
    }

    /**
     * Log method execution time
     */
    logExecutionTime(methodName: string, startTime: number, context?: string): void {
        const executionTime = Date.now() - startTime;
        this.debug(`${methodName} executed in ${executionTime}ms`, context || this.context);
    }

    /**
     * Log with custom level
     */
    logWithLevel(level: LogLevel, message: unknown, context?: string): void {
        switch (level) {
            case 'error':
                this.error(message, undefined, context);
                break;
            case 'warn':
                this.warn(message, context);
                break;
            case 'info':
                this.log(message, context);
                break;
            case 'debug':
                this.debug(message, context);
                break;
            case 'verbose':
                this.verbose(message, context);
                break;
        }
    }

    /**
     * Create a child logger with additional context
     */
    createChildLogger(childContext: string, config?: LoggerConfig): TemporalLogger {
        const combinedContext = `${this.context}:${childContext}`;
        const childConfig = config ? { ...this.config, ...config } : this.config;
        return new TemporalLogger(combinedContext, childConfig);
    }

    /**
     * Get current logger configuration
     */
    getConfig(): LoggerConfig {
        return { ...this.config };
    }

    /**
     * Check if logging is enabled
     */
    isEnabled(): boolean {
        return this.config.enableLogger ?? true;
    }

    /**
     * Get current log level
     */
    getLogLevel(): LogLevel {
        return this.config.logLevel ?? 'info';
    }

    /**
     * Get logger context
     */
    getContext(): string {
        return this.context;
    }

    /**
     * Update logger configuration
     */
    updateConfig(newConfig: Partial<LoggerConfig>): void {
        this.config.enableLogger = newConfig.enableLogger ?? this.config.enableLogger;
        this.config.logLevel = newConfig.logLevel ?? this.config.logLevel;
    }
}

/**
 * Factory function to create a centrally managed logger
 */
export function createLogger(context: string, config?: LoggerConfig): TemporalLogger {
    const manager = TemporalLoggerManager.getInstance();
    return manager.createLogger(context, config);
}

/**
 * Decorator to log method execution
 */
export function LogExecution(_logLevel: LogLevel = 'debug') {
    return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        descriptor.value = function (...args: unknown[]) {
            const logger = createLogger(target!.constructor.name);
            const startTime = Date.now();

            try {
                const result = method.apply(this, args);

                if (result instanceof Promise) {
                    return result
                        .then((res) => {
                            logger.logExecutionTime(propertyName, startTime);
                            return res;
                        })
                        .catch((error) => {
                            logger.error(`Error in ${propertyName}:`, error);
                            throw error;
                        });
                } else {
                    logger.logExecutionTime(propertyName, startTime);
                    return result;
                }
            } catch (error) {
                logger.error(`Error in ${propertyName}:`, error as Error);
                throw error;
            }
        };
        return descriptor;
    };
}

/**
 * Utility functions for commonly used logging patterns
 */
export class LoggerUtils {
    /**
     * Log service initialization
     */
    static logServiceInit(logger: TemporalLogger, serviceName: string, config?: unknown): void {
        logger.log(`Initializing ${serviceName}...`);
        if (config && logger.getLogLevel() === 'debug') {
            logger.debug(`${serviceName} configuration:`, JSON.stringify(config, null, 2));
        }
    }

    /**
     * Log service shutdown
     */
    static logServiceShutdown(logger: TemporalLogger, serviceName: string): void {
        logger.log(`Shutting down ${serviceName}...`);
    }

    /**
     * Log connection establishment
     */
    static logConnection(
        logger: TemporalLogger,
        target: string,
        success: boolean,
        error?: Error,
    ): void {
        if (success) {
            logger.log(`Successfully connected to ${target}`);
        } else {
            logger.error(`Failed to connect to ${target}`, error);
        }
    }

    /**
     * Log operation result
     */
    static logOperation(
        logger: TemporalLogger,
        operation: string,
        success: boolean,
        details?: string,
        error?: Error,
    ): void {
        if (success) {
            logger.log(`${operation} completed successfully${details ? `: ${details}` : ''}`);
        } else {
            logger.error(`${operation} failed${details ? `: ${details}` : ''}`, error);
        }
    }
}
