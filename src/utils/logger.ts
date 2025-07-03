import { Logger } from '@nestjs/common';
import { LogLevel, LoggerConfig } from '../interfaces';

/**
 * TemporalLogger utility
 * Provides logging functionality that respects logger configuration
 */
export class TemporalLogger {
    private readonly nestLogger: Logger;
    private readonly config: LoggerConfig;

    constructor(context: string, config: LoggerConfig = {}) {
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
        if (!this.config.enableLogger) {
            return false;
        }

        const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel!);
        const requestedLevelIndex = levels.indexOf(level);

        return requestedLevelIndex <= currentLevelIndex;
    }

    /**
     * Log error message
     */
    error(message: any, trace?: string): void {
        if (this.shouldLog('error')) {
            this.nestLogger.error(message, trace);
        }
    }

    /**
     * Log warning message
     */
    warn(message: any): void {
        if (this.shouldLog('warn')) {
            this.nestLogger.warn(message);
        }
    }

    /**
     * Log info message
     */
    log(message: any): void {
        if (this.shouldLog('info')) {
            this.nestLogger.log(message);
        }
    }

    /**
     * Log debug message
     */
    debug(message: any): void {
        if (this.shouldLog('debug')) {
            this.nestLogger.debug(message);
        }
    }

    /**
     * Log verbose message
     */
    verbose(message: any): void {
        if (this.shouldLog('verbose')) {
            this.nestLogger.verbose(message);
        }
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
}
