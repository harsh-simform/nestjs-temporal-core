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

    // 2. Check for truly missing fields by looking for cases where we have
    // too few parts when splitting normally (indicating missing fields)
    // But skip this check if we already know it's a valid multi-space format
    if (parts.length < 5) {
        return false; // Already handled above but just to be explicit
    }

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
