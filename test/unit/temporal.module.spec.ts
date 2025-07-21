import { Test, TestingModule } from '@nestjs/testing';
import { TemporalModule } from '../../src/temporal.module';
import { TemporalService } from '../../src/services/temporal.service';
import {
    TemporalOptions,
    TemporalAsyncOptions,
    TemporalOptionsFactory,
} from '../../src/interfaces';

describe('TemporalModule', () => {
    describe('register', () => {
        it('should register module with basic options', async () => {
            const options: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'default',
                },
                taskQueue: 'test-queue',
                allowConnectionFailure: true,
            };

            const module = await Test.createTestingModule({
                imports: [TemporalModule.register(options)],
            }).compile();

            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });

        it('should register module with worker configuration', async () => {
            const options: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'default',
                },
                taskQueue: 'test-queue',
                worker: {
                    workflowsPath: './dist/workflows',
                    activityClasses: [],
                },
                allowConnectionFailure: true,
            };

            const module = await Test.createTestingModule({
                imports: [TemporalModule.register(options)],
            }).compile();

            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });

        it('should throw error for missing connection', () => {
            const options = {
                taskQueue: 'test-queue',
            } as TemporalOptions;

            expect(() => TemporalModule.register(options)).toThrow(
                'Connection configuration is required',
            );
        });

        it('should throw error for missing connection address', () => {
            const options: TemporalOptions = {
                connection: {
                    namespace: 'default',
                } as any,
                taskQueue: 'test-queue',
            };

            expect(() => TemporalModule.register(options)).toThrow(
                'Connection address is required',
            );
        });

        it('should throw error for conflicting worker configuration', () => {
            const options: TemporalOptions = {
                connection: {
                    address: 'localhost:7233',
                    namespace: 'default',
                },
                taskQueue: 'test-queue',
                worker: {
                    workflowsPath: './dist/workflows',
                    workflowBundle: {},
                },
            };

            expect(() => TemporalModule.register(options)).toThrow(
                'Worker cannot have both workflowsPath and workflowBundle',
            );
        });
    });

    describe('registerAsync', () => {
        it('should register module with useFactory', async () => {
            const asyncOptions: TemporalAsyncOptions = {
                useFactory: () =>
                    Promise.resolve({
                        connection: {
                            address: 'localhost:7233',
                            namespace: 'default',
                        },
                        taskQueue: 'test-queue',
                        allowConnectionFailure: true,
                    }),
            };

            const module = await Test.createTestingModule({
                imports: [TemporalModule.registerAsync(asyncOptions)],
            }).compile();

            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });

        it('should register module with useClass', async () => {
            class TestOptionsFactory implements TemporalOptionsFactory {
                createTemporalOptions(): Promise<TemporalOptions> {
                    return Promise.resolve({
                        connection: {
                            address: 'localhost:7233',
                            namespace: 'default',
                        },
                        taskQueue: 'test-queue',
                        allowConnectionFailure: true,
                    });
                }
            }

            const asyncOptions: TemporalAsyncOptions = {
                useClass: TestOptionsFactory,
            };

            const module = await Test.createTestingModule({
                imports: [TemporalModule.registerAsync(asyncOptions)],
            }).compile();

            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });

        it('should throw error for missing configuration method', () => {
            const asyncOptions = {} as TemporalAsyncOptions;

            expect(() => TemporalModule.registerAsync(asyncOptions)).toThrow(
                'Must provide useFactory, useClass, or useExisting',
            );
        });

        it('should throw error for multiple configuration methods', () => {
            const asyncOptions: TemporalAsyncOptions = {
                useFactory: () => Promise.resolve({} as TemporalOptions),
                useClass: class {
                    createTemporalOptions(): TemporalOptions {
                        return {} as TemporalOptions;
                    }
                },
            };

            expect(() => TemporalModule.registerAsync(asyncOptions)).toThrow(
                'Cannot provide multiple configuration methods',
            );
        });

        it('should configure useExisting option', () => {
            class TestOptionsFactory implements TemporalOptionsFactory {
                createTemporalOptions(): Promise<TemporalOptions> {
                    return Promise.resolve({
                        connection: {
                            address: 'localhost:7233',
                            namespace: 'default',
                        },
                        taskQueue: 'test-queue',
                        allowConnectionFailure: true,
                    });
                }
            }

            const asyncOptions: TemporalAsyncOptions = {
                useExisting: TestOptionsFactory,
            };

            const moduleConfig = TemporalModule.registerAsync(asyncOptions);
            expect(moduleConfig.providers).toBeDefined();
            expect(moduleConfig.providers!.length).toBeGreaterThan(0);
        });

        it('should throw error for null options', () => {
            expect(() => TemporalModule.register(null as any)).toThrow(
                'Temporal options are required',
            );
        });

        it('should throw error for useExisting in createOptionsFromFactory', async () => {
            class TestOptionsFactory implements TemporalOptionsFactory {
                createTemporalOptions(): Promise<TemporalOptions> {
                    return Promise.resolve({
                        connection: {
                            address: 'localhost:7233',
                            namespace: 'default',
                        },
                        taskQueue: 'test-queue',
                        allowConnectionFailure: true,
                    });
                }
            }

            const asyncOptions: TemporalAsyncOptions = {
                useExisting: TestOptionsFactory,
            };

            await expect(
                (TemporalModule as any).createOptionsFromFactory(asyncOptions, []),
            ).rejects.toThrow('useExisting should be handled by dependency injection');
        });

        it('should throw error for invalid async options', async () => {
            const asyncOptions = {} as TemporalAsyncOptions;

            await expect(
                (TemporalModule as any).createOptionsFromFactory(asyncOptions, []),
            ).rejects.toThrow('Invalid Temporal module options');
        });
    });

    describe('Module Validation Edge Cases', () => {
        it('should throw error when options are null', () => {
            expect(() => TemporalModule.register(null as any)).toThrow(
                'Temporal options are required',
            );
        });

        it('should throw error when options are undefined', () => {
            expect(() => TemporalModule.register(undefined as any)).toThrow(
                'Temporal options are required',
            );
        });

        it('should throw error when connection is missing', () => {
            const invalidOptions = { taskQueue: 'test' };
            expect(() => TemporalModule.register(invalidOptions as any)).toThrow(
                'Connection configuration is required',
            );
        });

        it('should throw error when connection address is empty', () => {
            const invalidOptions = {
                connection: { address: '' },
                taskQueue: 'test',
            };
            expect(() => TemporalModule.register(invalidOptions as any)).toThrow(
                'Connection address is required',
            );
        });

        it('should throw error when connection address is whitespace', () => {
            const invalidOptions = {
                connection: { address: '   ' },
                taskQueue: 'test',
            };
            expect(() => TemporalModule.register(invalidOptions as any)).toThrow(
                'Connection address is required',
            );
        });

        it('should throw error when worker has both workflowsPath and workflowBundle', () => {
            const invalidOptions = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
                worker: {
                    workflowsPath: '/path/to/workflows',
                    workflowBundle: 'test-bundle',
                },
            };
            expect(() => TemporalModule.register(invalidOptions as any)).toThrow(
                'Worker cannot have both workflowsPath and workflowBundle',
            );
        });
    });

    describe('Async Module Validation Edge Cases', () => {
        it('should throw error when no configuration method provided', () => {
            const invalidOptions = {};
            expect(() => TemporalModule.registerAsync(invalidOptions as any)).toThrow(
                'Invalid Temporal module options: Must provide useFactory, useClass, or useExisting',
            );
        });

        it('should throw error when multiple configuration methods provided', () => {
            const invalidOptions = {
                useFactory: () => ({}),
                useClass: class TestFactory {},
                useExisting: 'TEST_TOKEN',
            };
            expect(() => TemporalModule.registerAsync(invalidOptions as any)).toThrow(
                'Invalid Temporal module options: Cannot provide multiple configuration methods',
            );
        });

        it('should handle useClass configuration', () => {
            class TestFactory {
                createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useClass: TestFactory,
            };

            const module = TemporalModule.registerAsync(options);
            expect(module).toBeDefined();
            expect(module.providers).toHaveLength(12); // All providers should be included
        });

        it('should handle useExisting configuration', () => {
            class TestFactory {
                createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useExisting: TestFactory,
            };

            const module = TemporalModule.registerAsync(options);
            expect(module).toBeDefined();
            expect(module.providers).toHaveLength(11); // All providers should be included
        });

        it('should execute factory method with useExisting', async () => {
            class TestFactory implements TemporalOptionsFactory {
                createTemporalOptions(): Promise<TemporalOptions> {
                    return Promise.resolve({
                        connection: { address: 'localhost:7233', namespace: 'default' },
                        taskQueue: 'test',
                        allowConnectionFailure: true,
                    });
                }
            }

            const options = {
                useExisting: TestFactory,
                imports: [
                    {
                        module: class TestModule {},
                        providers: [TestFactory],
                        exports: [TestFactory],
                        global: true,
                    }
                ],
            };

            const moduleTestBuilder = await Test.createTestingModule({
                imports: [TemporalModule.registerAsync(options)],
            });
            
            const module = await moduleTestBuilder.compile();
            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });

        it('should register async module with useExisting token', async () => {
            class TestFactory implements TemporalOptionsFactory {
                createTemporalOptions(): Promise<TemporalOptions> {
                    return Promise.resolve({
                        connection: { address: 'localhost:7233', namespace: 'default' },
                        taskQueue: 'test',
                        allowConnectionFailure: true,
                    });
                }
            }

            const TestFactoryToken = Symbol('TestFactory');
            
            const options = {
                useExisting: TestFactoryToken as any,
                imports: [
                    {
                        module: class TestModule {},
                        providers: [
                            {
                                provide: TestFactoryToken,
                                useClass: TestFactory,
                            }
                        ],
                        exports: [TestFactoryToken],
                        global: true,
                    }
                ],
            };

            const moduleTestBuilder = await Test.createTestingModule({
                imports: [TemporalModule.registerAsync(options)],
            });
            
            const module = await moduleTestBuilder.compile();
            const temporalService = module.get<TemporalService>(TemporalService);
            expect(temporalService).toBeDefined();
        });
    });

    describe('Async Options Factory Edge Cases', () => {
        it('should handle useFactory configuration', async () => {
            const factory = jest.fn().mockResolvedValue({
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
            });

            const options = {
                useFactory: factory,
                inject: [],
            };

            const result = await TemporalModule['createOptionsFromFactory'](options, []);
            expect(result).toEqual({
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
            });
        });

        it('should handle useClass configuration', async () => {
            class TestFactory {
                async createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useClass: TestFactory,
            };

            const result = await TemporalModule['createOptionsFromFactory'](options, []);
            expect(result).toEqual({
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
            });
        });

        it('should throw error for useExisting configuration', async () => {
            class TestFactory {
                createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useExisting: TestFactory,
            };

            await expect(TemporalModule['createOptionsFromFactory'](options, [])).rejects.toThrow(
                'useExisting should be handled by dependency injection',
            );
        });

        it('should throw error for invalid configuration', async () => {
            const options = {};

            await expect(TemporalModule['createOptionsFromFactory'](options, [])).rejects.toThrow(
                'Invalid Temporal module options',
            );
        });
    });

    describe('Module Configuration Edge Cases', () => {
        it('should handle global module configuration', () => {
            const options = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
                isGlobal: true,
            };

            const module = TemporalModule.register(options);
            expect(module.global).toBe(true);
        });

        it('should handle non-global module configuration', () => {
            const options = {
                connection: { address: 'localhost:7233' },
                taskQueue: 'test',
                isGlobal: false,
            };

            const module = TemporalModule.register(options);
            expect(module.global).toBe(false);
        });

        it('should handle async module with imports', () => {
            class TestFactory {
                createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useClass: TestFactory,
                imports: [class TestModule {}],
            };

            const module = TemporalModule.registerAsync(options);
            expect(module.imports).toHaveLength(2); // DiscoveryModule + TestModule
        });

        it('should handle async module without imports', () => {
            class TestFactory {
                createTemporalOptions() {
                    return {
                        connection: { address: 'localhost:7233' },
                        taskQueue: 'test',
                    };
                }
            }

            const options = {
                useClass: TestFactory,
            };

            const module = TemporalModule.registerAsync(options);
            expect(module.imports).toHaveLength(1); // Only DiscoveryModule
        });
    });
});
