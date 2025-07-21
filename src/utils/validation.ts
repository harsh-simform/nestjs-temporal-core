/**
 * Validates cron expression format.
 *
 * Supports both 5-field (minute hour day month weekday) and
 * 6-field (second minute hour day month weekday) cron formats.
 *
 * @param cron - The cron expression to validate
 * @returns True if the cron expression has valid basic format
 *
 * @example
 * ```typescript
 * console.log(isValidCronExpression('0 8 * * *')); // true (daily at 8 AM)
 * console.log(isValidCronExpression('0 0 8 * * *')); // true (6-field format)
 * console.log(isValidCronExpression('invalid')); // false
 * ```
 */
export function isValidCronExpression(cron: string): boolean {
    if (!cron || typeof cron !== 'string') {
        return false;
    }

    // Replace tabs/newlines with spaces for uniformity
    const normalized = cron.replace(/[\t\n\r]+/g, ' ');

    // Check for leading-only spaces (creates empty parts)
    if (normalized.startsWith(' ') && !normalized.endsWith(' ')) {
        return false;
    }

    // Trim leading/trailing spaces for processing
    const trimmed = normalized.trim();
    const parts = trimmed.split(/\s+/);

    // Support both 5-field (minute hour day month weekday) and 6-field (second minute hour day month weekday) format
    if (parts.length !== 5 && parts.length !== 6) {
        return false;
    }

    // Valid cron part: numbers, *, /, -, ,, and ?
    const validCronChars = /^[\d*/,\-?]+$/;

    if (parts.length === 6) {
        // 6-field format: second minute hour day month weekday
        // First field: valid seconds (0-59, *, ranges, lists, steps)
        const sec = parts[0];
        if (!validCronChars.test(sec)) {
            return false;
        }
        // If it's a simple number, validate range
        if (/^\d+$/.test(sec) && (+sec < 0 || +sec > 59)) {
            return false;
        }
        // The rest must be valid cron fields
        for (let i = 1; i < 6; i++) {
            if (!parts[i] || !validCronChars.test(parts[i])) return false;
        }
    } else {
        // All must be valid cron fields
        for (let i = 0; i < 5; i++) {
            if (!parts[i] || !validCronChars.test(parts[i])) return false;
        }
    }
    return true;
}

/**
 * Validates interval expression format.
 *
 * Accepts time duration format with number followed by unit:
 * - ms: milliseconds
 * - s: seconds
 * - m: minutes
 * - h: hours
 * - d: days
 *
 * @param interval - The interval expression to validate
 * @returns True if the interval expression has valid format
 *
 * @example
 * ```typescript
 * console.log(isValidIntervalExpression('5m')); // true (5 minutes)
 * console.log(isValidIntervalExpression('2h')); // true (2 hours)
 * console.log(isValidIntervalExpression('30s')); // true (30 seconds)
 * console.log(isValidIntervalExpression('invalid')); // false
 * ```
 */
export function isValidIntervalExpression(interval: string): boolean {
    if (!interval || typeof interval !== 'string') {
        return false;
    }

    // Match patterns like: 1s, 5m, 2h, 1d, 30s, etc.
    // Also support ms (milliseconds) for very short intervals
    const intervalPattern = /^\d+(ms|[smhd])$/;
    return intervalPattern.test(interval.trim());
}
