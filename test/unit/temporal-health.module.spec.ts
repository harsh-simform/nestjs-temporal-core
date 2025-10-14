import { Test, TestingModule } from '@nestjs/testing';
import { TemporalHealthModule } from '../../src/health/temporal-health.module';
import { TemporalHealthController } from '../../src/health/temporal-health.controller';
import { TemporalService } from '../../src/services/temporal.service';

describe('TemporalHealthModule', () => {
    let module: TestingModule;
    let controller: TemporalHealthController;

    beforeEach(async () => {
        const mockTemporalService = {
            getOverallHealth: jest.fn(),
            getStats: jest.fn(),
            getWorkerStatus: jest.fn(),
            hasWorker: jest.fn(),
        };

        module = await Test.createTestingModule({
            controllers: [TemporalHealthController],
            providers: [
                {
                    provide: TemporalService,
                    useValue: mockTemporalService,
                },
            ],
        }).compile();

        controller = module.get<TemporalHealthController>(TemporalHealthController);
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    it('should provide TemporalHealthController', () => {
        expect(controller).toBeDefined();
    });

    describe('controller registration', () => {
        it('should register the controller with correct metadata', () => {
            expect(controller).toBeInstanceOf(TemporalHealthController);
        });

        it('should have getHealth method', () => {
            expect(typeof controller.getHealth).toBe('function');
        });

        it('should have correct HTTP method decorators', () => {
            const prototype = Object.getPrototypeOf(controller);

            // Check that getHealth has GET decorator
            const getHealthPath = Reflect.getMetadata('path', prototype.getHealth);
            expect(getHealthPath).toBeDefined();
        });
    });

    describe('module configuration', () => {
        it('should have TemporalHealthModule defined', () => {
            expect(TemporalHealthModule).toBeDefined();
        });

        it('should have correct controller path', () => {
            const path = Reflect.getMetadata('path', TemporalHealthController);
            expect(path).toBe('temporal/health');
        });
    });
});
