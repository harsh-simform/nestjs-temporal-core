import { Test, TestingModule } from '@nestjs/testing';
import { TemporalWorkerManagerService } from '../../src/services/temporal-worker.service';
import { TemporalDiscoveryService } from '../../src/services/temporal-discovery.service';
import { TEMPORAL_MODULE_OPTIONS, TEMPORAL_CONNECTION } from '../../src/constants';
import { TemporalOptions } from '../../src/interfaces';
import { Worker, NativeConnection } from '@temporalio/worker';

jest.mock('@temporalio/worker');
jest.mock('@temporalio/client');

/**
 * Test suite specifically for verifying the bug fix:
 * Worker activity filtering by activityClasses not working
 *
 * This test ensures that when activityClasses is specified in WorkerDefinition,
 * the worker only loads activities from those classes and not all discovered activities.
 */
describe('TemporalWorkerManagerService - Activity Filtering Bug Fix', () => {
    let service: TemporalWorkerManagerService;
    let mockDiscoveryService: jest.Mocked<Partial<TemporalDiscoveryService>>;
    let mockWorker: any;
    let mockConnection: any;

    // Test activity classes
    class PaymentActivity {}
    class OrderActivity {}
    class NotificationActivity {}

    beforeEach(async () => {
        jest.clearAllMocks();

        mockWorker = {
            run: jest.fn().mockImplementation(() => new Promise(() => {})),
            shutdown: jest.fn().mockResolvedValue(undefined),
            getState: jest.fn().mockReturnValue('RUNNING'),
        };

        mockConnection = {
            close: jest.fn().mockResolvedValue(undefined),
        };

        // Setup discovered activities with metadata
        const mockActivitiesMap = new Map();

        // PaymentActivity activities
        mockActivitiesMap.set('processPayment', {
            name: 'processPayment',
            className: 'PaymentActivity',
            method: {},
            instance: new PaymentActivity(),
            handler: jest.fn().mockName('processPayment'),
        });
        mockActivitiesMap.set('refundPayment', {
            name: 'refundPayment',
            className: 'PaymentActivity',
            method: {},
            instance: new PaymentActivity(),
            handler: jest.fn().mockName('refundPayment'),
        });

        // OrderActivity activities
        mockActivitiesMap.set('createOrder', {
            name: 'createOrder',
            className: 'OrderActivity',
            method: {},
            instance: new OrderActivity(),
            handler: jest.fn().mockName('createOrder'),
        });
        mockActivitiesMap.set('cancelOrder', {
            name: 'cancelOrder',
            className: 'OrderActivity',
            method: {},
            instance: new OrderActivity(),
            handler: jest.fn().mockName('cancelOrder'),
        });

        // NotificationActivity activities
        mockActivitiesMap.set('sendEmail', {
            name: 'sendEmail',
            className: 'NotificationActivity',
            method: {},
            instance: new NotificationActivity(),
            handler: jest.fn().mockName('sendEmail'),
        });
        mockActivitiesMap.set('sendSms', {
            name: 'sendSms',
            className: 'NotificationActivity',
            method: {},
            instance: new NotificationActivity(),
            handler: jest.fn().mockName('sendSms'),
        });

        mockDiscoveryService = {
            getHealthStatus: jest.fn().mockReturnValue({ isComplete: true, status: 'healthy' }),
            getAllActivities: jest.fn().mockReturnValue({
                processPayment: mockActivitiesMap.get('processPayment')!.handler,
                refundPayment: mockActivitiesMap.get('refundPayment')!.handler,
                createOrder: mockActivitiesMap.get('createOrder')!.handler,
                cancelOrder: mockActivitiesMap.get('cancelOrder')!.handler,
                sendEmail: mockActivitiesMap.get('sendEmail')!.handler,
                sendSms: mockActivitiesMap.get('sendSms')!.handler,
            }),
            getDiscoveredActivities: jest.fn().mockReturnValue(mockActivitiesMap),
            getActivityNames: jest
                .fn()
                .mockReturnValue([
                    'processPayment',
                    'refundPayment',
                    'createOrder',
                    'cancelOrder',
                    'sendEmail',
                    'sendSms',
                ]),
        };

        (Worker.create as jest.Mock).mockResolvedValue(mockWorker);
        (NativeConnection.connect as jest.Mock).mockResolvedValue(mockConnection);
    });

    it('should filter activities by activityClasses - only PaymentActivity', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'payments-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [PaymentActivity],
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        expect(Worker.create).toHaveBeenCalledTimes(1);
        expect(mockDiscoveryService.getDiscoveredActivities).toHaveBeenCalled();

        // Check that only PaymentActivity activities were registered
        const workerCreateCall = (Worker.create as jest.Mock).mock.calls[0][0];
        const registeredActivities = workerCreateCall.activities;

        expect(Object.keys(registeredActivities)).toHaveLength(2);
        expect(registeredActivities).toHaveProperty('processPayment');
        expect(registeredActivities).toHaveProperty('refundPayment');
        expect(registeredActivities).not.toHaveProperty('createOrder');
        expect(registeredActivities).not.toHaveProperty('cancelOrder');
        expect(registeredActivities).not.toHaveProperty('sendEmail');
        expect(registeredActivities).not.toHaveProperty('sendSms');
    });

    it('should filter activities by activityClasses - only OrderActivity', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'orders-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [OrderActivity],
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        const workerCreateCall = (Worker.create as jest.Mock).mock.calls[0][0];
        const registeredActivities = workerCreateCall.activities;

        expect(Object.keys(registeredActivities)).toHaveLength(2);
        expect(registeredActivities).toHaveProperty('createOrder');
        expect(registeredActivities).toHaveProperty('cancelOrder');
        expect(registeredActivities).not.toHaveProperty('processPayment');
        expect(registeredActivities).not.toHaveProperty('refundPayment');
        expect(registeredActivities).not.toHaveProperty('sendEmail');
        expect(registeredActivities).not.toHaveProperty('sendSms');
    });

    it('should handle multiple workers with different activityClasses', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'payments-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [PaymentActivity],
                },
                {
                    taskQueue: 'orders-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [OrderActivity],
                },
                {
                    taskQueue: 'notifications-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [NotificationActivity],
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        expect(Worker.create).toHaveBeenCalledTimes(3);

        // Check payments worker
        const paymentsWorkerCall = (Worker.create as jest.Mock).mock.calls[0][0];
        expect(Object.keys(paymentsWorkerCall.activities)).toHaveLength(2);
        expect(paymentsWorkerCall.activities).toHaveProperty('processPayment');
        expect(paymentsWorkerCall.activities).toHaveProperty('refundPayment');

        // Check orders worker
        const ordersWorkerCall = (Worker.create as jest.Mock).mock.calls[1][0];
        expect(Object.keys(ordersWorkerCall.activities)).toHaveLength(2);
        expect(ordersWorkerCall.activities).toHaveProperty('createOrder');
        expect(ordersWorkerCall.activities).toHaveProperty('cancelOrder');

        // Check notifications worker
        const notificationsWorkerCall = (Worker.create as jest.Mock).mock.calls[2][0];
        expect(Object.keys(notificationsWorkerCall.activities)).toHaveLength(2);
        expect(notificationsWorkerCall.activities).toHaveProperty('sendEmail');
        expect(notificationsWorkerCall.activities).toHaveProperty('sendSms');
    });

    it('should load all activities when activityClasses is not specified', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'all-activities-queue',
                    workflowsPath: './dist/workflows',
                    // No activityClasses specified
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        const workerCreateCall = (Worker.create as jest.Mock).mock.calls[0][0];
        const registeredActivities = workerCreateCall.activities;

        // Should have all 6 activities
        expect(Object.keys(registeredActivities)).toHaveLength(6);
        expect(registeredActivities).toHaveProperty('processPayment');
        expect(registeredActivities).toHaveProperty('refundPayment');
        expect(registeredActivities).toHaveProperty('createOrder');
        expect(registeredActivities).toHaveProperty('cancelOrder');
        expect(registeredActivities).toHaveProperty('sendEmail');
        expect(registeredActivities).toHaveProperty('sendSms');
    });

    it('should load all activities when activityClasses is empty array', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'all-activities-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [], // Empty array
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        const workerCreateCall = (Worker.create as jest.Mock).mock.calls[0][0];
        const registeredActivities = workerCreateCall.activities;

        // Should have all 6 activities
        expect(Object.keys(registeredActivities)).toHaveLength(6);
    });

    it('should filter activities by multiple activityClasses', async () => {
        const options: TemporalOptions = {
            connection: { address: 'localhost:7233' },
            workers: [
                {
                    taskQueue: 'combined-queue',
                    workflowsPath: './dist/workflows',
                    activityClasses: [PaymentActivity, OrderActivity],
                },
            ],
            enableLogger: false,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporalWorkerManagerService,
                {
                    provide: TEMPORAL_MODULE_OPTIONS,
                    useValue: options,
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
        await service.onModuleInit();

        const workerCreateCall = (Worker.create as jest.Mock).mock.calls[0][0];
        const registeredActivities = workerCreateCall.activities;

        expect(Object.keys(registeredActivities)).toHaveLength(4);
        expect(registeredActivities).toHaveProperty('processPayment');
        expect(registeredActivities).toHaveProperty('refundPayment');
        expect(registeredActivities).toHaveProperty('createOrder');
        expect(registeredActivities).toHaveProperty('cancelOrder');
        expect(registeredActivities).not.toHaveProperty('sendEmail');
        expect(registeredActivities).not.toHaveProperty('sendSms');
    });
});
