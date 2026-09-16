import 'reflect-metadata';
import {
    isActivity,
    getActivityMetadata,
    isActivityMethod,
    getActivityMethodMetadata,
    isLocalActivity,
    getLocalActivityOptions,
} from '../../src/utils/metadata';
import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../../src/constants';
import { ActivityOptions, ActivityMethodOptions } from '../../src/interfaces';

describe('Metadata Utilities', () => {
    beforeEach(() => {
        // Clear all metadata before each test
        jest.clearAllMocks();
    });

    describe('Activity Metadata', () => {
        describe('isActivity', () => {
            it('should return true when class has activity metadata', () => {
                const activityOptions: ActivityOptions = { name: 'test-activity' };
                const TestClass = class {};
                Reflect.defineMetadata(TEMPORAL_ACTIVITY, activityOptions, TestClass);

                expect(isActivity(TestClass)).toBe(true);
            });

            it('should return false when class does not have activity metadata', () => {
                const TestClass = class {};

                expect(isActivity(TestClass)).toBe(false);
            });

            it('should return false for null/undefined input', () => {
                expect(isActivity(null as any)).toBe(false);
                expect(isActivity(undefined as any)).toBe(false);
            });
        });

        describe('getActivityMetadata', () => {
            it('should return activity metadata when present', () => {
                const activityOptions: ActivityOptions = { name: 'test-activity' };
                const TestClass = class {};
                Reflect.defineMetadata(TEMPORAL_ACTIVITY, activityOptions, TestClass);

                const result = getActivityMetadata(TestClass);
                expect(result).toEqual(activityOptions);
            });

            it('should return undefined when no activity metadata is present', () => {
                const TestClass = class {};

                const result = getActivityMetadata(TestClass);
                expect(result).toBeUndefined();
            });

            it('should return undefined for null/undefined input', () => {
                expect(getActivityMetadata(null as any)).toBeUndefined();
                expect(getActivityMetadata(undefined as any)).toBeUndefined();
            });
        });

        describe('isActivityMethod', () => {
            it('should return true when method has activity method metadata', () => {
                const methodOptions: ActivityMethodOptions = { name: 'test-method' };
                const TestClass = class {
                    testMethod() {}
                };
                // Set metadata on the method function itself, not on the prototype
                Reflect.defineMetadata(
                    TEMPORAL_ACTIVITY_METHOD,
                    methodOptions,
                    TestClass.prototype.testMethod,
                );

                expect(isActivityMethod(TestClass.prototype.testMethod)).toBe(true);
            });

            it('should return false when method does not have activity method metadata', () => {
                const TestClass = class {
                    testMethod() {}
                };

                expect(isActivityMethod(TestClass.prototype.testMethod)).toBe(false);
            });

            it('should return false for null/undefined input', () => {
                expect(isActivityMethod(null as any)).toBe(false);
                expect(isActivityMethod(undefined as any)).toBe(false);
            });
        });

        describe('getActivityMethodMetadata', () => {
            it('should return activity method metadata when present', () => {
                const methodOptions: ActivityMethodOptions = { name: 'test-method' };
                const TestClass = class {
                    testMethod() {}
                };
                // Set metadata on the method function itself, not on the prototype
                Reflect.defineMetadata(
                    TEMPORAL_ACTIVITY_METHOD,
                    methodOptions,
                    TestClass.prototype.testMethod,
                );

                const result = getActivityMethodMetadata(TestClass.prototype.testMethod);
                expect(result).toEqual(methodOptions);
            });

            it('should return undefined when no activity method metadata is present', () => {
                const TestClass = class {
                    testMethod() {}
                };

                const result = getActivityMethodMetadata(TestClass.prototype.testMethod);
                expect(result).toBeUndefined();
            });

            it('should return undefined for null/undefined input', () => {
                expect(getActivityMethodMetadata(null as any)).toBeUndefined();
                expect(getActivityMethodMetadata(undefined as any)).toBeUndefined();
            });
        });
    });

    describe('Local Activity Metadata', () => {
        function defineActivityMethod(
            target: Function,
            methodName: string,
            options: ActivityMethodOptions,
        ): void {
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { [methodName]: { name: methodName, ...options } },
                target.prototype,
            );
        }

        describe('isLocalActivity', () => {
            it('should return true when the method was marked local: true', () => {
                class TestClass {
                    quickLookup() {}
                }
                defineActivityMethod(TestClass, 'quickLookup', { local: true });

                expect(isLocalActivity(TestClass, 'quickLookup')).toBe(true);
            });

            it('should return false when the method has metadata but is not local', () => {
                class TestClass {
                    regularMethod() {}
                }
                defineActivityMethod(TestClass, 'regularMethod', {});

                expect(isLocalActivity(TestClass, 'regularMethod')).toBe(false);
            });

            it('should return false when the class has no activity method metadata', () => {
                class TestClass {
                    plainMethod() {}
                }

                expect(isLocalActivity(TestClass, 'plainMethod')).toBe(false);
            });

            it('should return false for null/undefined target or methodName', () => {
                class TestClass {}
                expect(isLocalActivity(null as any, 'method')).toBe(false);
                expect(isLocalActivity(TestClass, undefined as any)).toBe(false);
            });
        });

        describe('getLocalActivityOptions', () => {
            it('should return the recorded localActivityOptions', () => {
                class TestClass {
                    quickLookup() {}
                }
                const localActivityOptions = { scheduleToCloseTimeout: '2s' };
                defineActivityMethod(TestClass, 'quickLookup', {
                    local: true,
                    localActivityOptions,
                });

                expect(getLocalActivityOptions(TestClass, 'quickLookup')).toEqual(
                    localActivityOptions,
                );
            });

            it('should return undefined when no options were recorded', () => {
                class TestClass {
                    quickLookup() {}
                }
                defineActivityMethod(TestClass, 'quickLookup', { local: true });

                expect(getLocalActivityOptions(TestClass, 'quickLookup')).toBeUndefined();
            });

            it('should return undefined for null/undefined target or methodName', () => {
                class TestClass {}
                expect(getLocalActivityOptions(null as any, 'method')).toBeUndefined();
                expect(getLocalActivityOptions(TestClass, undefined as any)).toBeUndefined();
            });
        });
    });

    describe('Integration Tests', () => {
        it('should work with complete activity setup', () => {
            const activityOptions: ActivityOptions = { name: 'test-activity' };
            const methodOptions: ActivityMethodOptions = { name: 'test-method' };

            const TestActivity = class {
                testMethod() {}
            };

            // Set up activity metadata
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, activityOptions, TestActivity);
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                methodOptions,
                TestActivity.prototype.testMethod,
            );

            // Verify activity metadata
            expect(isActivity(TestActivity)).toBe(true);
            expect(getActivityMetadata(TestActivity)).toEqual(activityOptions);

            // Verify method metadata
            expect(isActivityMethod(TestActivity.prototype.testMethod)).toBe(true);
            expect(getActivityMethodMetadata(TestActivity.prototype.testMethod)).toEqual(
                methodOptions,
            );
        });
    });
});
