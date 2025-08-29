import { Test, TestingModule } from '@nestjs/testing';
import { TemporalHealthController } from '../../src/health/temporal-health.controller';
import { TemporalService } from '../../src/services/temporal.service';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { SystemStatus, WorkerStatus, DiscoveryStats, ScheduleStats } from '../../src/interfaces';

describe('TemporalHealthController', () => {
    let controller: TemporalHealthController;
    let temporalService: jest.Mocked<TemporalService>;
    let clientService: jest.Mocked<TemporalClientService>;
    let scheduleService: jest.Mocked<TemporalScheduleService>;
    let discoveryService: jest.Mocked<TemporalDiscoveryService>;
    let workerManager: jest.Mocked<TemporalWorkerManagerService>;

    const mockSystemStatus: SystemStatus = {
        client: {
            available: true,
            healthy: true,
        },
        worker: {
            available: true,
            status: {
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
                taskQueue: 'default',
                namespace: 'default',
                workflowSource: 'filesystem' as const,
                activitiesCount: 5,
            },
            health: 'healthy',
        },
        discovery: {
            controllers: 3,
            methods: 10,
            signals: 2,
            queries: 3,
            workflows: 4,
            childWorkflows: 1,
        },
    };

    const mockDiscoveryStats: DiscoveryStats = {
        controllers: 3,
        methods: 10,
        signals: 2,
        queries: 3,
        workflows: 4,
        childWorkflows: 1,
    };

    const mockWorkerStatus: WorkerStatus = {
        isInitialized: true,
        isRunning: true,
        isHealthy: true,
        taskQueue: 'default',
        namespace: 'default',
        workflowSource: 'filesystem' as const,
        activitiesCount: 5,
    };

    const mockScheduleStats: ScheduleStats = {
        total: 0,
        active: 0,
        inactive: 0,
        errors: 0,
    };

    const mockOverallHealth = {
        status: 'healthy' as const,
        components: {
            client: {
                status: 'connected',
                healthy: true,
                available: true,
            },
            worker: {
                status: 'running',
                healthy: true,
                available: true,
            },
            schedule: {
                status: 'active',
                healthy: true,
                available: true,
            },
            activity: {
                status: 'active',
                healthy: true,
                available: true,
            },
            discovery: {
                status: 'active',
                healthy: true,
                available: true,
            },
        },
        isInitialized: true,
        namespace: 'default',
        summary: {
            totalActivities: 5,
            totalSchedules: 0,
            workerRunning: true,
            clientConnected: true,
        },
    };

    beforeEach(async () => {
        const mockTemporalService = {
            getOverallHealth: jest.fn(),
            getSystemStatus: jest.fn(),
            getDiscoveryStats: jest.fn(),
            getWorkerStatus: jest.fn(),
            hasWorker: jest.fn(),
            getAvailableWorkflows: jest.fn(),
            getWorkerHealth: jest.fn(),
        };

        const mockClientService = {
            isHealthy: jest.fn(),
            getRawClient: jest.fn(),
            getStatus: jest.fn(),
        };

        const mockScheduleService = {
            isHealthy: jest.fn(),
            getStatus: jest.fn(),
            getScheduleStats: jest.fn(),
        };

        const mockDiscoveryService = {
            getHealthStatus: jest.fn(),
        };

        const mockWorkerManagerService = {
            healthCheck: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TemporalHealthController],
            providers: [
                {
                    provide: TemporalService,
                    useValue: mockTemporalService,
                },
                {
                    provide: TemporalClientService,
                    useValue: mockClientService,
                },
                {
                    provide: TemporalScheduleService,
                    useValue: mockScheduleService,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalWorkerManagerService,
                    useValue: mockWorkerManagerService,
                },
            ],
        }).compile();

        controller = module.get<TemporalHealthController>(TemporalHealthController);
        temporalService = module.get(TemporalService);
        clientService = module.get(TemporalClientService);
        scheduleService = module.get(TemporalScheduleService);
        discoveryService = module.get(TemporalDiscoveryService);
        workerManager = module.get(TemporalWorkerManagerService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should be defined', () => {
            expect(controller).toBeDefined();
        });
    });

    describe('getOverallHealth', () => {
        it('should return overall health status with all components', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.status).toBe('healthy');
            expect(result.timestamp).toBeDefined();
            expect(result.uptime).toBeGreaterThanOrEqual(0);
            expect(result.version).toBeDefined();
            expect(result.components.client).toEqual({
                status: 'healthy',
                healthy: true,
                available: true,
                details: {
                    connected: true,
                    healthy: true,
                    rawClientAvailable: true,
                },
            });
            expect(result.components.worker.details).toEqual({
                ...mockWorkerStatus,
                hasWorkerManager: true,
            });
            expect(result.components.discovery.scheduled).toBe(0);
            expect(result.components.schedules.status).toBe('inactive');

            expect(temporalService.getOverallHealth).toHaveBeenCalled();
            expect(temporalService.getSystemStatus).toHaveBeenCalled();
            expect(temporalService.getDiscoveryStats).toHaveBeenCalled();
            expect(scheduleService.getScheduleStats).toHaveBeenCalled();
        });

        it('should handle case when worker status is null', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(null);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.components.worker.details).toBeNull();
        });

        it('should handle case when raw client is null', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue(null);

            const result = await controller.getOverallHealth();

            expect((result.components.client.details as any).rawClientAvailable).toBe(false);
        });

        it('should use fallback version when npm_package_version is not set', async () => {
            // Save original version
            const originalVersion = process.env.npm_package_version;
            delete process.env.npm_package_version;

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.version).toBe('3.0.10');

            // Restore original version
            if (originalVersion) {
                process.env.npm_package_version = originalVersion;
            }
        });
    });

    describe('getSystemStatus', () => {
        it('should return detailed system status', async () => {
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);

            const result = await controller.getSystemStatus();

            expect(result).toEqual(mockSystemStatus);
            expect(temporalService.getSystemStatus).toHaveBeenCalled();
        });
    });

    describe('getClientHealth', () => {
        it('should return client health when healthy', async () => {
            const mockClientStatus = {
                available: true,
                healthy: true,
                initialized: true,
                lastHealthCheck: new Date(),
                namespace: 'default',
            };

            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);
            clientService.getStatus.mockReturnValue(mockClientStatus);

            const result = await controller.getClientHealth();

            expect(result).toEqual({
                healthy: true,
                connected: true,
                status: 'connected',
                details: {
                    rawClientAvailable: true,
                    available: true,
                    healthy: true,
                    initialized: true,
                    lastHealthCheck: expect.any(Date),
                    namespace: 'default',
                },
            });

            expect(clientService.isHealthy).toHaveBeenCalled();
            expect(clientService.getRawClient).toHaveBeenCalled();
            expect(clientService.getStatus).toHaveBeenCalled();
        });

        it('should return client health when unhealthy', async () => {
            const mockClientStatus = {
                available: false,
                healthy: false,
                initialized: false,
                lastHealthCheck: null,
                namespace: 'default',
            };

            clientService.isHealthy.mockReturnValue(false);
            clientService.getRawClient.mockReturnValue(null);
            clientService.getStatus.mockReturnValue(mockClientStatus);

            const result = await controller.getClientHealth();

            expect(result).toEqual({
                healthy: false,
                connected: false,
                status: 'disconnected',
                details: {
                    rawClientAvailable: false,
                    available: false,
                    healthy: false,
                    initialized: false,
                    lastHealthCheck: null,
                    namespace: 'default',
                },
            });
        });
    });

    describe('getWorkerHealth', () => {
        it('should return worker health when available and healthy', async () => {
            const mockWorkerHealth = {
                status: 'healthy' as const,
                details: mockWorkerStatus,
            };

            const mockHealthCheck = {
                status: 'healthy' as const,
                details: mockWorkerStatus,
                activities: {
                    total: 2,
                    registered: {
                        activity1: jest.fn(),
                        activity2: jest.fn(),
                    },
                },
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            workerManager.healthCheck.mockResolvedValue(mockHealthCheck);

            const result = await controller.getWorkerHealth();

            expect(result).toEqual({
                available: true,
                status: 'healthy',
                details: mockWorkerStatus,
                healthCheck: mockHealthCheck,
            });

            expect(temporalService.getWorkerHealth).toHaveBeenCalled();
            expect(temporalService.getWorkerStatus).toHaveBeenCalled();
            expect(temporalService.hasWorker).toHaveBeenCalled();
            expect(workerManager.healthCheck).toHaveBeenCalled();
        });

        it('should return worker health when not available', async () => {
            const mockWorkerHealth = {
                status: 'not_available' as const,
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(null);
            temporalService.hasWorker.mockReturnValue(false);

            const result = await controller.getWorkerHealth();

            expect(result).toEqual({
                available: false,
                status: 'not_available',
                details: null,
                healthCheck: undefined,
            });
        });

        it('should handle worker health check error', async () => {
            const mockWorkerHealth = {
                status: 'healthy' as const,
                details: mockWorkerStatus,
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            workerManager.healthCheck.mockRejectedValue(new Error('Health check failed'));

            const result = await controller.getWorkerHealth();

            expect(result.healthCheck).toEqual({
                status: 'unhealthy',
                details: { error: 'Health check failed' },
            });
        });

        it('should handle case when worker manager is undefined', async () => {
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                controllers: [TemporalHealthController],
                providers: [
                    {
                        provide: TemporalService,
                        useValue: temporalService,
                    },
                    {
                        provide: TemporalClientService,
                        useValue: clientService,
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: scheduleService,
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: discoveryService,
                    },
                ],
            }).compile();

            const controllerWithoutWorker =
                moduleWithoutWorker.get<TemporalHealthController>(TemporalHealthController);

            const mockWorkerHealth = {
                status: 'not_available' as const,
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(null);
            temporalService.hasWorker.mockReturnValue(false);

            const result = await controllerWithoutWorker.getWorkerHealth();

            expect(result.healthCheck).toBeUndefined();
            expect(result.available).toBe(false);
        });
    });

    describe('getDiscoveryHealth', () => {
        it('should return discovery health when active', async () => {
            const mockHealthStatus = {
                status: 'healthy' as const,
                discoveredItems: mockDiscoveryStats,
                isComplete: true,
                lastDiscovery: new Date(),
                discoveryDuration: 100,
                totalComponents: 5,
            };

            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            temporalService.getAvailableWorkflows.mockReturnValue(['ProcessOrderWorkflow']);
            discoveryService.getHealthStatus.mockReturnValue(mockHealthStatus);

            const result = await controller.getDiscoveryHealth();

            expect(result).toEqual({
                status: 'active',
                healthy: true,
                stats: mockDiscoveryStats,
                scheduledWorkflows: [],
                workflowNames: ['ProcessOrderWorkflow'],
                scheduleIds: [],
                healthDetails: mockHealthStatus,
            });

            expect(temporalService.getDiscoveryStats).toHaveBeenCalled();
            expect(temporalService.getAvailableWorkflows).toHaveBeenCalled();
            expect(discoveryService.getHealthStatus).toHaveBeenCalled();
        });

        it('should return discovery health when inactive', async () => {
            const inactiveStats = { ...mockDiscoveryStats, workflows: 0 };
            const mockHealthStatus = {
                status: 'degraded' as const,
                discoveredItems: inactiveStats,
                isComplete: false,
                lastDiscovery: null,
                discoveryDuration: null,
                totalComponents: 0,
            };

            temporalService.getDiscoveryStats.mockReturnValue(inactiveStats);
            temporalService.getAvailableWorkflows.mockReturnValue([]);
            discoveryService.getHealthStatus.mockReturnValue(mockHealthStatus);

            const result = await controller.getDiscoveryHealth();

            expect(result.status).toBe('inactive');
            expect(result.healthy).toBe(false);
        });
    });

    describe('getScheduleHealth', () => {
        it('should return schedule health when active', async () => {
            const activeScheduleStats: ScheduleStats = {
                total: 5,
                active: 3,
                inactive: 2,
                errors: 0,
            };

            const mockScheduleStatus = {
                available: true,
                healthy: true,
                schedulesSupported: true,
            };

            scheduleService.getScheduleStats.mockReturnValue(activeScheduleStats);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue(mockScheduleStatus);

            const result = await controller.getScheduleHealth();

            expect(result).toEqual({
                status: 'active',
                healthy: true,
                stats: activeScheduleStats,
                serviceStatus: mockScheduleStatus,
                scheduleIds: [],
                scheduledWorkflows: [],
            });

            expect(scheduleService.getScheduleStats).toHaveBeenCalled();
            expect(scheduleService.isHealthy).toHaveBeenCalled();
            expect(scheduleService.getStatus).toHaveBeenCalled();
        });

        it('should return schedule health when inactive', async () => {
            const inactiveScheduleStats: ScheduleStats = {
                total: 0,
                active: 0,
                inactive: 0,
                errors: 0,
            };

            const mockScheduleStatus = {
                available: true,
                healthy: false,
                schedulesSupported: true,
            };

            scheduleService.getScheduleStats.mockReturnValue(inactiveScheduleStats);
            scheduleService.isHealthy.mockReturnValue(false);
            scheduleService.getStatus.mockReturnValue(mockScheduleStatus);

            const result = await controller.getScheduleHealth();

            expect(result.status).toBe('inactive');
            expect(result.healthy).toBe(false);
        });
    });

    describe('getLiveness', () => {
        it('should return liveness status', async () => {
            const result = await controller.getLiveness();

            expect(result.status).toBe('ok');
            expect(result.timestamp).toBeDefined();
            expect(new Date(result.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('getReadiness', () => {
        it('should return readiness when all components are ready', async () => {
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.ready).toBe(true);
            expect(result.status).toBe('ready');
            expect(result.timestamp).toBeDefined();
            expect(result.checks.client).toBe(true);
            expect(result.checks.discovery).toBe(true);
            expect(result.checks.schedules).toBe(true);
            expect(result.checks.worker).toBe(true);

            expect(temporalService.getSystemStatus).toHaveBeenCalled();
            expect(temporalService.getOverallHealth).toHaveBeenCalled();
            expect(scheduleService.isHealthy).toHaveBeenCalled();
            expect(temporalService.hasWorker).toHaveBeenCalled();
        });

        it('should return not ready when client is unhealthy', async () => {
            const unhealthySystemStatus = {
                ...mockSystemStatus,
                client: { available: false, healthy: false },
            };

            temporalService.getSystemStatus.mockResolvedValue(unhealthySystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.ready).toBe(false);
            expect(result.status).toBe('not_ready');
            expect(result.checks.client).toBe(false);
        });

        it('should return readiness without worker when worker is not available', async () => {
            temporalService.getSystemStatus.mockResolvedValue({
                ...mockSystemStatus,
                worker: { available: false, status: undefined },
            });
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(false);

            const result = await controller.getReadiness();

            expect(result.ready).toBe(true);
            expect(result.checks).not.toHaveProperty('worker');
        });

        it('should handle case when worker status is undefined but hasWorker is true', async () => {
            temporalService.getSystemStatus.mockResolvedValue({
                ...mockSystemStatus,
                worker: { available: true, status: undefined },
            });
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.ready).toBe(false); // Should be false because worker.status?.isHealthy evaluates to false
            expect(result.checks.worker).toBe(false);
        });
    });

    describe('getStartup', () => {
        it('should return started when all components are available', async () => {
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            scheduleService.isHealthy.mockReturnValue(true);

            const result = await controller.getStartup();

            expect(result.started).toBe(true);
            expect(result.status).toBe('started');
            expect(result.timestamp).toBeDefined();
            expect(result.initializationTime).toBeGreaterThanOrEqual(0);
            expect(result.components.client).toBe(true);
            expect(result.components.discovery).toBe(true);
            expect(result.components.schedules).toBe(true);
            expect(result.components.worker).toBe(true);

            expect(temporalService.getSystemStatus).toHaveBeenCalled();
            expect(scheduleService.isHealthy).toHaveBeenCalled();
        });

        it('should return starting when client is not available', async () => {
            const startingSystemStatus = {
                ...mockSystemStatus,
                client: { available: false, healthy: false },
            };

            temporalService.getSystemStatus.mockResolvedValue(startingSystemStatus);
            scheduleService.isHealthy.mockReturnValue(true);

            const result = await controller.getStartup();

            expect(result.started).toBe(false);
            expect(result.status).toBe('starting');
            expect(result.components.client).toBe(false);
        });

        it('should return starting when discovery is not available', async () => {
            const startingSystemStatus = {
                ...mockSystemStatus,
                discovery: { ...mockDiscoveryStats, controllers: -1 },
            };

            temporalService.getSystemStatus.mockResolvedValue(startingSystemStatus);
            scheduleService.isHealthy.mockReturnValue(true);

            const result = await controller.getStartup();

            expect(result.started).toBe(false);
            expect(result.status).toBe('starting');
            expect(result.components.discovery).toBe(false);
        });
    });
});
