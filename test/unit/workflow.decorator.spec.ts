import { SignalMethod, QueryMethod, ChildWorkflow } from '../../src/decorators/workflow.decorator';
import {
    TEMPORAL_SIGNAL_METHOD,
    TEMPORAL_QUERY_METHOD,
    TEMPORAL_CHILD_WORKFLOW,
} from '../../src/constants';
import 'reflect-metadata';

describe('Workflow Decorator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('@SignalMethod', () => {
        it('should mark method with signal metadata', () => {
            class TestWorkflow {
                @SignalMethod('testSignal')
                async handleSignal(): Promise<void> {}
            }

            const proto = TestWorkflow.prototype;
            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, proto);
            expect(signals).toBeDefined();
            expect(signals['testSignal']).toBe('handleSignal');
        });

        it('should use method name as signal name when not provided', () => {
            class TestWorkflow {
                @SignalMethod()
                async handleSignal(): Promise<void> {}
            }

            const proto = TestWorkflow.prototype;
            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, proto);
            expect(signals).toBeDefined();
            expect(signals['handleSignal']).toBe('handleSignal');
        });

        it('should throw error for duplicate signal names', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('duplicate')
                    async signal1(): Promise<void> {}

                    @SignalMethod('duplicate')
                    async signal2(): Promise<void> {}
                }
            }).toThrow('Duplicate signal name "duplicate" found');
        });

        it('should throw error for empty signal name', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('')
                    async handleSignal(): Promise<void> {}
                }
            }).toThrow('Signal name cannot be empty');
        });

        it('should handle error when Reflect.defineMetadata fails', () => {
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Metadata storage failed');
            });

            expect(() => {
                class TestWorkflow {
                    @SignalMethod('testSignal')
                    async handleSignal(): Promise<void> {}
                }
            }).toThrow('Metadata storage failed');

            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should handle validation error from validateSignalName with empty string', () => {
            const originalValidateSignalName =
                require('../../src/utils/validation').validateSignalName;
            require('../../src/utils/validation').validateSignalName = jest
                .fn()
                .mockImplementation((name: string) => {
                    if (name === '') {
                        throw new Error('Signal name cannot be empty');
                    }
                });

            expect(() => {
                class TestWorkflow {
                    @SignalMethod('')
                    async handleSignal(): Promise<void> {}
                }
            }).toThrow('Signal name cannot be empty');

            require('../../src/utils/validation').validateSignalName = originalValidateSignalName;
        });

        it('should throw error for signal name with whitespace', () => {
            expect(() => {
                class TestWorkflow {
                    @SignalMethod('my signal')
                    async handleSignal(): Promise<void> {
                        // Implementation
                    }
                }
            }).toThrow('Invalid signal name: "my signal". Signal names cannot contain whitespace.');
        });

        it('should handle validation error from validateQueryName with empty string', () => {
            const originalValidateQueryName =
                require('../../src/utils/validation').validateQueryName;
            require('../../src/utils/validation').validateQueryName = jest
                .fn()
                .mockImplementation((name: string) => {
                    if (name === '') {
                        throw new Error('Query name cannot be empty');
                    }
                });

            expect(() => {
                class TestWorkflow {
                    @QueryMethod('')
                    getStatus(): string {
                        return 'active';
                    }
                }
            }).toThrow('Query name cannot be empty');

            require('../../src/utils/validation').validateQueryName = originalValidateQueryName;
        });
    });

    describe('@QueryMethod', () => {
        it('should mark method with query metadata', () => {
            class TestWorkflow {
                @QueryMethod('testQuery')
                getStatus(): string {
                    return 'active';
                }
            }

            const proto = TestWorkflow.prototype;
            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, proto);
            expect(queries).toBeDefined();
            expect(queries['testQuery']).toBe('getStatus');
        });

        it('should use method name as query name when not provided', () => {
            class TestWorkflow {
                @QueryMethod()
                getStatus(): string {
                    return 'active';
                }
            }

            const proto = TestWorkflow.prototype;
            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, proto);
            expect(queries).toBeDefined();
            expect(queries['getStatus']).toBe('getStatus');
        });

        it('should throw error for duplicate query names', () => {
            expect(() => {
                class TestWorkflow {
                    @QueryMethod('duplicate')
                    query1(): string {
                        return 'test';
                    }

                    @QueryMethod('duplicate')
                    query2(): string {
                        return 'test';
                    }
                }
            }).toThrow('Duplicate query name "duplicate" found');
        });

        it('should throw error for empty query name', () => {
            expect(() => {
                class TestWorkflow {
                    @QueryMethod('')
                    getStatus(): string {
                        return 'active';
                    }
                }
            }).toThrow('Query name cannot be empty');
        });

        it('should handle error when Reflect.defineMetadata fails', () => {
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Metadata storage failed');
            });

            expect(() => {
                class TestWorkflow {
                    @QueryMethod('testQuery')
                    getStatus(): string {
                        return 'active';
                    }
                }
            }).toThrow('Metadata storage failed');

            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should handle validation error from validateQueryName', () => {
            const originalValidateQueryName =
                require('../../src/utils/validation').validateQueryName;
            require('../../src/utils/validation').validateQueryName = jest
                .fn()
                .mockImplementation(() => {
                    throw new Error('Invalid query name');
                });

            expect(() => {
                class TestWorkflow {
                    @QueryMethod('invalid-query')
                    getStatus(): string {
                        return 'active';
                    }
                }
            }).toThrow('Invalid query name');

            require('../../src/utils/validation').validateQueryName = originalValidateQueryName;
        });
    });

    describe('@ChildWorkflow', () => {
        it('should mark property with child workflow metadata', () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'paymentWorkflow',
            );
            expect(metadata).toBeDefined();
            expect(metadata.workflowType).toBe(PaymentWorkflow);
            expect(metadata.workflowName).toBe('PaymentWorkflow');
            expect(metadata.propertyKey).toBe('paymentWorkflow');
        });

        it('should accept workflow options', () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow, { taskQueue: 'payments' })
                private paymentWorkflow: PaymentWorkflow;
            }

            const instance = new TestWorkflow();
            const metadata = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'paymentWorkflow',
            );
            expect(metadata).toBeDefined();
            expect(metadata.options).toEqual({ taskQueue: 'payments' });
        });

        it('should throw error if workflow type is not provided', () => {
            expect(() => {
                class TestWorkflow {
                    @ChildWorkflow(null as any)
                    private childWorkflow: any;
                }
            }).toThrow('Child workflow type is required');
        });

        it('should throw error if workflow type is not a class constructor', () => {
            expect(() => {
                class TestWorkflow {
                    @ChildWorkflow('not-a-class' as any)
                    private childWorkflow: any;
                }
            }).toThrow('Child workflow type must be a class constructor');
        });

        it('should handle error when Reflect.defineMetadata fails', () => {
            const originalDefineMetadata = Reflect.defineMetadata;
            Reflect.defineMetadata = jest.fn().mockImplementation(() => {
                throw new Error('Metadata storage failed');
            });

            expect(() => {
                class PaymentWorkflow {}

                class TestWorkflow {
                    @ChildWorkflow(PaymentWorkflow)
                    private paymentWorkflow: PaymentWorkflow;
                }
            }).toThrow('Metadata storage failed');

            Reflect.defineMetadata = originalDefineMetadata;
        });

        it('should trigger getter fallback for child workflow proxy', () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;
            }

            const instance = new TestWorkflow();

            // Access the property to trigger the getter
            expect(() => {
                const value = (instance as any).paymentWorkflow;
            }).toThrow('Child workflow PaymentWorkflow not initialized');
        });

        it('should trigger setter error for child workflow proxy', () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;
            }

            const instance = new TestWorkflow();

            // Try to set the property to trigger the setter
            expect(() => {
                (instance as any).paymentWorkflow = 'test';
            }).toThrow('Child workflow proxy is read-only');
        });
    });

    describe('Integration Tests', () => {
        it('should work with multiple decorators on same class', () => {
            class PaymentWorkflow {}

            class TestWorkflow {
                @ChildWorkflow(PaymentWorkflow)
                private paymentWorkflow: PaymentWorkflow;

                @SignalMethod('updateStatus')
                async updateStatus(status: string): Promise<void> {}

                @QueryMethod('getStatus')
                getStatus(): string {
                    return 'active';
                }
            }

            const instance = new TestWorkflow();
            const proto = TestWorkflow.prototype;

            // Check child workflow
            const childMeta = Reflect.getMetadata(
                TEMPORAL_CHILD_WORKFLOW,
                instance,
                'paymentWorkflow',
            );
            expect(childMeta).toBeDefined();

            // Check signal
            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, proto);
            expect(signals['updateStatus']).toBe('updateStatus');

            // Check query
            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, proto);
            expect(queries['getStatus']).toBe('getStatus');
        });

        it('should handle multiple signals and queries on same class', () => {
            class TestWorkflow {
                @SignalMethod('signal1')
                async signal1(): Promise<void> {}

                @SignalMethod('signal2')
                async signal2(): Promise<void> {}

                @QueryMethod('query1')
                query1(): string {
                    return 'test1';
                }

                @QueryMethod('query2')
                query2(): string {
                    return 'test2';
                }
            }

            const proto = TestWorkflow.prototype;
            const signals = Reflect.getMetadata(TEMPORAL_SIGNAL_METHOD, proto);
            const queries = Reflect.getMetadata(TEMPORAL_QUERY_METHOD, proto);

            expect(signals).toBeDefined();
            expect(signals['signal1']).toBe('signal1');
            expect(signals['signal2']).toBe('signal2');

            expect(queries).toBeDefined();
            expect(queries['query1']).toBe('query1');
            expect(queries['query2']).toBe('query2');
        });

        it('should throw error when @SignalMethod descriptor is invalid', () => {
            const mockDescriptor: PropertyDescriptor = { value: 'not a function' as unknown };
            expect(() => {
                SignalMethod()({} as object, 'testMethod', mockDescriptor);
            }).toThrow('@SignalMethod can only be applied to methods');
        });

        it('should throw error when @QueryMethod descriptor is invalid', () => {
            const mockDescriptor: PropertyDescriptor = { value: 'not a function' as unknown };
            expect(() => {
                QueryMethod()({} as object, 'testMethod', mockDescriptor);
            }).toThrow('@QueryMethod can only be applied to methods');
        });
    });
});
