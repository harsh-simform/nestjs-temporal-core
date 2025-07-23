import { Test, TestingModule } from '@nestjs/testing';
import { TemporalHealthModule } from '../../src/health/temporal-health.module';
import { TemporalHealthController } from '../../src/health/temporal-health.controller';
import { TemporalService } from '../../src/services/temporal.service';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';

describe('TemporalHealthModule', () => {
    let module: TestingModule;

    beforeEach(async () => {
        const mockTemporalService = {
            getOverallHealth: jest.fn(),
            getSystemStatus: jest.fn(),
            getDiscoveryStats: jest.fn(),
            getScheduleStats: jest.fn(),
            getWorkerStatus: jest.fn(),
            hasWorker: jest.fn(),
            getAvailableWorkflows: jest.fn(),
            getScheduleIds: jest.fn(),
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
        };

        const mockDiscoveryService = {
            getScheduledWorkflows: jest.fn(),
            getHealthStatus: jest.fn(),
        };

        const mockWorkerManagerService = {
            healthCheck: jest.fn(),
        };

        module = await Test.createTestingModule({
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
    });

    afterEach(async () => {
        if (module) {
            await module.close();
        }
    });

    describe('module initialization', () => {
        it('should compile the module', () => {
            expect(module).toBeDefined();
        });

        it('should provide TemporalHealthController', () => {
            const controller = module.get<TemporalHealthController>(TemporalHealthController);
            expect(controller).toBeDefined();
            expect(controller).toBeInstanceOf(TemporalHealthController);
        });

        it('should have TemporalHealthController in controllers array', () => {
            const controllers = Reflect.getMetadata('controllers', TemporalHealthModule) || [];
            expect(controllers).toContain(TemporalHealthController);
        });
    });

    describe('module metadata', () => {
        it('should have correct module metadata', () => {
            const controllers = Reflect.getMetadata('controllers', TemporalHealthModule);
            const providers = Reflect.getMetadata('providers', TemporalHealthModule);
            const imports = Reflect.getMetadata('imports', TemporalHealthModule);
            const exports = Reflect.getMetadata('exports', TemporalHealthModule);

            expect(controllers).toEqual([TemporalHealthController]);
            expect(providers).toBeUndefined(); // No additional providers
            expect(imports).toBeUndefined(); // No imports
            expect(exports).toBeUndefined(); // No exports
        });
    });

    describe('dependency injection', () => {
        it('should inject all required services into the controller', () => {
            const controller = module.get<TemporalHealthController>(TemporalHealthController);
            
            expect(controller['temporalService']).toBeDefined();
            expect(controller['clientService']).toBeDefined();
            expect(controller['scheduleService']).toBeDefined();
            expect(controller['discoveryService']).toBeDefined();
            expect(controller['workerManager']).toBeDefined();
        });

        it('should handle optional worker manager dependency', async () => {
            const moduleWithoutWorker = await Test.createTestingModule({
                controllers: [TemporalHealthController],
                providers: [
                    {
                        provide: TemporalService,
                        useValue: { getOverallHealth: jest.fn() },
                    },
                    {
                        provide: TemporalClientService,
                        useValue: { isHealthy: jest.fn() },
                    },
                    {
                        provide: TemporalScheduleService,
                        useValue: { isHealthy: jest.fn() },
                    },
                    {
                        provide: TemporalDiscoveryService,
                        useValue: { getScheduledWorkflows: jest.fn() },
                    },
                    // Note: Intentionally not providing TemporalWorkerManagerService
                ],
            }).compile();

            const controller = moduleWithoutWorker.get<TemporalHealthController>(TemporalHealthController);
            expect(controller).toBeDefined();
            expect(controller['workerManager']).toBeUndefined();

            await moduleWithoutWorker.close();
        });
    });

    describe('controller routes registration', () => {
        it('should register all health check routes', () => {
            const controller = module.get<TemporalHealthController>(TemporalHealthController);
            
            // Check that controller methods exist
            expect(typeof controller.getOverallHealth).toBe('function');
            expect(typeof controller.getSystemStatus).toBe('function');
            expect(typeof controller.getClientHealth).toBe('function');
            expect(typeof controller.getWorkerHealth).toBe('function');
            expect(typeof controller.getDiscoveryHealth).toBe('function');
            expect(typeof controller.getScheduleHealth).toBe('function');
            expect(typeof controller.getLiveness).toBe('function');
            expect(typeof controller.getReadiness).toBe('function');
            expect(typeof controller.getStartup).toBe('function');
        });

        it('should have correct controller path', () => {
            const controllerPath = Reflect.getMetadata('path', TemporalHealthController);
            expect(controllerPath).toBe('temporal/health');
        });

        it('should have correct HTTP method decorators', () => {
            const controller = module.get<TemporalHealthController>(TemporalHealthController);
            const prototype = Object.getPrototypeOf(controller);
            
            // Check that methods have GET decorators
            const getOverallHealthPath = Reflect.getMetadata('path', prototype.getOverallHealth);
            const getSystemStatusPath = Reflect.getMetadata('path', prototype.getSystemStatus);
            const getClientHealthPath = Reflect.getMetadata('path', prototype.getClientHealth);
            const getWorkerHealthPath = Reflect.getMetadata('path', prototype.getWorkerHealth);
            const getDiscoveryHealthPath = Reflect.getMetadata('path', prototype.getDiscoveryHealth);
            const getScheduleHealthPath = Reflect.getMetadata('path', prototype.getScheduleHealth);
            const getLivenessPath = Reflect.getMetadata('path', prototype.getLiveness);
            const getReadinessPath = Reflect.getMetadata('path', prototype.getReadiness);
            const getStartupPath = Reflect.getMetadata('path', prototype.getStartup);
            
            expect(getOverallHealthPath).toEqual(expect.any(String));
            expect(getSystemStatusPath).toBe('system');
            expect(getClientHealthPath).toBe('client');
            expect(getWorkerHealthPath).toBe('worker');
            expect(getDiscoveryHealthPath).toBe('discovery');
            expect(getScheduleHealthPath).toBe('schedules');
            expect(getLivenessPath).toBe('live');
            expect(getReadinessPath).toBe('ready');
            expect(getStartupPath).toBe('startup');
        });
    });
});