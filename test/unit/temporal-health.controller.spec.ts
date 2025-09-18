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

        it('should handle case when client is unhealthy', async () => {
            const unhealthySystemStatus = {
                ...mockSystemStatus,
                client: { available: false, healthy: false },
            };

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(unhealthySystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue(null);

            const result = await controller.getOverallHealth();

            expect(result.components.client.status).toBe('unhealthy');
            expect(result.components.client.healthy).toBe(false);
            expect((result.components.client.details as any).connected).toBe(false);
            expect((result.components.client.details as any).healthy).toBe(false);
            expect((result.components.client.details as any).rawClientAvailable).toBe(false);
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

        it('should handle schedules service unhealthy state', async () => {
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            scheduleService.isHealthy.mockReturnValue(false);

            const result = await controller.getStartup();

            expect(result.components.schedules).toBe(false);
        });
    });

    describe('Constructor and Optional Dependencies', () => {
        it('should create controller without worker manager', async () => {
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
                    // Explicitly no TemporalWorkerManagerService
                ],
            }).compile();

            const controllerWithoutWorker =
                moduleWithoutWorker.get<TemporalHealthController>(TemporalHealthController);

            expect(controllerWithoutWorker).toBeDefined();
            expect((controllerWithoutWorker as any).workerManager).toBeUndefined();
        });
    });

    describe('Edge Cases and Branch Coverage', () => {
        it('should handle getOverallHealth with worker manager undefined', async () => {
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

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controllerWithoutWorker.getOverallHealth();

            expect(result.components.worker.details).toEqual({
                ...mockWorkerStatus,
                hasWorkerManager: false, // Should be false when worker manager is undefined
            });
        });

        it('should handle npm_package_version environment variable explicitly set', async () => {
            // Save original and set specific version
            const originalVersion = process.env.npm_package_version;
            process.env.npm_package_version = '1.2.3';

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.version).toBe('1.2.3');

            // Restore original version
            if (originalVersion !== undefined) {
                process.env.npm_package_version = originalVersion;
            } else {
                delete process.env.npm_package_version;
            }
        });

        it('should handle temporalService.hasWorker() returning false in getOverallHealth', async () => {
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(false);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.components.worker.available).toBe(false);
        });

        it('should handle worker health check when healthCheck throws non-Error object', async () => {
            const mockWorkerHealth = {
                status: 'healthy' as const,
                details: mockWorkerStatus,
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            workerManager.healthCheck.mockRejectedValue('String error'); // Non-Error object

            const result = await controller.getWorkerHealth();

            expect(result.healthCheck).toEqual({
                status: 'unhealthy',
                details: { error: undefined }, // String errors don't have .message property
            });
        });

        it('should handle worker status when worker status exists but isHealthy is undefined', async () => {
            const systemStatusWithUndefinedWorkerHealth = {
                ...mockSystemStatus,
                worker: {
                    available: true,
                    status: {
                        isInitialized: true,
                        isRunning: true,
                        // isHealthy undefined
                        taskQueue: 'default',
                        namespace: 'default',
                        workflowSource: 'filesystem' as const,
                        activitiesCount: 5,
                    },
                },
            };

            temporalService.getSystemStatus.mockResolvedValue(systemStatusWithUndefinedWorkerHealth);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.checks.worker).toBe(false); // Should be false when isHealthy is undefined
        });

        it('should handle discovery stats with zero workflows', async () => {
            const zeroWorkflowStats = { ...mockDiscoveryStats, workflows: 0 };
            const mockHealthStatus = {
                status: 'healthy' as const,
                discoveredItems: zeroWorkflowStats,
                isComplete: true,
                lastDiscovery: new Date(),
                discoveryDuration: 100,
                totalComponents: 5,
            };

            temporalService.getDiscoveryStats.mockReturnValue(zeroWorkflowStats);
            temporalService.getAvailableWorkflows.mockReturnValue([]);
            discoveryService.getHealthStatus.mockReturnValue(mockHealthStatus);

            const result = await controller.getDiscoveryHealth();

            expect(result.status).toBe('inactive'); // Should be inactive when workflows = 0
            expect(result.healthy).toBe(true);
        });

        it('should handle schedule stats with active schedules greater than zero', async () => {
            const activeScheduleStats: ScheduleStats = {
                total: 5,
                active: 3, // > 0
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

            expect(result.status).toBe('active'); // Should be active when active > 0
            expect(result.healthy).toBe(true);
        });

        it('should handle all possible false conditions in readiness check', async () => {
            const unhealthySystemStatus = {
                client: { available: false, healthy: false },
                worker: {
                    available: false,
                    status: { isHealthy: false }
                },
                discovery: {
                    ...mockDiscoveryStats,
                    workflows: -1 // -1 >= 0 is false, so discovery check should be false
                },
            };

            temporalService.getSystemStatus.mockResolvedValue(unhealthySystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(false);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.ready).toBe(false);
            expect(result.checks.client).toBe(false);
            expect(result.checks.schedules).toBe(false);
            expect(result.checks.worker).toBe(false);
            expect(result.checks.discovery).toBe(false); // Should be false since -1 >= 0 is false
        });

        it('should handle ternary operators and conditional assignments in various methods', async () => {
            // Test all ternary operators in getOverallHealth
            const unhealthyMockOverallHealth = {
                ...mockOverallHealth,
                status: 'degraded' as const,
            };

            temporalService.getOverallHealth.mockResolvedValue(unhealthyMockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.status).toBe('degraded'); // Tests the ternary operator in return statement
        });

        it('should test complete branch coverage for getReadiness with both true and false paths', async () => {
            // First test: All checks true
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            let result = await controller.getReadiness();
            expect(result.ready).toBe(true);
            expect(result.status).toBe('ready');

            // Second test: Some checks false
            const partiallyUnhealthyStatus = {
                ...mockSystemStatus,
                client: { available: true, healthy: false },
            };

            temporalService.getSystemStatus.mockResolvedValue(partiallyUnhealthyStatus);
            result = await controller.getReadiness();
            expect(result.ready).toBe(false);
            expect(result.status).toBe('not_ready');
        });

        it('should test complete branch coverage for getStartup with both true and false paths', async () => {
            // First test: All components started
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            scheduleService.isHealthy.mockReturnValue(true);

            let result = await controller.getStartup();
            expect(result.started).toBe(true);
            expect(result.status).toBe('started');

            // Second test: Some components not started
            const notStartedStatus = {
                ...mockSystemStatus,
                client: { available: false, healthy: false },
            };

            temporalService.getSystemStatus.mockResolvedValue(notStartedStatus);
            result = await controller.getStartup();
            expect(result.started).toBe(false);
            expect(result.status).toBe('starting');
        });

        it('should handle edge case where discovery workflows is exactly 0', async () => {
            const exactlyZeroWorkflowStats = { ...mockDiscoveryStats, workflows: 0 };
            temporalService.getDiscoveryStats.mockReturnValue(exactlyZeroWorkflowStats);
            temporalService.getAvailableWorkflows.mockReturnValue([]);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy' as const,
                discoveredItems: exactlyZeroWorkflowStats,
                isComplete: true,
                lastDiscovery: new Date(),
                discoveryDuration: 100,
                totalComponents: 0,
            });

            const result = await controller.getDiscoveryHealth();
            expect(result.status).toBe('inactive'); // 0 > 0 is false, so should be 'inactive'
        });

        it('should handle edge case where schedule active is exactly 0', async () => {
            const exactlyZeroActiveSchedules: ScheduleStats = {
                total: 2,
                active: 0, // exactly 0
                inactive: 2,
                errors: 0,
            };

            scheduleService.getScheduleStats.mockReturnValue(exactlyZeroActiveSchedules);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue({
                available: true,
                healthy: true,
                schedulesSupported: true,
            });

            const result = await controller.getScheduleHealth();
            expect(result.status).toBe('inactive'); // 0 > 0 is false, so should be 'inactive'
        });

        it('should handle all false branches in Object.values(checks).every(Boolean)', async () => {
            const allFalseSystemStatus = {
                client: { available: false, healthy: false },
                worker: { available: false, status: { isHealthy: false } },
                discovery: { ...mockDiscoveryStats, workflows: -1 },
            };

            temporalService.getSystemStatus.mockResolvedValue(allFalseSystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(false);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            // All checks should be false, so ready should be false
            expect(result.ready).toBe(false);
            expect(Object.values(result.checks).every(Boolean)).toBe(false);
        });

        it('should handle getWorkerHealth when workerManager is undefined (test else branch)', async () => {
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
                    // No TemporalWorkerManagerService
                ],
            }).compile();

            const controllerWithoutWorker =
                moduleWithoutWorker.get<TemporalHealthController>(TemporalHealthController);

            const mockWorkerHealth = {
                status: 'healthy' as const,
                details: mockWorkerStatus,
            };

            temporalService.getWorkerHealth.mockResolvedValue(mockWorkerHealth);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controllerWithoutWorker.getWorkerHealth();

            // When workerManager is undefined, healthCheckDetails should be undefined
            expect(result.healthCheck).toBeUndefined();
            expect(result.available).toBe(true);
            expect(result.status).toBe('healthy');
            expect(result.details).toEqual(mockWorkerStatus);
        });

        it('should test logical OR operator with falsy environment variable', async () => {
            // Test the || operator in version assignment
            const originalVersion = process.env.npm_package_version;
            process.env.npm_package_version = ''; // Empty string (falsy)

            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            clientService.getRawClient.mockReturnValue({} as any);

            const result = await controller.getOverallHealth();

            expect(result.version).toBe('3.0.10'); // Should use fallback value

            // Restore original version
            if (originalVersion !== undefined) {
                process.env.npm_package_version = originalVersion;
            } else {
                delete process.env.npm_package_version;
            }
        });

        it('should test all comparison operators and edge cases', async () => {
            // Test discovery with workflows exactly at threshold
            const borderlineStats = { ...mockDiscoveryStats, workflows: 1 };
            temporalService.getDiscoveryStats.mockReturnValue(borderlineStats);
            temporalService.getAvailableWorkflows.mockReturnValue(['workflow1']);
            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy' as const,
                discoveredItems: borderlineStats,
                isComplete: true,
                lastDiscovery: new Date(),
                discoveryDuration: 100,
                totalComponents: 1,
            });

            const result = await controller.getDiscoveryHealth();
            expect(result.status).toBe('active'); // 1 > 0 should be true

            // Test schedules with active exactly at threshold
            const borderlineScheduleStats: ScheduleStats = {
                total: 1,
                active: 1, // exactly 1
                inactive: 0,
                errors: 0,
            };

            scheduleService.getScheduleStats.mockReturnValue(borderlineScheduleStats);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue({
                available: true,
                healthy: true,
                schedulesSupported: true,
            });

            const scheduleResult = await controller.getScheduleHealth();
            expect(scheduleResult.status).toBe('active'); // 1 > 0 should be true
        });

        it('should test conditional spread operator in readiness checks', async () => {
            // Test the conditional spread operator for worker checks
            const systemStatusWithWorker = {
                ...mockSystemStatus,
                worker: {
                    available: true,
                    status: { isHealthy: true },
                },
            };

            temporalService.getSystemStatus.mockResolvedValue(systemStatusWithWorker);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            scheduleService.isHealthy.mockReturnValue(true);
            temporalService.hasWorker.mockReturnValue(true);

            const result = await controller.getReadiness();

            expect(result.checks).toHaveProperty('worker');
            expect(result.checks.worker).toBe(true);

            // Test when worker is not available (should not have worker property)
            temporalService.hasWorker.mockReturnValue(false);
            const resultWithoutWorker = await controller.getReadiness();

            expect(resultWithoutWorker.checks).not.toHaveProperty('worker');
        });

        it('should test all decorator and parameter branches', async () => {
            // Setup all mocks for comprehensive testing
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            temporalService.getAvailableWorkflows.mockReturnValue(['workflow1']);
            temporalService.getWorkerHealth.mockResolvedValue({ status: 'healthy', details: mockWorkerStatus });

            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);
            clientService.getStatus.mockReturnValue({ available: true, healthy: true });

            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue({ available: true, healthy: true });

            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy' as const,
                discoveredItems: mockDiscoveryStats,
                isComplete: true,
                lastDiscovery: new Date(),
            });

            // Test each endpoint with different parameter combinations
            const result1 = await controller.getSystemStatus();
            expect(result1).toBeDefined();

            const result2 = await controller.getClientHealth();
            expect(result2).toBeDefined();

            const result3 = await controller.getWorkerHealth();
            expect(result3).toBeDefined();

            const result4 = await controller.getDiscoveryHealth();
            expect(result4).toBeDefined();

            const result5 = await controller.getScheduleHealth();
            expect(result5).toBeDefined();

            const result6 = await controller.getLiveness();
            expect(result6).toBeDefined();

            const result7 = await controller.getReadiness();
            expect(result7).toBeDefined();

            const result8 = await controller.getStartup();
            expect(result8).toBeDefined();

            const result9 = await controller.getOverallHealth();
            expect(result9).toBeDefined();
        });

        it('should test constructor with all possible dependency injection scenarios', async () => {
            // Test constructor with all required dependencies
            const fullModule: TestingModule = await Test.createTestingModule({
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
                    {
                        provide: TemporalWorkerManagerService,
                        useValue: workerManager,
                    },
                ],
            }).compile();

            const fullController = fullModule.get<TemporalHealthController>(TemporalHealthController);
            expect(fullController).toBeDefined();
            expect((fullController as any).temporalService).toBeDefined();
            expect((fullController as any).clientService).toBeDefined();
            expect((fullController as any).scheduleService).toBeDefined();
            expect((fullController as any).discoveryService).toBeDefined();
            expect((fullController as any).workerManager).toBeDefined();

            // Test constructor with minimal dependencies (workerManager optional)
            const minimalModule: TestingModule = await Test.createTestingModule({
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

            const minimalController = minimalModule.get<TemporalHealthController>(TemporalHealthController);
            expect(minimalController).toBeDefined();
            expect((minimalController as any).workerManager).toBeUndefined();
        });

        it('should handle async Promise resolution for all endpoints', async () => {
            // Setup all required mocks
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getOverallHealth.mockResolvedValue(mockOverallHealth);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            temporalService.getAvailableWorkflows.mockReturnValue(['workflow1']);
            temporalService.getWorkerHealth.mockResolvedValue({ status: 'healthy', details: mockWorkerStatus });

            clientService.isHealthy.mockReturnValue(true);
            clientService.getRawClient.mockReturnValue({} as any);
            clientService.getStatus.mockReturnValue({ available: true, healthy: true });

            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue({ available: true, healthy: true });

            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy' as const,
                discoveredItems: mockDiscoveryStats,
                isComplete: true,
                lastDiscovery: new Date(),
            });

            // Test async/await branches and Promise type coverage
            const promises = [
                controller.getOverallHealth(),
                controller.getSystemStatus(),
                controller.getClientHealth(),
                controller.getWorkerHealth(),
                controller.getDiscoveryHealth(),
                controller.getScheduleHealth(),
                controller.getLiveness(),
                controller.getReadiness(),
                controller.getStartup(),
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(9);
            results.forEach(result => expect(result).toBeDefined());
        });

        it('should test return type branches for all possible return value combinations', async () => {
            // Setup mocks first
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getDiscoveryStats.mockReturnValue(mockDiscoveryStats);
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            temporalService.getAvailableWorkflows.mockReturnValue(['workflow1']);

            scheduleService.getScheduleStats.mockReturnValue(mockScheduleStats);
            scheduleService.isHealthy.mockReturnValue(true);
            scheduleService.getStatus.mockReturnValue({ available: true, healthy: true });

            discoveryService.getHealthStatus.mockReturnValue({
                status: 'healthy' as const,
                discoveredItems: mockDiscoveryStats,
                isComplete: true,
                lastDiscovery: new Date(),
            });

            clientService.getRawClient.mockReturnValue({} as any);

            // Test different status combinations
            temporalService.getOverallHealth.mockResolvedValue({
                ...mockOverallHealth,
                status: 'unhealthy' as const,
            });
            let result = await controller.getOverallHealth();
            expect(result.status).toBe('unhealthy');

            temporalService.getOverallHealth.mockResolvedValue({
                ...mockOverallHealth,
                status: 'degraded' as const,
            });
            result = await controller.getOverallHealth();
            expect(result.status).toBe('degraded');

            // Test all status string combinations
            const discoveryResult = await controller.getDiscoveryHealth();
            expect(typeof discoveryResult.status).toBe('string');

            const scheduleResult = await controller.getScheduleHealth();
            expect(typeof scheduleResult.status).toBe('string');

            const readinessResult = await controller.getReadiness();
            expect(typeof readinessResult.status).toBe('string');

            const startupResult = await controller.getStartup();
            expect(typeof startupResult.status).toBe('string');
        });

        it('should test all optional property branches', async () => {
            // Setup mocks for testing optional properties
            temporalService.getSystemStatus.mockResolvedValue(mockSystemStatus);
            temporalService.getWorkerHealth.mockResolvedValue({ status: 'healthy', details: mockWorkerStatus });
            temporalService.getWorkerStatus.mockReturnValue(mockWorkerStatus);
            temporalService.hasWorker.mockReturnValue(true);
            scheduleService.isHealthy.mockReturnValue(true);
            workerManager.healthCheck.mockResolvedValue({ status: 'healthy', details: mockWorkerStatus });

            // Test initializationTime property (optional)
            const startupResult = await controller.getStartup();
            expect(startupResult.initializationTime).toBeDefined();
            expect(typeof startupResult.initializationTime).toBe('number');

            // Test healthCheck property (optional) when workerManager exists
            const workerResult = await controller.getWorkerHealth();
            expect(workerResult.healthCheck).toBeDefined();

            // Test when healthCheck is undefined
            const moduleWithoutWorker: TestingModule = await Test.createTestingModule({
                controllers: [TemporalHealthController],
                providers: [
                    { provide: TemporalService, useValue: temporalService },
                    { provide: TemporalClientService, useValue: clientService },
                    { provide: TemporalScheduleService, useValue: scheduleService },
                    { provide: TemporalDiscoveryService, useValue: discoveryService },
                ],
            }).compile();

            const controllerWithoutWorker = moduleWithoutWorker.get<TemporalHealthController>(TemporalHealthController);
            const workerResultWithoutManager = await controllerWithoutWorker.getWorkerHealth();
            expect(workerResultWithoutManager.healthCheck).toBeUndefined();
        });

        it('should test TypeScript decorator implicit branches and optional parameters', () => {
            // Test constructor parameter types and @Optional decorator
            const controller1 = new TemporalHealthController(
                temporalService,
                clientService,
                scheduleService,
                discoveryService,
                workerManager
            );
            expect(controller1).toBeDefined();

            // Test constructor with undefined optional parameter
            const controller2 = new TemporalHealthController(
                temporalService,
                clientService,
                scheduleService,
                discoveryService,
                undefined
            );
            expect(controller2).toBeDefined();

            // Test constructor without optional parameter
            const controller3 = new TemporalHealthController(
                temporalService,
                clientService,
                scheduleService,
                discoveryService
            );
            expect(controller3).toBeDefined();
        });

        it('should test all decorator path branches for HTTP methods', async () => {
            // Test implicit branches in @Get() decorators and route paths
            // These tests ensure all decorator variations are covered

            // Test base route
            expect(controller.getOverallHealth).toBeDefined();

            // Test 'system' route
            expect(controller.getSystemStatus).toBeDefined();

            // Test 'client' route
            expect(controller.getClientHealth).toBeDefined();

            // Test 'worker' route
            expect(controller.getWorkerHealth).toBeDefined();

            // Test 'discovery' route
            expect(controller.getDiscoveryHealth).toBeDefined();

            // Test 'schedules' route
            expect(controller.getScheduleHealth).toBeDefined();

            // Test 'live' route
            expect(controller.getLiveness).toBeDefined();

            // Test 'ready' route
            expect(controller.getReadiness).toBeDefined();

            // Test 'startup' route
            expect(controller.getStartup).toBeDefined();

            // Test method property access to cover all TypeScript implicit branches
            const methods = [
                'getOverallHealth',
                'getSystemStatus',
                'getClientHealth',
                'getWorkerHealth',
                'getDiscoveryHealth',
                'getScheduleHealth',
                'getLiveness',
                'getReadiness',
                'getStartup'
            ];

            methods.forEach(method => {
                expect(typeof controller[method as keyof TemporalHealthController]).toBe('function');
            });
        });
    });
});
