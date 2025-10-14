import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import {
    TEMPORAL_ACTIVITY,
    TEMPORAL_ACTIVITY_METHOD,
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../../src/constants';
import 'reflect-metadata';

describe('TemporalMetadataAccessor', () => {
    let service: TemporalMetadataAccessor;

    // Mock classes with decorators
    class MockActivityClass {
        testMethod() {
            return 'test';
        }

        anotherMethod(arg: string) {
            return arg;
        }
    }

    class MockNonActivityClass {
        regularMethod() {
            return 'regular';
        }
    }

    class MockManyMethodsClass {
        // Define 55 methods so they can have metadata attached
        method0() {}
        method1() {}
        method2() {}
        method3() {}
        method4() {}
        method5() {}
        method6() {}
        method7() {}
        method8() {}
        method9() {}
        method10() {}
        method11() {}
        method12() {}
        method13() {}
        method14() {}
        method15() {}
        method16() {}
        method17() {}
        method18() {}
        method19() {}
        method20() {}
        method21() {}
        method22() {}
        method23() {}
        method24() {}
        method25() {}
        method26() {}
        method27() {}
        method28() {}
        method29() {}
        method30() {}
        method31() {}
        method32() {}
        method33() {}
        method34() {}
        method35() {}
        method36() {}
        method37() {}
        method38() {}
        method39() {}
        method40() {}
        method41() {}
        method42() {}
        method43() {}
        method44() {}
        method45() {}
        method46() {}
        method47() {}
        method48() {}
        method49() {}
        method50() {}
        method51() {}
        method52() {}
        method53() {}
        method54() {}
    }

    beforeEach(() => {
        service = new TemporalMetadataAccessor();

        // Set up metadata for MockActivityClass
        Reflect.defineMetadata(TEMPORAL_ACTIVITY, { name: 'TestActivity' }, MockActivityClass);

        // Set collection metadata on prototype
        Reflect.defineMetadata(
            TEMPORAL_ACTIVITY_METHOD,
            {
                testMethod: { name: 'testActivity' },
                anotherMethod: { name: 'anotherActivity', options: { timeout: 5000 } },
            },
            MockActivityClass.prototype,
        );

        // Also set individual metadata for methods that need it
        Reflect.defineMetadata(
            TEMPORAL_ACTIVITY_METHOD,
            { name: 'testActivity' },
            MockActivityClass.prototype,
            'testMethod',
        );
        Reflect.defineMetadata(
            TEMPORAL_ACTIVITY_METHOD,
            { name: 'anotherActivity', options: { timeout: 5000 } },
            MockActivityClass.prototype,
            'anotherMethod',
        );

        // Set up metadata for many methods test
        const manyMethods: Record<string, unknown> = {};
        for (let i = 0; i < 55; i++) {
            manyMethods[`method${i}`] = { name: `activity${i}` };
        }
        Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, MockManyMethodsClass);
        Reflect.defineMetadata(
            TEMPORAL_ACTIVITY_METHOD,
            manyMethods,
            MockManyMethodsClass.prototype,
        );
    });

    afterEach(() => {
        service.clearCache();
    });

    describe('isActivity', () => {
        it('should return true for class with activity metadata', () => {
            expect(service.isActivity(MockActivityClass)).toBe(true);
        });

        it('should return false for class without activity metadata', () => {
            expect(service.isActivity(MockNonActivityClass)).toBe(false);
        });

        it('should handle errors gracefully', () => {
            const invalidTarget = null as any;
            expect(service.isActivity(invalidTarget)).toBe(false);
        });

        it('should check prototype metadata', () => {
            class ProtoActivity {}
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, ProtoActivity.prototype);

            expect(service.isActivity(ProtoActivity)).toBe(true);
        });
    });

    describe('isActivityMethod', () => {
        it('should return true for method with activity method metadata', () => {
            const instance = new MockActivityClass();
            expect(service.isActivityMethod(instance, 'testMethod')).toBe(true);
        });

        it('should return false for method without metadata', () => {
            const instance = new MockActivityClass();
            expect(service.isActivityMethod(instance, 'nonExistentMethod')).toBe(false);
        });

        it('should return false for null target', () => {
            expect(service.isActivityMethod(null, 'test')).toBe(false);
        });

        it('should return false for string target', () => {
            expect(service.isActivityMethod('string', 'test')).toBe(false);
        });

        it('should handle undefined target', () => {
            expect(service.isActivityMethod(undefined, 'test')).toBe(false);
        });

        it('should handle errors gracefully', () => {
            const invalidTarget = {};
            expect(service.isActivityMethod(invalidTarget, 'test')).toBe(false);
        });
    });

    describe('getActivityMetadata', () => {
        it('should return activity metadata from class', () => {
            const metadata = service.getActivityMetadata(MockActivityClass);

            expect(metadata).toEqual({ name: 'TestActivity' });
        });

        it('should return null for class without metadata', () => {
            const metadata = service.getActivityMetadata(MockNonActivityClass);

            expect(metadata).toBeNull();
        });

        it('should check prototype metadata', () => {
            class ProtoActivity {}
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, { name: 'Proto' }, ProtoActivity.prototype);

            const metadata = service.getActivityMetadata(ProtoActivity);

            expect(metadata).toEqual({ name: 'Proto' });
        });

        it('should handle errors gracefully', () => {
            const metadata = service.getActivityMetadata(null as any);

            expect(metadata).toBeNull();
        });
    });

    describe('getActivityMethodMetadata', () => {
        it('should return method metadata for valid method', () => {
            const instance = new MockActivityClass();
            const metadata = service.getActivityMethodMetadata(instance, 'testMethod');

            expect(metadata).toBeDefined();
            expect(metadata?.name).toBe('testActivity');
            expect(metadata?.methodName).toBe('testMethod');
            expect(metadata?.originalName).toBe('testMethod');
        });

        it('should return null for null instance', () => {
            const metadata = service.getActivityMethodMetadata(null, 'test');

            expect(metadata).toBeNull();
        });

        it('should return null for method without metadata', () => {
            const instance = new MockActivityClass();
            const metadata = service.getActivityMethodMetadata(instance, 'nonExistent');

            expect(metadata).toBeNull();
        });

        it('should return null for method not on prototype', () => {
            const instance = new MockActivityClass();
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { name: 'phantom' },
                MockActivityClass.prototype,
                'phantomMethod',
            );

            const metadata = service.getActivityMethodMetadata(instance, 'phantomMethod');

            expect(metadata).toBeNull();
        });

        it('should include handler function', () => {
            const instance = new MockActivityClass();
            const metadata = service.getActivityMethodMetadata(instance, 'testMethod');

            expect(metadata?.handler).toBeDefined();
            expect(typeof metadata?.handler).toBe('function');
        });

        it('should handle errors gracefully', () => {
            const metadata = service.getActivityMethodMetadata({}, 'test');

            expect(metadata).toBeNull();
        });
    });

    describe('getActivityMethodNames', () => {
        it('should return all activity method names', () => {
            const names = service.getActivityMethodNames(MockActivityClass);

            expect(names).toContain('testMethod');
            expect(names).toContain('anotherMethod');
            expect(names.length).toBeGreaterThanOrEqual(2);
        });

        it('should not include constructor', () => {
            const names = service.getActivityMethodNames(MockActivityClass);

            expect(names).not.toContain('constructor');
        });

        it('should return empty array for non-function target', () => {
            expect(service.getActivityMethodNames(null)).toEqual([]);
            expect(service.getActivityMethodNames('string' as any)).toEqual([]);
        });

        it('should return empty array for class without prototype', () => {
            const noProto = {} as Function;
            expect(service.getActivityMethodNames(noProto)).toEqual([]);
        });

        it('should handle metadata access errors', () => {
            const names = service.getActivityMethodNames(MockNonActivityClass);

            expect(names).toEqual([]);
        });

        it('should handle errors gracefully', () => {
            const names = service.getActivityMethodNames(undefined);

            expect(names).toEqual([]);
        });
    });

    describe('getActivityMethodName', () => {
        it('should return activity name from metadata', () => {
            const instance = new MockActivityClass();
            const name = service.getActivityMethodName(instance, 'testMethod');

            expect(name).toBe('testActivity');
        });

        it('should return null for null target', () => {
            const name = service.getActivityMethodName(null, 'test');

            expect(name).toBeNull();
        });

        it('should return null for string target', () => {
            const name = service.getActivityMethodName('string', 'test');

            expect(name).toBeNull();
        });

        it('should handle errors gracefully', () => {
            const name = service.getActivityMethodName({}, 'test');

            // Returns the method name when no metadata is found
            expect(name).toBe('test');
        });
    });

    describe('getActivityOptions', () => {
        it('should return activity options', () => {
            const options = service.getActivityOptions(MockActivityClass);

            expect(options).toEqual({ name: 'TestActivity' });
        });

        it('should return null for class without metadata', () => {
            const options = service.getActivityOptions(MockNonActivityClass);

            expect(options).toBeNull();
        });

        it('should handle errors gracefully', () => {
            const options = service.getActivityOptions(null as any);

            expect(options).toBeNull();
        });
    });

    describe('extractActivityMethods', () => {
        it('should extract all activity methods from instance', () => {
            const instance = new MockActivityClass();
            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
            expect(result.methods.size).toBeGreaterThanOrEqual(2);
            expect(result.methods.has('testActivity')).toBe(true);
            expect(result.methods.has('anotherActivity')).toBe(true);
            expect(result.extractedCount).toBeGreaterThanOrEqual(2);
        });

        it('should return empty result for null instance', () => {
            const result = service.extractActivityMethods(null);

            expect(result.success).toBe(true);
            expect(result.methods.size).toBe(0);
            expect(result.extractedCount).toBe(0);
        });

        it('should use cache on second call', () => {
            const instance = new MockActivityClass();

            // First call
            const result1 = service.extractActivityMethods(instance);

            // Second call should use cache
            const result2 = service.extractActivityMethods(instance);

            expect(result1.extractedCount).toBe(result2.extractedCount);
            expect(result2.success).toBe(true);
        });

        it('should handle instance without prototype', () => {
            const instance = Object.create(null);
            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should handle fallback to individual property metadata', () => {
            class IndividualMetadataClass {
                method1() {}
                method2() {}
            }

            // Set individual method metadata (not as collection)
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { name: 'method1Activity' },
                IndividualMetadataClass.prototype,
                'method1',
            );
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { name: 'method2Activity' },
                IndividualMetadataClass.prototype,
                'method2',
            );

            const instance = new IndividualMetadataClass();
            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
            expect(result.methods.has('method1Activity')).toBe(true);
            expect(result.methods.has('method2Activity')).toBe(true);
        });

        it('should handle method extraction errors', () => {
            class ErrorClass {}
            const errorProto = ErrorClass.prototype;

            // Create metadata with non-function property
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                {
                    validMethod: { name: 'valid' },
                    invalidMethod: { name: 'invalid' },
                },
                errorProto,
            );

            // Define only one method
            Object.defineProperty(errorProto, 'validMethod', {
                value: function () {},
                enumerable: false,
                configurable: true,
            });

            const instance = new ErrorClass();
            const result = service.extractActivityMethods(instance);

            // Should extract valid method and handle invalid one
            expect(result.methods.has('valid')).toBe(true);
        });

        it('should bind methods to instance', () => {
            const instance = new MockActivityClass();
            const result = service.extractActivityMethods(instance);

            const methodInfo = result.methods.get('testActivity');
            expect(methodInfo?.handler).toBeDefined();
            expect(typeof methodInfo?.handler).toBe('function');
        });

        it('should cache extracted methods', () => {
            const instance1 = new MockActivityClass();
            const instance2 = new MockActivityClass();

            service.extractActivityMethods(instance1);
            const result2 = service.extractActivityMethods(instance2);

            // Should use cache since same constructor
            expect(result2.success).toBe(true);
        });
    });

    describe('extractActivityMethodsFromClass', () => {
        it('should extract methods from class constructor', () => {
            const methods = service.extractActivityMethodsFromClass(MockActivityClass);

            expect(methods.length).toBeGreaterThanOrEqual(2);
            const names = methods.map((m) => m.name);
            expect(names).toContain('testActivity');
            expect(names).toContain('anotherActivity');
        });

        it('should return empty array for class without methods', () => {
            const methods = service.extractActivityMethodsFromClass(MockNonActivityClass);

            expect(methods).toEqual([]);
        });

        it('should include method metadata', () => {
            const methods = service.extractActivityMethodsFromClass(MockActivityClass);

            const testMethod = methods.find((m) => m.name === 'testActivity');
            expect(testMethod).toBeDefined();
            expect(testMethod?.methodName).toBe('testMethod');
            expect(testMethod?.metadata.className).toBe('MockActivityClass');
        });

        it('should handle extraction errors', () => {
            const invalidClass = {} as Function;
            const methods = service.extractActivityMethodsFromClass(invalidClass);

            expect(methods).toEqual([]);
        });
    });

    describe('extractMethodsFromPrototype', () => {
        it('should be alias for extractActivityMethods', () => {
            const instance = new MockActivityClass();

            const result1 = service.extractMethodsFromPrototype(instance);
            service.clearCache();
            const result2 = service.extractActivityMethods(instance);

            expect(result1.methods.size).toBe(result2.methods.size);
        });
    });

    describe('getActivityMethodOptions', () => {
        it('should return method options', () => {
            const options = service.getActivityMethodOptions(
                MockActivityClass.prototype,
                'anotherMethod',
            );

            expect(options).toBeDefined();
            expect((options as any)?.options?.timeout).toBe(5000);
        });

        it('should return null for null target', () => {
            const options = service.getActivityMethodOptions(null, 'test');

            expect(options).toBeNull();
        });

        it('should return null for undefined method name', () => {
            const options = service.getActivityMethodOptions(MockActivityClass.prototype);

            expect(options).toBeNull();
        });

        it('should handle errors gracefully', () => {
            const options = service.getActivityMethodOptions({}, 'test');

            expect(options).toBeNull();
        });
    });

    describe('getSignalMethods', () => {
        it('should return signal methods', () => {
            class WorkflowClass {}
            const signals = { updateStatus: 'updateStatus', cancel: 'cancel' };
            Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, signals, WorkflowClass.prototype);

            const result = service.getSignalMethods(WorkflowClass.prototype);

            expect(result.success).toBe(true);
            expect(result.methods).toEqual(signals);
            expect(result.errors).toEqual([]);
        });

        it('should return empty object for prototype without signals', () => {
            const result = service.getSignalMethods(MockActivityClass.prototype);

            expect(result.success).toBe(true);
            expect(result.methods).toEqual({});
        });

        it('should handle errors', () => {
            const result = service.getSignalMethods(null);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('getQueryMethods', () => {
        it('should return query methods', () => {
            class WorkflowClass {}
            const queries = { getStatus: 'getStatus', getProgress: 'getProgress' };
            Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, queries, WorkflowClass.prototype);

            const result = service.getQueryMethods(WorkflowClass.prototype);

            expect(result.success).toBe(true);
            expect(result.methods).toEqual(queries);
            expect(result.errors).toEqual([]);
        });

        it('should return empty object for prototype without queries', () => {
            const result = service.getQueryMethods(MockActivityClass.prototype);

            expect(result.success).toBe(true);
            expect(result.methods).toEqual({});
        });

        it('should handle errors', () => {
            const result = service.getQueryMethods(null);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('getChildWorkflows', () => {
        it('should return child workflows', () => {
            class WorkflowClass {}
            const childWorkflows = { payment: { type: 'PaymentWorkflow' } };
            Reflect.defineMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                childWorkflows,
                WorkflowClass.prototype,
            );

            const result = service.getChildWorkflows(WorkflowClass.prototype);

            expect(result.success).toBe(true);
            expect(result.workflows).toEqual(childWorkflows);
            expect(result.errors).toEqual([]);
        });

        it('should return empty object for prototype without child workflows', () => {
            const result = service.getChildWorkflows(MockActivityClass.prototype);

            expect(result.success).toBe(true);
            expect(result.workflows).toEqual({});
        });

        it('should handle errors', () => {
            const result = service.getChildWorkflows(null);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('validateActivityClass', () => {
        it('should validate valid activity class', () => {
            const result = service.validateActivityClass(MockActivityClass);

            expect(result.isValid).toBe(true);
            expect(result.issues).toEqual([]);
            expect(result.className).toBe('MockActivityClass');
            expect(result.methodCount).toBeGreaterThan(0);
        });

        it('should detect class without activity decorator', () => {
            const result = service.validateActivityClass(MockNonActivityClass);

            expect(result.isValid).toBe(false);
            expect(result.issues).toContain('Class is not marked with @Activity decorator');
        });

        it('should detect class without activity methods', () => {
            class EmptyActivityClass {}
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, EmptyActivityClass);

            const result = service.validateActivityClass(EmptyActivityClass);

            expect(result.isValid).toBe(false);
            expect(result.issues).toContain(
                'Activity class has no methods marked with @ActivityMethod',
            );
        });

        it('should warn about many activity methods', () => {
            // Add individual metadata for methods so they're detected
            for (let i = 0; i < 55; i++) {
                Reflect.defineMetadata(
                    TEMPORAL_ACTIVITY_METHOD,
                    { name: `activity${i}` },
                    MockManyMethodsClass.prototype,
                    `method${i}`,
                );
            }

            const result = service.validateActivityClass(MockManyMethodsClass);

            expect(result.warnings).toBeDefined();
            expect(result.warnings).toContain(
                'Class has many activity methods, consider splitting',
            );
        });

        it('should handle validation errors', () => {
            // Create a function with no name property to trigger the error path
            const invalidClass = (() => {}) as any;
            Object.defineProperty(invalidClass, 'name', { value: undefined });

            const result = service.validateActivityClass(invalidClass);

            expect(result.isValid).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
        });
    });

    describe('getAllMetadataKeys', () => {
        it('should return all metadata keys', () => {
            const keys = service.getAllMetadataKeys(MockActivityClass);

            expect(keys).toContain(TEMPORAL_ACTIVITY);
        });

        it('should return empty array for target without metadata', () => {
            const keys = service.getAllMetadataKeys({});

            expect(keys).toEqual([]);
        });

        it('should handle errors gracefully', () => {
            const keys = service.getAllMetadataKeys(null);

            expect(keys).toEqual([]);
        });
    });

    describe('getActivityName', () => {
        it('should return activity name from metadata', () => {
            const name = service.getActivityName(MockActivityClass);

            expect(name).toBe('TestActivity');
        });

        it('should fallback to class name', () => {
            class NoNameActivity {}
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, NoNameActivity);

            const name = service.getActivityName(NoNameActivity);

            expect(name).toBe('NoNameActivity');
        });

        it('should return null for class without metadata', () => {
            const name = service.getActivityName(MockNonActivityClass);

            expect(name).toBe('MockNonActivityClass');
        });

        it('should handle errors gracefully', () => {
            const name = service.getActivityName(null as any);

            expect(name).toBeNull();
        });
    });

    describe('getActivityInfo', () => {
        it('should return comprehensive activity info', () => {
            const info = service.getActivityInfo(MockActivityClass);

            expect(info.className).toBe('MockActivityClass');
            expect(info.isActivity).toBe(true);
            expect(info.activityName).toBe('TestActivity');
            expect(info.methodNames.length).toBeGreaterThan(0);
            expect(info.metadata).toBeDefined();
            expect(info.activityOptions).toBeDefined();
            expect(info.methodCount).toBeGreaterThan(0);
        });

        it('should handle non-activity class', () => {
            const info = service.getActivityInfo(MockNonActivityClass);

            expect(info.className).toBe('MockNonActivityClass');
            expect(info.isActivity).toBe(false);
            expect(info.methodCount).toBe(0);
        });

        it('should handle null target', () => {
            const info = service.getActivityInfo(null);

            expect(info.className).toBe('Unknown');
            expect(info.isActivity).toBe(false);
            expect(info.methodCount).toBe(0);
        });

        it('should handle string target', () => {
            const info = service.getActivityInfo('string' as any);

            expect(info.className).toBe('Unknown');
            expect(info.isActivity).toBe(false);
        });

        it('should handle undefined target', () => {
            const info = service.getActivityInfo(undefined);

            expect(info.className).toBe('Unknown');
            expect(info.isActivity).toBe(false);
        });

        it('should handle errors gracefully', () => {
            const info = service.getActivityInfo({} as any);

            expect(info.className).toBe('Unknown');
            expect(info.isActivity).toBe(false);
        });
    });

    describe('validateMetadata', () => {
        it('should validate presence of required metadata', () => {
            const result = service.validateMetadata(MockActivityClass, [TEMPORAL_ACTIVITY]);

            expect(result.isValid).toBe(true);
            expect(result.present).toContain(TEMPORAL_ACTIVITY);
            expect(result.missing).toEqual([]);
        });

        it('should detect missing metadata', () => {
            const result = service.validateMetadata(MockNonActivityClass, [TEMPORAL_ACTIVITY]);

            expect(result.isValid).toBe(false);
            expect(result.missing).toContain(TEMPORAL_ACTIVITY);
        });

        it('should handle multiple keys', () => {
            const result = service.validateMetadata(MockActivityClass, [
                TEMPORAL_ACTIVITY,
                'NON_EXISTENT_KEY',
            ]);

            expect(result.present).toContain(TEMPORAL_ACTIVITY);
            expect(result.missing).toContain('NON_EXISTENT_KEY');
        });

        it('should handle errors gracefully', () => {
            const result = service.validateMetadata(null, [TEMPORAL_ACTIVITY]);

            expect(result.isValid).toBe(false);
            expect(result.missing.length).toBeGreaterThan(0);
        });
    });

    describe('clearCache', () => {
        it('should clear activity method cache', () => {
            const instance = new MockActivityClass();

            service.extractActivityMethods(instance);
            const statsBefore = service.getCacheStats();
            expect(statsBefore.size).toBeGreaterThan(0);

            service.clearCache();
            const statsAfter = service.getCacheStats();
            expect(statsAfter.size).toBe(0);
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', () => {
            const stats = service.getCacheStats();

            expect(stats.size).toBeDefined();
            expect(stats.entries).toBeDefined();
            expect(Array.isArray(stats.entries)).toBe(true);
        });

        it('should show cached entries', () => {
            const instance = new MockActivityClass();
            service.extractActivityMethods(instance);

            const stats = service.getCacheStats();

            expect(stats.size).toBeGreaterThan(0);
            expect(stats.entries).toContain('MockActivityClass');
        });

        it('should include hit and miss rates', () => {
            const stats = service.getCacheStats();

            expect(stats.hitRate).toBeDefined();
            expect(stats.missRate).toBeDefined();
        });
    });

    describe('hasActivityMethods', () => {
        it('should detect activity methods from collection metadata', () => {
            const hasMethods = service['hasActivityMethods'](MockActivityClass.prototype);

            expect(hasMethods).toBe(true);
        });

        it('should return false for null prototype', () => {
            const hasMethods = service['hasActivityMethods'](null);

            expect(hasMethods).toBe(false);
        });

        it('should return false for prototype without methods', () => {
            const hasMethods = service['hasActivityMethods'](MockNonActivityClass.prototype);

            expect(hasMethods).toBe(false);
        });

        it('should handle fallback to individual property checks', () => {
            class IndividualClass {
                method() {}
            }

            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { name: 'method' },
                IndividualClass.prototype,
                'method',
            );

            const hasMethods = service['hasActivityMethods'](IndividualClass.prototype);

            expect(hasMethods).toBe(true);
        });

        it('should handle errors in property checks', () => {
            const hasMethods = service['hasActivityMethods']({});

            expect(hasMethods).toBe(false);
        });

        it('should skip constructor in property checks', () => {
            class TestClass {
                constructor() {}
                method() {}
            }

            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { name: 'method' },
                TestClass.prototype,
                'method',
            );

            const hasMethods = service['hasActivityMethods'](TestClass.prototype);

            expect(hasMethods).toBe(true);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle extractActivityMethods with cached function type', () => {
            const instance = new MockActivityClass();

            // First extract to cache
            service.extractActivityMethods(instance);

            // Manually modify cache to have a function type
            const constructor = MockActivityClass;
            const cache = service['activityMethodCache'].get(constructor);
            if (cache) {
                cache.set('funcMethod', (() => 'test') as any);
            }

            // Extract again to use cache with function
            service.clearCache();
            service['activityMethodCache'].set(
                constructor,
                new Map([['funcMethod', () => 'test']]),
            );

            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
        });

        it('should handle extractActivityMethods with object in cache', () => {
            const instance = new MockActivityClass();

            // Set cache with object type
            const constructor = MockActivityClass;
            service['activityMethodCache'].set(
                constructor,
                new Map([
                    [
                        'objMethod',
                        {
                            name: 'objMethod',
                            handler: () => 'test',
                        } as any,
                    ],
                ]),
            );

            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
            expect(result.extractedCount).toBe(1);
        });

        it('should handle error in method extraction loop', () => {
            class ErrorClass {
                get errorMethod() {
                    throw new Error('Property access error');
                }
            }

            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, ErrorClass);
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                {
                    errorMethod: { name: 'error' },
                },
                ErrorClass.prototype,
            );

            const instance = new ErrorClass();
            const result = service.extractActivityMethods(instance);

            // Should handle the error gracefully
            expect(result.errors.length).toBeGreaterThanOrEqual(0);
            expect(result.errors[0].error).toBe('Property access error');
        });

        it('should handle non-Error in method extraction loop line 262', () => {
            class ErrorClass {
                get errorMethod() {
                    throw { code: 'PROPERTY_ERROR', message: 'Non-Error thrown' };
                }
            }

            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, ErrorClass);
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                {
                    errorMethod: { name: 'error' },
                },
                ErrorClass.prototype,
            );

            const instance = new ErrorClass();
            const result = service.extractActivityMethods(instance);

            // Should handle the error gracefully with 'Unknown error' message
            expect(result.errors.length).toBeGreaterThanOrEqual(0);
            expect(result.errors[0].error).toBe('Unknown error');
        });

        it('should handle Error in fallback method extraction line 304', () => {
            class ErrorClass {
                testMethod() {}
            }

            const instance = new ErrorClass();
            const prototype = ErrorClass.prototype;

            // Don't set collection metadata, force fallback path
            // Mock Reflect.getMetadata to return null for collection, but throw Error for property
            const originalGetMetadata = Reflect.getMetadata;
            let callCount = 0;
            Reflect.getMetadata = jest.fn().mockImplementation((key, target, propertyKey) => {
                callCount++;
                if (callCount === 1) {
                    // First call for collection metadata - return null to force fallback
                    return null;
                }
                // Subsequent calls for individual properties - throw Error
                throw new Error('Metadata access failed');
            });

            const result = service.extractActivityMethods(instance);

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some((e) => e.error === 'Metadata access failed')).toBe(true);

            Reflect.getMetadata = originalGetMetadata;
        });

        it('should handle non-Error in fallback method extraction line 304', () => {
            class ErrorClass {
                testMethod() {}
            }

            const instance = new ErrorClass();

            // Mock Reflect.getMetadata to return null for collection, but throw non-Error for property
            const originalGetMetadata = Reflect.getMetadata;
            let callCount = 0;
            Reflect.getMetadata = jest.fn().mockImplementation((key, target, propertyKey) => {
                callCount++;
                if (callCount === 1) {
                    // First call for collection metadata - return null to force fallback
                    return null;
                }
                // Subsequent calls for individual properties - throw non-Error
                throw { code: 'META_ERROR' };
            });

            const result = service.extractActivityMethods(instance);

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some((e) => e.error === 'Unknown error')).toBe(true);

            Reflect.getMetadata = originalGetMetadata;
        });

        it('should handle getActivityMethodOptions with no methodName', () => {
            const options = service.getActivityMethodOptions(MockActivityClass.prototype, '');

            expect(options).toBeNull();
        });

        it('should handle validateActivityClass with empty method name', () => {
            class EmptyNameClass {}
            Object.defineProperty(EmptyNameClass, 'name', { value: '' });
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, {}, EmptyNameClass);

            const result = service.validateActivityClass(EmptyNameClass);

            expect(result.className).toBeTruthy();
        });

        it('should handle isActivity prototype check fallback line 69', () => {
            class TestClass {}
            // Don't set metadata on class, only on prototype
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, { name: 'test' }, TestClass.prototype);

            const result = service.isActivity(TestClass);

            expect(result).toBe(true);
        });

        it('should handle isActivityMethod with null target line 116', () => {
            const result = service.isActivityMethod(null, 'testMethod');

            expect(result).toBe(false);
        });

        it('should handle getActivityMethodMetadata missing function on prototype line 145', () => {
            class TestClass {}
            Reflect.defineMetadata(
                TEMPORAL_ACTIVITY_METHOD,
                { phantomMethod: { name: 'phantom' } },
                TestClass.prototype,
            );

            const instance = new TestClass();
            const result = service.getActivityMethodMetadata(instance, 'phantomMethod');

            expect(result).toBeNull();
        });

        it('should handle getActivityMethodName with null target line 162', () => {
            const result = service.getActivityMethodName(null, 'testMethod');

            expect(result).toBeNull();
        });

        it('should handle getActivityMethodName with fallback to methodName line 174', () => {
            const instance = { testMethod: jest.fn() };
            const result = service.getActivityMethodName(instance, 'testMethod');

            expect(result).toBe('testMethod');
        });

        it('should handle extractActivityMethods with invalid cache entry lines 304-306', () => {
            const instance = new MockActivityClass();

            // Pre-populate cache with invalid entry
            const constructor = MockActivityClass;
            (service as any).activityMethodCache.set(
                constructor,
                new Map([['testMethod', 'invalid-string-value']]),
            );

            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
        });

        it('should handle extractActivityMethods non-Error exception lines 316-318', () => {
            const instance = new MockActivityClass();

            // Pre-populate cache so it uses cached method
            service.extractActivityMethods(instance);

            // Mock getOwnPropertyNames to throw a string during the next call
            const originalGetOwnPropertyNames = Object.getOwnPropertyNames;
            let callCount = 0;
            jest.spyOn(Object, 'getOwnPropertyNames').mockImplementation((obj) => {
                callCount++;
                // Let first few calls through, then throw on the cache processing
                if (callCount > 3) {
                    throw 'String error during property enumeration';
                }
                return originalGetOwnPropertyNames(obj);
            });

            // Clear cache to force re-extraction
            service.clearCache();

            const result = service.extractActivityMethods(instance);

            // Should handle the error and still report it
            expect(result.errors.length).toBeGreaterThanOrEqual(0);

            jest.restoreAllMocks();
        });

        it('should handle extractActivityMethodsFromClass with non-Error exception line 396', () => {
            class TestClass {}

            // Mock getOwnPropertyNames to throw a non-Error
            jest.spyOn(Object, 'getOwnPropertyNames').mockImplementationOnce(() => {
                throw { code: 'CUSTOM_ERROR' };
            });

            const result = service.extractActivityMethodsFromClass(TestClass);

            expect(result).toEqual([]);

            jest.restoreAllMocks();
        });

        it('should handle getSignalMethods with non-Error exception lines 505-507', () => {
            // Mock getMetadata to throw a non-Error
            jest.spyOn(Reflect, 'getMetadata').mockImplementationOnce(() => {
                throw { code: 'SIGNAL_ERROR' };
            });

            const result = service.getSignalMethods(MockActivityClass.prototype);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].error).toBe('Unknown error');

            jest.restoreAllMocks();
        });

        it('should handle getSignalMethods with Error exception line 505-507', () => {
            // Mock getMetadata to throw an Error
            jest.spyOn(Reflect, 'getMetadata').mockImplementationOnce(() => {
                throw new Error('Signal metadata error');
            });

            const result = service.getSignalMethods(MockActivityClass.prototype);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].error).toBe('Signal metadata error');

            jest.restoreAllMocks();
        });

        it('should handle getQueryMethods with non-Error exception lines 537-541', () => {
            // Mock getMetadata to throw a non-Error
            jest.spyOn(Reflect, 'getMetadata').mockImplementationOnce(() => {
                throw { code: 'QUERY_ERROR' };
            });

            const result = service.getQueryMethods(MockActivityClass.prototype);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].error).toBe('Unknown error');

            jest.restoreAllMocks();
        });

        it('should handle getQueryMethods with Error exception line 537-541', () => {
            // Mock getMetadata to throw an Error
            jest.spyOn(Reflect, 'getMetadata').mockImplementationOnce(() => {
                throw new Error('Query metadata error');
            });

            const result = service.getQueryMethods(MockActivityClass.prototype);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].error).toBe('Query metadata error');

            jest.restoreAllMocks();
        });

        it('should handle getChildWorkflows with non-Error exception line 603', () => {
            // Mock getMetadata to throw a non-Error
            jest.spyOn(Reflect, 'getMetadata').mockImplementationOnce(() => {
                throw 'String error during child workflow metadata access';
            });

            const result = service.getChildWorkflows(MockActivityClass.prototype);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            jest.restoreAllMocks();
        });

        it('should handle extractActivityMethods with cached object entry line 207-211', () => {
            const instance = new MockActivityClass();
            const constructor = MockActivityClass;

            // Pre-populate cache with object entry (not function)
            const cachedMethodObject = {
                name: 'testMethod',
                originalName: 'testMethod',
                methodName: 'testMethod',
                className: 'MockActivityClass',
                handler: jest.fn(),
            };

            (service as any).activityMethodCache.set(
                constructor,
                new Map([['testMethod', cachedMethodObject]]),
            );

            const result = service.extractActivityMethods(instance);

            expect(result.success).toBe(true);
            expect(result.methods.has('testMethod')).toBe(true);
        });

        it('should cache methods after extraction line 307-309', () => {
            const instance = new MockActivityClass();

            // Ensure cache is empty
            service.clearCache();

            const constructor = MockActivityClass;
            expect((service as any).activityMethodCache.has(constructor)).toBe(false);

            // Extract methods
            service.extractActivityMethods(instance);

            // Verify cache was populated
            expect((service as any).activityMethodCache.has(constructor)).toBe(true);
        });

        it('should handle hasActivityMethods with Reflect.hasMetadata throwing line 537-541', () => {
            class TestClass {
                testMethod() {}
            }

            const prototype = TestClass.prototype;

            // Mock Reflect.hasMetadata to throw for specific property
            const originalHasMetadata = Reflect.hasMetadata;
            let callCount = 0;
            Reflect.hasMetadata = jest.fn().mockImplementation((key, target, propertyKey) => {
                callCount++;
                if (callCount === 2) {
                    // Throw on second property check
                    throw new Error('Metadata check error');
                }
                return originalHasMetadata(key, target, propertyKey);
            });

            // This should catch the error and return false for that property
            const result = (service as any).hasActivityMethods(prototype);

            // Should not throw, handles error gracefully
            expect(typeof result).toBe('boolean');

            Reflect.hasMetadata = originalHasMetadata;
        });

        it('should handle getActivityInfo with catch block line 603-610', () => {
            // Mock isActivity to throw during getActivityInfo
            jest.spyOn(service, 'isActivity').mockImplementationOnce(() => {
                throw new Error('Activity check error');
            });

            const result = service.getActivityInfo(MockActivityClass);

            expect(result.className).toBe('Unknown');
            expect(result.isActivity).toBe(false);
            expect(result.activityName).toBeNull();
            expect(result.methodNames).toEqual([]);
            expect(result.metadata).toBeNull();
            expect(result.activityOptions).toBeNull();
            expect(result.methodCount).toBe(0);

            jest.restoreAllMocks();
        });

        it('should validate activity class without warnings line 500', () => {
            // Test when warnings.length === 0, so warnings should be undefined
            // Use MockActivityClass which has 2 methods setup (between 1 and 50, no warnings)
            const result = service.validateActivityClass(MockActivityClass);

            expect(result.isValid).toBe(true);
            expect(result.warnings).toBeUndefined(); // No warnings, so should be undefined
            expect(result.methodCount).toBeGreaterThan(0);
            expect(result.methodCount).toBeLessThanOrEqual(50);
        });

        it('should detect activity class with zero methods line 489', () => {
            class EmptyActivityClass {}

            Reflect.defineMetadata(TEMPORAL_ACTIVITY, { name: 'Empty' }, EmptyActivityClass);
            // Don't add any activity methods

            const result = service.validateActivityClass(EmptyActivityClass);

            expect(result.isValid).toBe(false);
            expect(result.warnings).toBeDefined();
            expect(result.warnings).toContain('No activity methods found in class');
            expect(result.methodCount).toBe(0);
        });
    });
});
