import { Test, TestingModule } from '@nestjs/testing';
import { TemporalHealthController } from '../../src/health/temporal-health.controller';
import { TemporalService } from '../../src/services/temporal.service';
import { OverallHealthStatus } from '../../src/interfaces';

describe('TemporalHealthController', () => {
    let controller: TemporalHealthController;
    let temporalService: jest.Mocked<TemporalService>;

    const mockOverallHealth: OverallHealthStatus = {
        status: 'healthy',
        timestamp: new Date(),
        isInitialized: true,
        namespace: 'default',
        summary: {
            totalActivities: 5,
            totalSchedules: 3,
            workerRunning: true,
            clientConnected: true,
        },
        components: {
            client: { status: 'healthy', isInitialized: true },
            worker: { status: 'healthy', isInitialized: true },
            discovery: { status: 'healthy', isInitialized: true },
            schedule: { status: 'healthy', isInitialized: true },
            activity: { status: 'healthy', isInitialized: true },
        },
    };

    const mockStats = {
        client: {
            isConnected: true,
            isHealthy: true,
            namespace: 'default',
        },
        worker: {
            isRunning: true,
            isHealthy: true,
            activitiesCount: 5,
        },
        discovery: {
            discoveredCount: 10,
            isComplete: true,
            errors: 0,
        },
        schedules: {
            total: 3,
            active: 2,
            paused: 1,
        },
        activities: {
            classes: 4,
            methods: 12,
            total: 16,
            registered: 8,
            available: 8,
        },
    };

    const mockWorkerStatus = {
        isInitialized: true,
        isRunning: true,
        isHealthy: true,
        taskQueue: 'default',
        namespace: 'default',
        workflowSource: 'bundle' as const,
        activitiesCount: 5,
    };

    beforeEach(async () => {
        const mockTemporalService = {
            getOverallHealth: jest.fn(),
            getStats: jest.fn(),
            getWorkerStatus: jest.fn(),
            hasWorker: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TemporalHealthController],
            providers: [
                {
                    provide: TemporalService,
                    useValue: mockTemporalService,
                },
            ],
        }).compile();

        controller = module.get<TemporalHealthController>(TemporalHealthController);
        temporalService = module.get(TemporalService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should create instance with constructor', () => {
        const instance = new TemporalHealthController(temporalService);
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TemporalHealthController);
    });

    describe('getHealth', () => {
        it('should return comprehensive health status', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getHealth();

            expect(result.status).toBe('healthy');
            expect(result.timestamp).toBeDefined();
            expect(result.uptime).toBeGreaterThanOrEqual(0);
            expect(result.client.available).toBe(true);
            expect(result.client.healthy).toBe(true);
            expect(result.worker.available).toBe(true);
            expect(result.worker.running).toBe(true);
            expect(result.worker.healthy).toBe(true);
            expect(result.worker.activitiesCount).toBe(5);
            expect(result.discovery.activities).toBe(10);
            expect(result.discovery.complete).toBe(true);
            expect(result.schedules.total).toBe(3);
            expect(result.schedules.active).toBe(2);
            expect(result.schedules.paused).toBe(1);
            expect(result.metadata.classes).toBe(4);
            expect(result.metadata.methods).toBe(12);
            expect(result.metadata.total).toBe(16);
            expect(result.summary.totalComponents).toBe(5);
            expect(result.summary.healthyComponents).toBe(5);
            expect(result.summary.degradedComponents).toBe(0);
            expect(result.summary.unhealthyComponents).toBe(0);
        });

        it('should handle degraded status', async () => {
            const degradedHealth: OverallHealthStatus = {
                status: 'degraded',
                timestamp: new Date(),
                isInitialized: true,
                namespace: 'default',
                summary: {
                    totalActivities: 5,
                    totalSchedules: 3,
                    workerRunning: true,
                    clientConnected: true,
                },
                components: {
                    client: { status: 'healthy', isInitialized: true },
                    worker: { status: 'degraded', isInitialized: true },
                    discovery: { status: 'healthy', isInitialized: true },
                    schedule: { status: 'healthy', isInitialized: true },
                    activity: { status: 'healthy', isInitialized: true },
                },
            };

            temporalService.getOverallHealth.mockResolvedValue(degradedHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getHealth();

            expect(result.status).toBe('degraded');
            expect(result.summary.healthyComponents).toBe(4);
            expect(result.summary.degradedComponents).toBe(1);
            expect(result.summary.unhealthyComponents).toBe(0);
        });

        it('should handle unhealthy status', async () => {
            const unhealthyHealth: OverallHealthStatus = {
                status: 'unhealthy',
                timestamp: new Date(),
                isInitialized: true,
                namespace: 'default',
                summary: {
                    totalActivities: 5,
                    totalSchedules: 3,
                    workerRunning: false,
                    clientConnected: false,
                },
                components: {
                    client: { status: 'unhealthy', isInitialized: false },
                    worker: { status: 'unhealthy', isInitialized: false },
                    discovery: { status: 'healthy', isInitialized: true },
                    schedule: { status: 'healthy', isInitialized: true },
                    activity: { status: 'healthy', isInitialized: true },
                },
            };

            temporalService.getOverallHealth.mockResolvedValue(unhealthyHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(null);
            temporalService.hasWorker.mockReturnValue(false);

            const result = await controller.getHealth();

            expect(result.status).toBe('unhealthy');
            expect(result.worker.available).toBe(false);
            expect(result.worker.running).toBe(false);
            expect(result.worker.healthy).toBe(false);
            expect(result.summary.unhealthyComponents).toBe(2);
        });

        it('should handle case when worker is not available', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(null);
            temporalService.hasWorker.mockReturnValue(false);

            const result = await controller.getHealth();

            expect(result.worker.available).toBe(false);
            expect(result.worker.running).toBe(false);
            expect(result.worker.healthy).toBe(false);
        });

        it('should handle worker status with false values', async () => {
            const workerStatusWithFalseValues = {
                isInitialized: true,
                isRunning: false,
                isHealthy: false,
                taskQueue: 'default',
                namespace: 'default',
                workflowSource: 'none' as const,
                activitiesCount: 0,
            };

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(workerStatusWithFalseValues);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getHealth();

            expect(result.worker.running).toBe(false);
            expect(result.worker.healthy).toBe(false);
        });

        it('should handle worker status with undefined properties', async () => {
            const workerStatusWithUndefined = {
                isInitialized: true,
                isRunning: undefined as any,
                isHealthy: undefined as any,
                taskQueue: 'default',
                namespace: 'default',
                workflowSource: 'none' as const,
                activitiesCount: 0,
            };

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(workerStatusWithUndefined);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getHealth();

            expect(result.worker.running).toBe(false);
            expect(result.worker.healthy).toBe(false);
        });

        it('should call temporalService methods', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getStats.mockReturnValue(mockStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);

            await controller.getHealth();

            expect(temporalService.getOverallHealth).toHaveBeenCalled();
            expect(temporalService.getStats).toHaveBeenCalled();
            expect(temporalService.getWorkerStatus).toHaveBeenCalled();
            expect(temporalService.hasWorker).toHaveBeenCalled();
        });
    });
});
