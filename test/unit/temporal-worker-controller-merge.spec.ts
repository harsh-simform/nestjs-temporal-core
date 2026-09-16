import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions, TemporalWorkerControllerOptions } from '../../src/interfaces';

/**
 * Covers Feature 1 of docs/worker-controller-plan.md: merging explicit
 * `TemporalOptions.workers` entries with `@TemporalWorkerController`-derived
 * definitions discovered by `TemporalDiscoveryService`.
 */
describe('TemporalWorkerManagerService - @TemporalWorkerController merge', () => {
    let mockDiscoveryService: any;
    let mockConnection: any;
    let mockWorkerInstance: any;

    const createService = async (
        moduleOptions: TemporalOptions,
    ): Promise<TemporalWorkerManagerService> => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                { provide: TemporalDiscoveryService, useValue: mockDiscoveryService },
                { provide: TEMPORAL_MODULE_OPTIONS, useValue: moduleOptions },
                { provide: TEMPORAL_CONNECTION, useValue: mockConnection },
            ],
        }).compile();

        return module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
    };

    beforeEach(() => {
        mockConnection = { close: jest.fn().mockResolvedValue(undefined) };
        mockWorkerInstance = {
            worker: { run: jest.fn(), shutdown: jest.fn(), getState: jest.fn() },
            taskQueue: '',
            namespace: 'default',
            isRunning: false,
            isInitialized: true,
            lastError: null,
            startedAt: null,
            restartCount: 0,
            activities: new Map(),
            workflowSource: 'filesystem',
        };
        mockDiscoveryService = {
            getAllActivities: jest.fn().mockReturnValue({}),
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true }),
            getDiscoveredWorkerControllers: jest.fn().mockReturnValue(new Map()),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('creates a worker from a discovered controller when no explicit workers are configured', async () => {
        const controllerOptions: TemporalWorkerControllerOptions = {
            taskQueue: 'orders',
            workflowsPath: './dist/workflows/orders',
        };
        mockDiscoveryService.getDiscoveredWorkerControllers.mockReturnValue(
            new Map([['orders', controllerOptions]]),
        );

        const service = await createService({ connection: { address: 'localhost:7233' } });

        const createSpy = jest
            .spyOn(service as any, 'createWorkerFromDefinition')
            .mockResolvedValue({ ...mockWorkerInstance, taskQueue: 'orders' });

        await service.onModuleInit();

        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ taskQueue: 'orders', workflowsPath: './dist/workflows/orders' }),
        );
    });

    it('creates workers for both an explicit definition and a differently-queued controller', async () => {
        const controllerOptions: TemporalWorkerControllerOptions = {
            taskQueue: 'notifications',
            workflowsPath: './dist/workflows/notifications',
        };
        mockDiscoveryService.getDiscoveredWorkerControllers.mockReturnValue(
            new Map([['notifications', controllerOptions]]),
        );

        const service = await createService({
            connection: { address: 'localhost:7233' },
            workers: [{ taskQueue: 'orders', workflowsPath: './dist/workflows/orders' }],
        });

        const createSpy = jest
            .spyOn(service as any, 'createWorkerFromDefinition')
            .mockImplementation((def: any) =>
                Promise.resolve({ ...mockWorkerInstance, taskQueue: def.taskQueue }),
            );

        await service.onModuleInit();

        expect(createSpy).toHaveBeenCalledTimes(2);
        const taskQueues = createSpy.mock.calls.map(([def]: any) => def.taskQueue).sort();
        expect(taskQueues).toEqual(['notifications', 'orders']);
    });

    it('lets an explicit worker definition win over a same-taskQueue controller, with a warning', async () => {
        const controllerOptions: TemporalWorkerControllerOptions = {
            taskQueue: 'orders',
            workflowsPath: './dist/workflows/orders-controller',
        };
        mockDiscoveryService.getDiscoveredWorkerControllers.mockReturnValue(
            new Map([['orders', controllerOptions]]),
        );

        const service = await createService({
            connection: { address: 'localhost:7233' },
            workers: [{ taskQueue: 'orders', workflowsPath: './dist/workflows/orders-explicit' }],
        });

        const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
        const createSpy = jest
            .spyOn(service as any, 'createWorkerFromDefinition')
            .mockResolvedValue({ ...mockWorkerInstance, taskQueue: 'orders' });

        await service.onModuleInit();

        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ workflowsPath: './dist/workflows/orders-explicit' }),
        );
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("task queue 'orders'"));
    });

    it('starts a controller-derived worker on bootstrap using its own autoStart setting', async () => {
        const controllerOptions: TemporalWorkerControllerOptions = {
            taskQueue: 'orders',
            workflowsPath: './dist/workflows/orders',
            autoStart: false,
        };
        mockDiscoveryService.getDiscoveredWorkerControllers.mockReturnValue(
            new Map([['orders', controllerOptions]]),
        );

        const service = await createService({ connection: { address: 'localhost:7233' } });

        jest.spyOn(service as any, 'createWorkerFromDefinition').mockImplementation(
            async (def: any) => {
                const instance = { ...mockWorkerInstance, taskQueue: def.taskQueue };
                (service as any).workers.set(def.taskQueue, instance);
                (service as any).workerDefinitions.set(def.taskQueue, def);
                return instance;
            },
        );

        await service.onModuleInit();

        const startSpy = jest.spyOn(service, 'startWorkerByTaskQueue').mockResolvedValue();

        await service.onApplicationBootstrap();

        expect(startSpy).not.toHaveBeenCalled();
    });
});
