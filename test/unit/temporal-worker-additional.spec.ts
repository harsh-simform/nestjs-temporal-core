import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { Worker, NativeConnection } from '@temporalio/worker';

jest.mock('@temporalio/worker', () => ({
    Worker: {
        create: jest.fn(),
    },
    NativeConnection: {
        connect: jest.fn(),
    },
}));

/**
 * Additional tests specifically targeting uncovered branches in temporal-worker.service.ts
 * Lines to cover: 550-552, 600
 */
describe('TemporalWorkerManagerService - Additional Branch Coverage', () => {
    let service: TemporalWorkerManagerService;
    let mockDiscoveryService: jest.Mocked<Partial<TemporalDiscoveryService>>;
    let mockConnection: jest.Mocked<Partial<NativeConnection>>;
    let mockWorker: jest.Mocked<Partial<Worker>>;

    const mockOptions: TemporalOptions = {
        taskQueue: 'test-queue',
        connection: {
            namespace: 'test-namespace',
            address: 'localhost:7233',
        },
        worker: {
            workflowsPath: './dist/workflows',
            activityClasses: [],
        },
        enableLogger: false,
        logLevel: 'error',
    };

    beforeEach(async () => {
        mockWorker = {
            run: jest.fn().mockImplementation(() => new Promise(() => {})),
            shutdown: jest.fn().mockResolvedValue(undefined),
        };

        mockConnection = {
            close: jest.fn().mockResolvedValue(undefined),
        };

        mockDiscoveryService = {
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true, status: 'healthy' }),
            getAllActivities: jest.fn().mockReturnValue({}),
            getActivityNames: jest.fn().mockReturnValue([]),
        };

        (Worker.create as jest.Mock).mockResolvedValue(mockWorker);
        (NativeConnection.connect as jest.Mock).mockResolvedValue(mockConnection);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
                {
                    provide: TEMPORAL_CONNECTION,
                    useValue: null,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
            ],
        }).compile();

        service = module.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('Lines 600: initializeWorker without worker config', () => {
        it('should return error result when worker config is missing', async () => {
            const noWorkerOptions: TemporalOptions = {
                taskQueue: 'test-queue',
                connection: {
                    namespace: 'test-namespace',
                    address: 'localhost:7233',
                },
                // No worker config
                enableLogger: false,
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noWorkerOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const serviceWithoutWorker = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            const result = await serviceWithoutWorker['initializeWorker']();

            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Worker configuration is required');
            expect(result.activitiesCount).toBe(0);
        });
    });

    describe('Additional coverage for shouldInitializeWorker', () => {
        it('should return false when no worker config', () => {
            const noWorkerOptions: TemporalOptions = {
                taskQueue: 'test-queue',
                connection: {
                    namespace: 'test-namespace',
                    address: 'localhost:7233',
                },
                enableLogger: false,
            };

            const module = Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: noWorkerOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            })
                .compile()
                .then((m) => {
                    const s = m.get<TemporalWorkerManagerService>(TemporalWorkerManagerService);
                    expect(s['shouldInitializeWorker']()).toBe(false);
                });
        });

        it('should return true when workflowsPath is provided', async () => {
            await service.onModuleInit();
            expect(service['shouldInitializeWorker']()).toBe(true);
        });

        it('should return true when workflowBundle is provided', async () => {
            const bundleOptions: TemporalOptions = {
                ...mockOptions,
                worker: {
                    workflowBundle: { code: 'test', sourceMap: 'map' },
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: bundleOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const bundleService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            expect(bundleService['shouldInitializeWorker']()).toBe(true);
        });

        it('should return true when activityClasses is provided', async () => {
            class TestActivity {
                async test() {}
            }

            const activityOptions: TemporalOptions = {
                ...mockOptions,
                worker: {
                    activityClasses: [TestActivity],
                },
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    TemporalWorkerManagerService,
                    {
                        provide: TEMPORAL_MODULE_OPTIONS,
                        useValue: activityOptions,
                    },
                    {
                        provide: TEMPORAL_CONNECTION,
                        useValue: null,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: mockDiscoveryService,
                    },
                ],
            }).compile();

            const activityService = module.get<TemporalWorkerManagerService>(
                TemporalWorkerManagerService,
            );

            expect(activityService['shouldInitializeWorker']()).toBe(true);
        });
    });

});
