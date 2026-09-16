import { TemporalWorkerController } from '../../src/decorators/worker-controller.decorator';
import { TEMPORAL_WORKER_CONTROLLER } from '../../src/constants';
import 'reflect-metadata';

describe('TemporalWorkerController Decorator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should write metadata on both the constructor and the prototype', () => {
        @TemporalWorkerController({ taskQueue: 'orders' })
        class OrdersWorker {}

        const onClass = Reflect.getMetadata(TEMPORAL_WORKER_CONTROLLER, OrdersWorker);
        const onPrototype = Reflect.getMetadata(
            TEMPORAL_WORKER_CONTROLLER,
            OrdersWorker.prototype,
        );

        expect(onClass).toBeDefined();
        expect(onPrototype).toBeDefined();
        expect(onClass).toEqual(onPrototype);
    });

    it('should store the options and className', () => {
        @TemporalWorkerController({
            taskQueue: 'payments',
            workflowsPath: './dist/workflows/payments',
        })
        class PaymentsWorker {}

        const metadata = Reflect.getMetadata(TEMPORAL_WORKER_CONTROLLER, PaymentsWorker);
        expect(metadata.className).toBe('PaymentsWorker');
        expect(metadata.options).toEqual({
            taskQueue: 'payments',
            workflowsPath: './dist/workflows/payments',
        });
    });

    it('should return the same target class', () => {
        class OriginalWorker {}
        const Decorated = TemporalWorkerController({ taskQueue: 'notifications' })(
            OriginalWorker,
        );

        expect(Decorated).toBe(OriginalWorker);
    });

    it('should throw when taskQueue is missing', () => {
        expect(() => {
            // @ts-expect-error - intentionally omitting the required field
            @TemporalWorkerController({})
            class NoQueueWorker {}
        }).toThrow(/requires a non-empty taskQueue/);
    });

    it('should throw when taskQueue is an empty string', () => {
        expect(() => {
            @TemporalWorkerController({ taskQueue: '' })
            class EmptyQueueWorker {}
        }).toThrow(/requires a non-empty taskQueue/);
    });

    it('should throw when taskQueue is whitespace only', () => {
        expect(() => {
            @TemporalWorkerController({ taskQueue: '   ' })
            class WhitespaceQueueWorker {}
        }).toThrow(/requires a non-empty taskQueue/);
    });

    it('should propagate errors from Reflect.defineMetadata on the constructor', () => {
        const originalDefineMetadata = Reflect.defineMetadata;
        Reflect.defineMetadata = jest.fn().mockImplementation(() => {
            throw new Error('Metadata storage failed');
        });

        expect(() => {
            @TemporalWorkerController({ taskQueue: 'orders' })
            class FailingWorker {}
        }).toThrow('Metadata storage failed');

        Reflect.defineMetadata = originalDefineMetadata;
    });

    it('should propagate errors from Reflect.defineMetadata on the prototype', () => {
        let callCount = 0;
        const originalDefineMetadata = Reflect.defineMetadata;
        Reflect.defineMetadata = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
                throw new Error('Prototype metadata storage failed');
            }
        });

        expect(() => {
            @TemporalWorkerController({ taskQueue: 'orders' })
            class FailingWorker {}
        }).toThrow('Prototype metadata storage failed');

        Reflect.defineMetadata = originalDefineMetadata;
    });
});
