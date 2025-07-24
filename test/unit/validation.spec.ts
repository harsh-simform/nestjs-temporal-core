import { isValidCronExpression, isValidIntervalExpression } from '../../src/utils/validation';

describe('Validation Utilities', () => {
    describe('isValidCronExpression', () => {
        describe('valid cron expressions', () => {
            it('should validate 5-field cron expressions', () => {
                expect(isValidCronExpression('0 8 * * *')).toBe(true); // daily at 8 AM
                expect(isValidCronExpression('30 12 * * 1')).toBe(true); // Monday at 12:30 PM
                expect(isValidCronExpression('0 0 1 * *')).toBe(true); // 1st of every month
                expect(isValidCronExpression('0 0 * * 0')).toBe(true); // Sunday at midnight
                expect(isValidCronExpression('15 10 * * 1-5')).toBe(true); // weekdays at 10:15 AM
            });

            it('should validate 6-field cron expressions', () => {
                expect(isValidCronExpression('0 0 8 * * *')).toBe(true); // daily at 8 AM (with seconds)
                expect(isValidCronExpression('30 0 12 * * 1')).toBe(true); // Monday at 12:00:30 PM
                expect(isValidCronExpression('0 0 0 1 * *')).toBe(true); // 1st of every month at midnight
                expect(isValidCronExpression('0 0 0 * * 0')).toBe(true); // Sunday at midnight
                expect(isValidCronExpression('15 0 10 * * 1-5')).toBe(true); // weekdays at 10:00:15 AM
            });

            it('should handle expressions with extra whitespace', () => {
                expect(isValidCronExpression('  0  8  *  *  *  ')).toBe(true);
                expect(isValidCronExpression('0    8    *    *    *')).toBe(true);
            });

            it('should handle complex cron expressions', () => {
                expect(isValidCronExpression('0 12 * * 1,3,5')).toBe(true); // Monday, Wednesday, Friday at noon
                expect(isValidCronExpression('0 0 1,15 * *')).toBe(true); // 1st and 15th of every month
                expect(isValidCronExpression('0 0 1-5 * *')).toBe(true); // 1st through 5th of every month
                expect(
                    isValidCronExpression('0 0 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29 * *'),
                ).toBe(true); // odd days
            });
        });

        describe('invalid cron expressions', () => {
            it('should reject empty or null input', () => {
                expect(isValidCronExpression('')).toBe(false);
                expect(isValidCronExpression(null as any)).toBe(false);
                expect(isValidCronExpression(undefined as any)).toBe(false);
            });

            it('should reject non-string input', () => {
                expect(isValidCronExpression(123 as any)).toBe(false);
                expect(isValidCronExpression({} as any)).toBe(false);
                expect(isValidCronExpression([] as any)).toBe(false);
                expect(isValidCronExpression(true as any)).toBe(false);
            });

            it('should reject expressions with wrong number of fields', () => {
                expect(isValidCronExpression('0 8 * *')).toBe(false); // 4 fields
                expect(isValidCronExpression('0 8 * * * * *')).toBe(false); // 7 fields
                expect(isValidCronExpression('0')).toBe(false); // 1 field
                expect(isValidCronExpression('0 8')).toBe(false); // 2 fields
            });

            it('should reject expressions with empty parts', () => {
                expect(isValidCronExpression('0 8 * *')).toBe(false); // missing weekday
                expect(isValidCronExpression('0 8 * * ')).toBe(false); // empty weekday
                expect(isValidCronExpression(' 0 8 * * *')).toBe(false); // empty minute
                expect(isValidCronExpression('0   * * *')).toBe(false); // empty hour
            });

            it('should reject malformed expressions', () => {
                expect(isValidCronExpression('invalid')).toBe(false);
                expect(isValidCronExpression('60 8 * * * *')).toBe(false); // invalid seconds field (>59)
                expect(isValidCronExpression('0 8 * * * * *')).toBe(false); // too many fields
            });
        });

        describe('edge cases', () => {
            it('should handle single spaces between parts', () => {
                expect(isValidCronExpression('0 8 * * *')).toBe(true);
            });

            it('should handle multiple spaces between parts', () => {
                expect(isValidCronExpression('0    8    *    *    *')).toBe(true);
            });

            it('should handle tabs and other whitespace', () => {
                expect(isValidCronExpression('0\t8\t*\t*\t*')).toBe(true);
                expect(isValidCronExpression('0\n8\n*\n*\n*')).toBe(true);
            });

            it('should handle expressions with only whitespace parts', () => {
                expect(isValidCronExpression('0 8 * *')).toBe(false); // missing part
                expect(isValidCronExpression('0 8 * * ')).toBe(false); // empty part
            });

            it('should handle parts.length check edge case (line 32)', () => {
                // Test the explicit check for parts.length < 5 on line 32
                expect(isValidCronExpression('0 8')).toBe(false); // 2 parts - triggers line 32
                expect(isValidCronExpression('0')).toBe(false); // 1 part - triggers line 32
                expect(isValidCronExpression('')).toBe(false); // 0 parts - triggers line 32
            });

            it('should reject single leading space before digit pattern', () => {
                // Test the specific pattern from lines 24-26: single leading space before digit (ambiguous)
                expect(isValidCronExpression(' 0 8 * * *')).toBe(false); // single leading space - should be rejected
                expect(isValidCronExpression('  0 8 * * *')).toBe(true); // multiple leading spaces - should be allowed
                expect(isValidCronExpression('   0 8 * * *')).toBe(true); // multiple leading spaces - should be allowed
            });

            it('should handle edge cases for valid cron regex', () => {
                // Test expressions that contain valid characters but in specific combinations
                expect(isValidCronExpression('L * * * *')).toBe(true); // L is valid for last day
                expect(isValidCronExpression('W * * * *')).toBe(true); // W is valid for weekday
                expect(isValidCronExpression('? * * * *')).toBe(true); // ? is valid for day/weekday
                expect(isValidCronExpression('1/5 * * * *')).toBe(true); // slash notation
                expect(isValidCronExpression('1-5 * * * *')).toBe(true); // range notation
            });

            it('should handle seconds field validation for 6-field expressions', () => {
                // Test seconds field boundary conditions
                expect(isValidCronExpression('59 0 8 * * *')).toBe(true); // 59 seconds is valid
                expect(isValidCronExpression('60 0 8 * * *')).toBe(false); // 60 seconds is invalid
                expect(isValidCronExpression('100 0 8 * * *')).toBe(false); // 100 seconds is invalid
            });

            it('should reject 6-field cron with invalid characters in seconds field', () => {
                expect(isValidCronExpression('a 8 * * * *')).toBe(false); // invalid character in seconds
                expect(isValidCronExpression('@ 8 * * * *')).toBe(false); // invalid character in seconds
                expect(isValidCronExpression('# 8 * * * *')).toBe(false); // invalid character in seconds
            });

            it('should reject 6-field cron with invalid characters in other fields', () => {
                expect(isValidCronExpression('0 @ * * * *')).toBe(false); // invalid character in minute
                expect(isValidCronExpression('0 0 & * * *')).toBe(false); // invalid character in hour
                expect(isValidCronExpression('0 0 0 # * *')).toBe(false); // invalid character in day
                expect(isValidCronExpression('0 0 0 0 @ *')).toBe(false); // invalid character in month
                expect(isValidCronExpression('0 0 0 0 0 &')).toBe(false); // invalid character in weekday
            });

            it('should reject 5-field cron with invalid characters', () => {
                expect(isValidCronExpression('@ 8 * * *')).toBe(false); // invalid character in minute
                expect(isValidCronExpression('0 & * * *')).toBe(false); // invalid character in hour
                expect(isValidCronExpression('0 0 # * *')).toBe(false); // invalid character in day
                expect(isValidCronExpression('0 0 0 @ *')).toBe(false); // invalid character in month
                expect(isValidCronExpression('0 0 0 0 &')).toBe(false); // invalid character in weekday
            });
        });
    });

    describe('isValidIntervalExpression', () => {
        describe('valid interval expressions', () => {
            it('should validate seconds', () => {
                expect(isValidIntervalExpression('1s')).toBe(true);
                expect(isValidIntervalExpression('30s')).toBe(true);
                expect(isValidIntervalExpression('60s')).toBe(true);
                expect(isValidIntervalExpression('0s')).toBe(true);
            });

            it('should validate minutes', () => {
                expect(isValidIntervalExpression('1m')).toBe(true);
                expect(isValidIntervalExpression('5m')).toBe(true);
                expect(isValidIntervalExpression('60m')).toBe(true);
                expect(isValidIntervalExpression('0m')).toBe(true);
            });

            it('should validate hours', () => {
                expect(isValidIntervalExpression('1h')).toBe(true);
                expect(isValidIntervalExpression('2h')).toBe(true);
                expect(isValidIntervalExpression('24h')).toBe(true);
                expect(isValidIntervalExpression('0h')).toBe(true);
            });

            it('should validate days', () => {
                expect(isValidIntervalExpression('1d')).toBe(true);
                expect(isValidIntervalExpression('7d')).toBe(true);
                expect(isValidIntervalExpression('30d')).toBe(true);
                expect(isValidIntervalExpression('0d')).toBe(true);
            });

            it('should validate milliseconds', () => {
                expect(isValidIntervalExpression('100ms')).toBe(true);
                expect(isValidIntervalExpression('500ms')).toBe(true);
                expect(isValidIntervalExpression('1000ms')).toBe(true);
                expect(isValidIntervalExpression('0ms')).toBe(true);
            });

            it('should handle large numbers', () => {
                expect(isValidIntervalExpression('999999s')).toBe(true);
                expect(isValidIntervalExpression('999999m')).toBe(true);
                expect(isValidIntervalExpression('999999h')).toBe(true);
                expect(isValidIntervalExpression('999999d')).toBe(true);
                expect(isValidIntervalExpression('999999ms')).toBe(true);
            });

            it('should handle expressions with whitespace', () => {
                expect(isValidIntervalExpression(' 5m ')).toBe(true);
                expect(isValidIntervalExpression('  2h  ')).toBe(true);
                expect(isValidIntervalExpression('\t30s\t')).toBe(true);
            });
        });

        describe('invalid interval expressions', () => {
            it('should reject empty or null input', () => {
                expect(isValidIntervalExpression('')).toBe(false);
                expect(isValidIntervalExpression(null as any)).toBe(false);
                expect(isValidIntervalExpression(undefined as any)).toBe(false);
            });

            it('should reject non-string input', () => {
                expect(isValidIntervalExpression(123 as any)).toBe(false);
                expect(isValidIntervalExpression({} as any)).toBe(false);
                expect(isValidIntervalExpression([] as any)).toBe(false);
                expect(isValidIntervalExpression(true as any)).toBe(false);
            });

            it('should reject expressions without units', () => {
                expect(isValidIntervalExpression('5')).toBe(false);
                expect(isValidIntervalExpression('30')).toBe(false);
                expect(isValidIntervalExpression('0')).toBe(false);
            });

            it('should reject expressions with invalid units', () => {
                expect(isValidIntervalExpression('5x')).toBe(false);
                expect(isValidIntervalExpression('30y')).toBe(false);
                expect(isValidIntervalExpression('1w')).toBe(false);
                expect(isValidIntervalExpression('2mo')).toBe(false);
            });

            it('should reject expressions with decimal numbers', () => {
                expect(isValidIntervalExpression('5.5m')).toBe(false);
                expect(isValidIntervalExpression('2.5h')).toBe(false);
                expect(isValidIntervalExpression('1.5s')).toBe(false);
            });

            it('should reject expressions with negative numbers', () => {
                expect(isValidIntervalExpression('-5m')).toBe(false);
                expect(isValidIntervalExpression('-2h')).toBe(false);
                expect(isValidIntervalExpression('-30s')).toBe(false);
            });

            it('should reject expressions with letters before numbers', () => {
                expect(isValidIntervalExpression('m5')).toBe(false);
                expect(isValidIntervalExpression('h2')).toBe(false);
                expect(isValidIntervalExpression('s30')).toBe(false);
            });

            it('should reject expressions with multiple units', () => {
                expect(isValidIntervalExpression('5mh')).toBe(false);
                expect(isValidIntervalExpression('2hs')).toBe(false);
                expect(isValidIntervalExpression('30sm')).toBe(false);
            });

            it('should reject expressions with spaces between number and unit', () => {
                expect(isValidIntervalExpression('5 m')).toBe(false);
                expect(isValidIntervalExpression('2 h')).toBe(false);
                expect(isValidIntervalExpression('30 s')).toBe(false);
            });

            it('should reject expressions with invalid characters', () => {
                expect(isValidIntervalExpression('5m!')).toBe(false);
                expect(isValidIntervalExpression('2h@')).toBe(false);
                expect(isValidIntervalExpression('30s#')).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle zero values', () => {
                expect(isValidIntervalExpression('0s')).toBe(true);
                expect(isValidIntervalExpression('0m')).toBe(true);
                expect(isValidIntervalExpression('0h')).toBe(true);
                expect(isValidIntervalExpression('0d')).toBe(true);
                expect(isValidIntervalExpression('0ms')).toBe(true);
            });

            it('should handle single digit numbers', () => {
                expect(isValidIntervalExpression('1s')).toBe(true);
                expect(isValidIntervalExpression('1m')).toBe(true);
                expect(isValidIntervalExpression('1h')).toBe(true);
                expect(isValidIntervalExpression('1d')).toBe(true);
                expect(isValidIntervalExpression('1ms')).toBe(true);
            });

            it('should handle very large numbers', () => {
                expect(isValidIntervalExpression('999999999s')).toBe(true);
                expect(isValidIntervalExpression('999999999m')).toBe(true);
                expect(isValidIntervalExpression('999999999h')).toBe(true);
                expect(isValidIntervalExpression('999999999d')).toBe(true);
                expect(isValidIntervalExpression('999999999ms')).toBe(true);
            });

            it('should handle mixed case units', () => {
                expect(isValidIntervalExpression('5S')).toBe(false);
                expect(isValidIntervalExpression('2M')).toBe(false);
                expect(isValidIntervalExpression('30H')).toBe(false);
                expect(isValidIntervalExpression('1D')).toBe(false);
                expect(isValidIntervalExpression('100MS')).toBe(false);
            });

            it('should handle edge cases for regex validation', () => {
                // Test boundary cases for the regex pattern
                expect(isValidIntervalExpression('1ms')).toBe(true); // minimal ms
                expect(isValidIntervalExpression('1s')).toBe(true); // minimal s
                expect(isValidIntervalExpression('1m')).toBe(true); // minimal m
                expect(isValidIntervalExpression('1h')).toBe(true); // minimal h
                expect(isValidIntervalExpression('1d')).toBe(true); // minimal d
                
                // Test expressions with only whitespace (after trim)
                expect(isValidIntervalExpression('   ')).toBe(false); // only spaces
                expect(isValidIntervalExpression('\t\t')).toBe(false); // only tabs
                expect(isValidIntervalExpression('\n\n')).toBe(false); // only newlines
            });
        });
    });

    describe('Integration Tests', () => {
        it('should work with common scheduling patterns', () => {
            // Common cron patterns
            expect(isValidCronExpression('0 0 * * *')).toBe(true); // daily at midnight
            expect(isValidCronExpression('0 12 * * 1')).toBe(true); // Monday at noon
            expect(isValidCronExpression('0 0 1 * *')).toBe(true); // 1st of every month

            // Common interval patterns
            expect(isValidIntervalExpression('5m')).toBe(true); // every 5 minutes
            expect(isValidIntervalExpression('1h')).toBe(true); // every hour
            expect(isValidIntervalExpression('1d')).toBe(true); // every day
        });

        it('should handle realistic scheduling scenarios', () => {
            // Business hours scheduling
            expect(isValidCronExpression('0 9 * * 1-5')).toBe(true); // 9 AM weekdays
            expect(isValidCronExpression('0 17 * * 1-5')).toBe(true); // 5 PM weekdays

            // Regular maintenance intervals
            expect(isValidIntervalExpression('15m')).toBe(true); // every 15 minutes
            expect(isValidIntervalExpression('6h')).toBe(true); // every 6 hours
            expect(isValidIntervalExpression('7d')).toBe(true); // weekly
        });
    });
});
