import 'reflect-metadata';
import { Scheduled, Cron, Interval } from '../../src/decorators/scheduling.decorator';
import { TEMPORAL_SCHEDULED_WORKFLOW } from '../../src/constants';

jest.mock('../../src/utils', () => ({
    isValidCronExpression: jest.fn(),
    isValidIntervalExpression: jest.fn(),
}));

const { isValidCronExpression, isValidIntervalExpression } = require('../../src/utils');

describe('Scheduling Decorators', () => {
    let testTarget: any;
    let testDescriptor: PropertyDescriptor;

    beforeEach(() => {
        testTarget = {};
        testDescriptor = {
            value: jest.fn(),
            writable: true,
            enumerable: true,
            configurable: true,
        };
        jest.clearAllMocks();
    });

    describe('Scheduled', () => {
        it('should set metadata for valid cron schedule', () => {
            isValidCronExpression.mockReturnValue(true);
            
            const options = {
                scheduleId: 'test-schedule',
                cron: '0 8 * * *',
                description: 'Test schedule',
            };

            const decorator = Scheduled(options);
            const result = decorator(testTarget, 'testMethod', testDescriptor);

            expect(result).toBe(testDescriptor);
            expect(Reflect.getMetadata(TEMPORAL_SCHEDULED_WORKFLOW, testDescriptor.value)).toEqual(options);
        });

        it('should set metadata for valid interval schedule', () => {
            isValidIntervalExpression.mockReturnValue(true);
            
            const options = {
                scheduleId: 'test-schedule',
                interval: '1h',
                description: 'Test schedule',
            };

            const decorator = Scheduled(options);
            const result = decorator(testTarget, 'testMethod', testDescriptor);

            expect(result).toBe(testDescriptor);
            expect(Reflect.getMetadata(TEMPORAL_SCHEDULED_WORKFLOW, testDescriptor.value)).toEqual(options);
        });

        it('should throw error when scheduleId is missing', () => {
            const options = {
                cron: '0 8 * * *',
            } as any;

            expect(() => {
                const decorator = Scheduled(options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('@Scheduled requires scheduleId');
        });

        it('should throw error when both cron and interval are missing', () => {
            const options = {
                scheduleId: 'test-schedule',
            } as any;

            expect(() => {
                const decorator = Scheduled(options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('@Scheduled requires either cron or interval');
        });

        it('should throw error when both cron and interval are provided', () => {
            const options = {
                scheduleId: 'test-schedule',
                cron: '0 8 * * *',
                interval: '1h',
            };

            expect(() => {
                const decorator = Scheduled(options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('@Scheduled cannot have both cron and interval');
        });

        it('should throw error for invalid cron expression', () => {
            isValidCronExpression.mockReturnValue(false);
            
            const options = {
                scheduleId: 'test-schedule',
                cron: 'invalid-cron',
            };

            expect(() => {
                const decorator = Scheduled(options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('Invalid cron expression: invalid-cron');
        });

        it('should throw error for invalid interval expression', () => {
            isValidIntervalExpression.mockReturnValue(false);
            
            const options = {
                scheduleId: 'test-schedule',
                interval: 'invalid-interval',
            };

            expect(() => {
                const decorator = Scheduled(options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('Invalid interval expression: invalid-interval');
        });
    });

    describe('Cron', () => {
        it('should create scheduled decorator with cron expression', () => {
            isValidCronExpression.mockReturnValue(true);
            
            const cronExpression = '0 8 * * *';
            const options = {
                scheduleId: 'test-cron',
                description: 'Test cron',
            };

            const decorator = Cron(cronExpression, options);
            const result = decorator(testTarget, 'testMethod', testDescriptor);

            expect(result).toBe(testDescriptor);
            expect(Reflect.getMetadata(TEMPORAL_SCHEDULED_WORKFLOW, testDescriptor.value)).toEqual({
                ...options,
                cron: cronExpression,
            });
        });

        it('should validate cron expression', () => {
            isValidCronExpression.mockReturnValue(false);
            
            const cronExpression = 'invalid-cron';
            const options = {
                scheduleId: 'test-cron',
            };

            expect(() => {
                const decorator = Cron(cronExpression, options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('Invalid cron expression: invalid-cron');
        });
    });

    describe('Interval', () => {
        it('should create scheduled decorator with interval expression', () => {
            isValidIntervalExpression.mockReturnValue(true);
            
            const intervalExpression = '1h';
            const options = {
                scheduleId: 'test-interval',
                description: 'Test interval',
            };

            const decorator = Interval(intervalExpression, options);
            const result = decorator(testTarget, 'testMethod', testDescriptor);

            expect(result).toBe(testDescriptor);
            expect(Reflect.getMetadata(TEMPORAL_SCHEDULED_WORKFLOW, testDescriptor.value)).toEqual({
                ...options,
                interval: intervalExpression,
            });
        });

        it('should validate interval expression', () => {
            isValidIntervalExpression.mockReturnValue(false);
            
            const intervalExpression = 'invalid-interval';
            const options = {
                scheduleId: 'test-interval',
            };

            expect(() => {
                const decorator = Interval(intervalExpression, options);
                decorator(testTarget, 'testMethod', testDescriptor);
            }).toThrow('Invalid interval expression: invalid-interval');
        });
    });
});