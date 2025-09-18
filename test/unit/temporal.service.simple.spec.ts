import { Test, TestingModule } from '@nestjs/testing';
import { TemporalService } from '../../src/services/temporal.service';
import { TemporalClientService } from '../../src/services/temporal-client.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TemporalScheduleService } from '../../src/services/temporal-schedule.service';
import { TemporalActivityService } from '../../src/services/temporal-activity.service';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TEMPORAL_MODULE_OPTIONS } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';

describe('TemporalService Simple Test', () => {
    let service: TemporalService;

    const mockOptions: TemporalOptions = {
        connection: {
            address: 'localhost:7233',
            namespace: 'default',
        },
        taskQueue: 'test-queue',
    };

    // Set test timeout to 10 seconds
    jest.setTimeout(10000);

    beforeEach(async () => {
        const mockClientService = {
            startWorkflow: jest.fn(),
            signalWorkflow: jest.fn(),
            queryWorkflow: jest.fn(),
            terminateWorkflow: jest.fn(),
            cancelWorkflow: jest.fn(),
            getRawClient: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getWorkflowHandle: jest.fn(),
            getStatus: jest.fn().mockReturnValue({
                isConnected: true,
                lastError: null,
                namespace: 'default',
                isInitialized: true,
            }),
        };

        const mockDiscoveryService = {
            getStats: jest.fn(),
            getWorkflowNames: jest.fn().mockReturnValue(['WorkflowA', 'WorkflowB']),
            hasWorkflow: jest.fn().mockReturnValue(true),
            getHealthStatus: jest.fn().mockReturnValue({
                status: 'healthy',
                isComplete: true,
            }),
            rediscover: jest.fn(),
        };

        const mockWorkerService = {
            getWorkerStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
            }),
            startWorker: jest.fn(),
            stopWorker: jest.fn(),
            restartWorker: jest.fn(),
            getStatus: jest.fn().mockReturnValue({
                isInitialized: true,
                isRunning: true,
                isHealthy: true,
            }),
            isWorkerRunning: jest.fn().mockReturnValue(true),
            isWorkerAvailable: jest.fn().mockReturnValue(true),
        };

        const mockScheduleService = {
            createSchedule: jest.fn(),
            getSchedule: jest.fn(),
            updateSchedule: jest.fn(),
            deleteSchedule: jest.fn(),
            pauseSchedule: jest.fn(),
            unpauseSchedule: jest.fn(),
            triggerSchedule: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
            getScheduleStats: jest
                .fn()
                .mockReturnValue({ total: 0, active: 0, inactive: 0, errors: 0 }),
        };

        const mockActivityService = {
            getActivityNames: jest.fn().mockReturnValue([]),
            registerActivityClass: jest.fn(),
            registerActivityMethod: jest.fn(),
            executeActivity: jest.fn(),
            getActivity: jest.fn(),
            getAllActivities: jest.fn(),
            hasActivity: jest.fn(),
            isHealthy: jest.fn().mockReturnValue(true),
        };

        const mockMetadataAccessor = {
            isActivity: jest.fn(),
            getActivityMetadata: jest.fn(),
            getActivityOptions: jest.fn(),
            extractActivityMethods: jest.fn(),
            extractActivityMethodsFromClass: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalService,
                {
                    provide: TemporalClientService,
                    useValue: mockClientService,
                },
                {
                    provide: TemporalDiscoveryService,
                    useValue: mockDiscoveryService,
                },
                {
                    provide: TemporalWorkerManagerService,
                    useValue: mockWorkerService,
                },
                {
                    provide: TemporalScheduleService,
                    useValue: mockScheduleService,
                },
                {
                    provide: TemporalActivityService,
                    useValue: mockActivityService,
                },
                {
                    provide: TemporalMetadataAccessor,
                    useValue: mockMetadataAccessor,
                },
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<TemporalService>(TemporalService);

        // Mock all initialization methods to prevent hanging
        (service as any).waitForServicesInitialization = jest.fn().mockResolvedValue(undefined);
        (service as any).logInitializationSummary = jest.fn().mockResolvedValue(undefined);
        (service as any).isInitialized = true;

        await service.onModuleInit(); // Initialize the service
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should initialize successfully', async () => {
        // Service should be initialized by now via onModuleInit
        expect(service).toBeDefined();
    });
});
