import {
    Activity,
    ActivityMethod,
} from '../../src/decorators/activity.decorator';
import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../../src/constants';
import 'reflect-metadata';

describe('Activity Decorator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('@Activity', () => {
        it('should mark class with activity metadata', () => {
            @Activity()
            class TestActivity {}

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, TestActivity);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('TestActivity');
        });

        it('should mark class with custom activity options', () => {
            @Activity({ name: 'custom-activity' })
            class TestActivity {}

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, TestActivity);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('custom-activity');
            expect(metadata.className).toBe('TestActivity');
        });

        it('should handle activity without options', () => {
            @Activity()
            class SimpleActivity {}

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, SimpleActivity);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('SimpleActivity');
        });

        it('should return the same target class', () => {
            class OriginalActivity {}
            const DecoratedActivity = Activity()(OriginalActivity);

            expect(DecoratedActivity).toBe(OriginalActivity);
        });

        it('should work with empty options object', () => {
            @Activity({})
            class EmptyOptionsActivity {}

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, EmptyOptionsActivity);
            expect(metadata).toBeDefined();
            expect(metadata.className).toBe('EmptyOptionsActivity');
        });
    });

    describe('@ActivityMethod', () => {
        let TestActivity: any;

        beforeEach(() => {
            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }

                anotherMethod(): void {}

                methodWithArgs(_arg1: string, _arg2: number): boolean {
                    return true;
                }
            }
            TestActivity = TestActivityClass;
        });

        it('should use method name as activity name when no options provided', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            ActivityMethod()(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
            expect(metadata.methodName).toBe('testMethod');
        });

        it('should use custom name when string provided', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            ActivityMethod('custom-activity-name')(
                TestActivity.prototype,
                'testMethod',
                descriptor,
            );

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('custom-activity-name');
            expect(metadata.methodName).toBe('testMethod');
        });

        it('should use options object with name', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;
            const options = {
                name: 'options-activity-name',
                timeout: '30s',
                maxRetries: 3,
            };

            ActivityMethod(options)(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('options-activity-name');
            expect(metadata.timeout).toBe('30s');
            expect(metadata.maxRetries).toBe(3);
            expect(metadata.methodName).toBe('testMethod');
        });

        it('should use method name when options object has no name property', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;
            const options = {
                timeout: '60s',
                maxRetries: 5,
            };

            ActivityMethod(options)(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
            expect(metadata.timeout).toBe('60s');
            expect(metadata.maxRetries).toBe(5);
            expect(metadata.methodName).toBe('testMethod');
        });

        it('should throw error when activity name is empty string', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            expect(() => {
                ActivityMethod('')(TestActivity.prototype, 'testMethod', descriptor);
            }).toThrow('Activity name cannot be empty');
        });

        it('should throw error when options object has empty name', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;
            const options = { name: '' };

            expect(() => {
                ActivityMethod(options)(TestActivity.prototype, 'testMethod', descriptor);
            }).toThrow('Activity name cannot be empty');
        });

        it('should use method name when options object has whitespace-only name', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;
            const options = { name: '   ' };

            ActivityMethod(options)(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
        });

        it('should handle symbol property keys', () => {
            const symbolKey = Symbol('testSymbol');
            const descriptor = { value: function () {} };

            ActivityMethod()(TestActivity.prototype, symbolKey, descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('Symbol(testSymbol)');
            expect(metadata.methodName).toBe('Symbol(testSymbol)');
        });

        it('should handle decorators without descriptor', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata');

            const decorator = ActivityMethod();
            decorator(TestActivity.prototype, 'testMethod', {} as any);

            expect(spy).toHaveBeenCalledWith(
                TEMPORAL_ACTIVITY_METHOD,
                expect.objectContaining({
                    name: 'testMethod',
                    methodName: 'testMethod',
                }),
                TestActivity.prototype,
                'testMethod',
            );

            spy.mockRestore();
        });

        it('should handle all combinations of nameOrOptions parameter', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            // Test undefined
            ActivityMethod(undefined)(TestActivity.prototype, 'testMethod', descriptor);
            let metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata.name).toBe('testMethod');

            // Test null
            ActivityMethod(null as any)(TestActivity.prototype, 'anotherMethod', descriptor);
            metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata.name).toBe('anotherMethod');

            // Test empty object
            ActivityMethod({})(TestActivity.prototype, 'methodWithArgs', descriptor);
            metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata.name).toBe('methodWithArgs');
        });

        it('should preserve descriptor when provided', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            const result = ActivityMethod()(TestActivity.prototype, 'testMethod', descriptor);

            expect(result).toBe(descriptor);
        });

        it('should handle options with valid name but trimmed', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;
            const options = { name: 'valid-name' };

            ActivityMethod(options)(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('valid-name');
        });

        it('should apply SetMetadata when descriptor has value', () => {
            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivity.prototype,
                'testMethod',
            )!;

            ActivityMethod('test-name')(TestActivity.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('test-name');
            expect(metadata.methodName).toBe('testMethod');
        });
    });

    describe('Integration Tests', () => {
        it('should work together on a complete activity class', () => {
            class IntegrationActivity {
                methodOne(): string {
                    return 'one';
                }

                methodTwo(): string {
                    return 'two';
                }

                methodThree(): string {
                    return 'three';
                }
            }

            // Apply decorators manually to avoid TypeScript issues
            Activity({ name: 'integration-activity' })(IntegrationActivity);

            const methodOneDescriptor = Object.getOwnPropertyDescriptor(
                IntegrationActivity.prototype,
                'methodOne',
            )!;
            const methodTwoDescriptor = Object.getOwnPropertyDescriptor(
                IntegrationActivity.prototype,
                'methodTwo',
            )!;
            const methodThreeDescriptor = Object.getOwnPropertyDescriptor(
                IntegrationActivity.prototype,
                'methodThree',
            )!;

            ActivityMethod('method-one')(
                IntegrationActivity.prototype,
                'methodOne',
                methodOneDescriptor,
            );
            ActivityMethod({ name: 'method-two', timeout: '30s' })(
                IntegrationActivity.prototype,
                'methodTwo',
                methodTwoDescriptor,
            );
            ActivityMethod()(IntegrationActivity.prototype, 'methodThree', methodThreeDescriptor);

            // Test class metadata
            const classMetadata = Reflect.getMetadata(TEMPORAL_ACTIVITY, IntegrationActivity);
            expect(classMetadata).toBeDefined();
            expect(classMetadata.name).toBe('integration-activity');

            // Test method metadata
            const methodOneMetadata = Reflect.getMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                methodOneDescriptor.value,
            );
            expect(methodOneMetadata.name).toBe('method-one');

            const methodTwoMetadata = Reflect.getMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                methodTwoDescriptor.value,
            );
            expect(methodTwoMetadata.name).toBe('method-two');
            expect(methodTwoMetadata.timeout).toBe('30s');

            const methodThreeMetadata = Reflect.getMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                methodThreeDescriptor.value,
            );
            expect(methodThreeMetadata.name).toBe('methodThree');
        });
    });

    describe('@Activity Error Handling', () => {
        it('should handle error when Reflect.defineMetadata fails', () => {
            // Mock Reflect.defineMetadata to throw an error
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Metadata storage failed');
            });

            expect(() => {
                @Activity()
                class TestActivity {}
            }).toThrow('Metadata storage failed');

            // Restore original function
            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should handle error when Reflect.defineMetadata fails on prototype', () => {
            // Mock Reflect.defineMetadata to fail on the second call (prototype)
            let callCount = 0;
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Prototype metadata storage failed');
                }
            });

            expect(() => {
                @Activity()
                class TestActivity {}
            }).toThrow('Prototype metadata storage failed');

            // Restore original function
            Reflect.defineMetadata = originalDefineMetadata;
        });
    });

    describe('@ActivityMethod Error Handling', () => {
        it('should handle error when Reflect.defineMetadata fails on method function', () => {
            // Mock Reflect.defineMetadata to throw an error
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Method metadata storage failed');
            });

            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivityClass.prototype,
                'testMethod',
            )!;

            expect(() => {
                ActivityMethod()(TestActivityClass.prototype, 'testMethod', descriptor);
            }).toThrow('Method metadata storage failed');

            // Restore original function
            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should handle error when Reflect.defineMetadata fails on prototype', () => {
            // Mock Reflect.defineMetadata to fail on the second call (prototype)
            let callCount = 0;
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Prototype method metadata storage failed');
                }
            });

            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivityClass.prototype,
                'testMethod',
            )!;

            expect(() => {
                ActivityMethod()(TestActivityClass.prototype, 'testMethod', descriptor);
            }).toThrow('Prototype method metadata storage failed');

            // Restore original function
            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should handle error when Reflect.defineMetadata fails on property', () => {
            // Mock Reflect.defineMetadata to throw an error
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Property metadata storage failed');
            });

            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            expect(() => {
                ActivityMethod()(
                    TestActivityClass.prototype,
                    'testMethod',
                    {} as PropertyDescriptor,
                );
            }).toThrow('Property metadata storage failed');

            // Restore original function
            Reflect.defineMetadata = originalDefineMetadata;
        });
    });


    describe('@Activity Edge Cases', () => {
        it('should handle class with undefined name', () => {
            // Create a class with undefined name
            const TestActivity = class {};
            Object.defineProperty(TestActivity, 'name', { value: undefined, configurable: true });

            const decorated = Activity()(TestActivity);
            expect(decorated).toBe(TestActivity);
        });

        it('should handle class with empty string name', () => {
            // Create a class with empty string name
            const TestActivity = class {};
            Object.defineProperty(TestActivity, 'name', { value: '', configurable: true });

            const decorated = Activity()(TestActivity);
            expect(decorated).toBe(TestActivity);
        });

        it('should handle class with null name', () => {
            // Create a class with null name
            const TestActivity = class {};
            Object.defineProperty(TestActivity, 'name', { value: null, configurable: true });

            const decorated = Activity()(TestActivity);
            expect(decorated).toBe(TestActivity);
        });
    });

    describe('@ActivityMethod Edge Cases', () => {
        it('should handle method with undefined constructor name', () => {
            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            // Mock constructor name to be undefined
            Object.defineProperty(TestActivityClass.prototype.constructor, 'name', {
                value: undefined,
                configurable: true,
            });

            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivityClass.prototype,
                'testMethod',
            )!;

            ActivityMethod()(TestActivityClass.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
        });

        it('should handle method with empty constructor name', () => {
            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            // Mock constructor name to be empty string
            Object.defineProperty(TestActivityClass.prototype.constructor, 'name', {
                value: '',
                configurable: true,
            });

            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivityClass.prototype,
                'testMethod',
            )!;

            ActivityMethod()(TestActivityClass.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
        });

        it('should handle method with null constructor name', () => {
            class TestActivityClass {
                testMethod(): string {
                    return 'test';
                }
            }

            // Mock constructor name to be null
            Object.defineProperty(TestActivityClass.prototype.constructor, 'name', {
                value: null,
                configurable: true,
            });

            const descriptor = Object.getOwnPropertyDescriptor(
                TestActivityClass.prototype,
                'testMethod',
            )!;

            ActivityMethod()(TestActivityClass.prototype, 'testMethod', descriptor);

            const metadata = Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, descriptor.value);
            expect(metadata).toBeDefined();
            expect(metadata.name).toBe('testMethod');
        });
    });
});
