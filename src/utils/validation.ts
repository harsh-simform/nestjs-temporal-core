import 'reflect-metadata';
import { createLogger } from './logger';

const logger = createLogger('ValidationUtils');

/**
 * Validates that a workflow ID is provided and not empty.
 *
 * @param workflowId - The workflow ID to validate
 * @throws Error if the workflow ID is missing or empty
 */
export function validateWorkflowId(workflowId: string): void {
    if (!workflowId || workflowId.trim().length === 0) {
        logger.debug(`Workflow ID validation failed: "${workflowId}"`);
        throw new Error('Workflow ID is required and cannot be empty');
    }
    logger.debug(`Workflow ID validation passed: "${workflowId}"`);
}

/**
 * Validates that a signal name is provided and not empty.
 *
 * @param signalName - The signal name to validate
 * @throws Error if the signal name is missing or empty
 */
export function validateSignalName(signalName: string): void {
    if (!signalName || signalName.trim().length === 0) {
        logger.debug(`Signal name validation failed: "${signalName}"`);
        throw new Error('Signal name is required and cannot be empty');
    }

    if (signalName.includes(' ') || signalName.includes('\n') || signalName.includes('\t')) {
        logger.debug(`Signal name validation failed: "${signalName}" (contains whitespace)`);
        throw new Error(
            `Invalid signal name: "${signalName}". Signal names cannot contain whitespace.`,
        );
    }

    logger.debug(`Signal name validation passed: "${signalName}"`);
}

/**
 * Validates that a query name is provided and not empty.
 *
 * @param queryName - The query name to validate
 * @throws Error if the query name is missing or empty
 */
export function validateQueryName(queryName: string): void {
    if (!queryName || queryName.trim().length === 0) {
        logger.debug(`Query name validation failed: "${queryName}"`);
        throw new Error('Query name is required and cannot be empty');
    }

    if (queryName.includes(' ') || queryName.includes('\n') || queryName.includes('\t')) {
        logger.debug(`Query name validation failed: "${queryName}" (contains whitespace)`);
        throw new Error(
            `Invalid query name: "${queryName}". Query names cannot contain whitespace.`,
        );
    }

    logger.debug(`Query name validation passed: "${queryName}"`);
}

/**
 * Validates that a workflow type is provided and not empty.
 *
 * @param workflowType - The workflow type to validate
 * @throws Error if the workflow type is missing or empty
 */
export function validateWorkflowType(workflowType: string): void {
    if (!workflowType || workflowType.trim().length === 0) {
        logger.debug(`Workflow type validation failed: "${workflowType}"`);
        throw new Error('Workflow type is required and cannot be empty');
    }
    logger.debug(`Workflow type validation passed: "${workflowType}"`);
}

/**
 * Validates that an activity name is provided and not empty.
 *
 * @param activityName - The activity name to validate
 * @throws Error if the activity name is missing or empty
 */
export function validateActivityName(activityName: string): void {
    if (!activityName || activityName.trim().length === 0) {
        logger.debug(`Activity name validation failed: "${activityName}"`);
        throw new Error('Activity name is required and cannot be empty');
    }
    logger.debug(`Activity name validation passed: "${activityName}"`);
}

/**
 * Common service initialization utility
 */
export class ServiceInitializationUtils {
    /**
     * Safely initialize a service component
     */
    static async safeInitialize<T>(
        serviceName: string,
        logger: {
            debug: (msg: string) => void;
            info: (msg: string) => void;
            warn: (msg: string) => void;
            error: (msg: string) => void;
        },
        initFunction: () => Promise<T> | T,
        allowFailure: boolean = true,
    ): Promise<T | null> {
        try {
            logger.debug(`Initializing ${serviceName}...`);
            const result = await initFunction();
            logger.info(`${serviceName} initialized successfully`);
            return result;
        } catch (error) {
            if (allowFailure) {
                logger.warn(
                    `${serviceName} initialization failed - continuing in degraded mode: ${(error as Error).message}`,
                );
                return null;
            } else {
                logger.error(`${serviceName} initialization failed: ${(error as Error).message}`);
                throw error;
            }
        }
    }
}

/**
 * Validates if a cron expression is properly formatted.
 * @param expression The cron expression to validate
 * @returns True if valid, false otherwise
 */
export function isValidCronExpression(expression: string): boolean {
    if (!expression || typeof expression !== 'string') {
        return false;
    }

    // Basic cron format validation: 5 or 6 parts separated by spaces
    const parts = expression
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length < 5 || parts.length > 6) {
        return false;
    }

    // Check for specific invalid patterns

    // 1. Single leading space before digit (ambiguous) - but allow multiple leading spaces
    if (/^\s\d/.test(expression) && !/^\s\s+/.test(expression)) {
        return false;
    }

    // Note: The check for parts.length < 5 is already handled above on line 140

    // Check for invalid characters (basic validation)
    // Allow digits, *, -, , /, ?, L, W for advanced cron features (but not # as it's too advanced)
    const validCronRegex = /^[\d\*\-,\/\?LW]+$/;

    // Check each part individually for validity
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Reject clearly invalid characters
        if (/[@&#]/.test(part)) {
            return false;
        }

        // Basic numeric validation - reject obviously invalid numbers
        if (part !== '*' && !validCronRegex.test(part)) {
            return false;
        }

        // For 6-field format, check seconds field (0-59)
        if (parts.length === 6 && i === 0) {
            if (part !== '*' && /^\d+$/.test(part) && parseInt(part, 10) > 59) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Validates if an interval expression is properly formatted.
 * @param expression The interval expression to validate (e.g., "5m", "1h", "30s")
 * @returns True if valid, false otherwise
 */
export function isValidIntervalExpression(expression: string): boolean {
    if (!expression || typeof expression !== 'string') {
        return false;
    }

    // Basic interval format validation: number followed by time unit
    // Support ms, s, m, h, d
    const intervalRegex = /^\d+(ms|[smhd])$/;
    return intervalRegex.test(expression.trim());
}
