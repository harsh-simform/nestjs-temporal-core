import { Test, TestingModule } from '@nestjs/testing';
import { TemporalMetadataAccessor } from '../../src/services/temporal-metadata.service';

describe('Service Performance Benchmarks', () => {
    let metadataAccessor: TemporalMetadataAccessor;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TemporalMetadataAccessor],
        }).compile();

        metadataAccessor = module.get<TemporalMetadataAccessor>(TemporalMetadataAccessor);
    });

    describe('Metadata Accessor Performance', () => {
        it('should benchmark metadata access operations', () => {
            const Benchmark = require('benchmark');

            const suite = new Benchmark.Suite();

            // Test class for metadata operations
            class TestActivity {
                testMethod() {}
            }

            suite
                .add('isActivity check', () => {
                    metadataAccessor.isActivity(TestActivity);
                })
                .add('getActivityMetadata', () => {
                    metadataAccessor.getActivityMetadata(TestActivity);
                })
                .add('getActivityMethodNames', () => {
                    metadataAccessor.getActivityMethodNames(TestActivity);
                })
                .on('cycle', (event: any) => {
                    console.log(String(event.target));
                })
                .on('complete', function (this: any) {
                    console.log('Fastest is ' + this.filter('fastest').map('name'));
                })
                .run({ async: false });
        });
    });

    describe('Memory Usage Benchmarks', () => {
        it('should monitor memory usage during operations', () => {
            const initialMemory = process.memoryUsage();

            class TestActivity {
                method1() {}
                method2() {}
                method3() {}
            }

            // Perform multiple operations
            for (let i = 0; i < 1000; i++) {
                metadataAccessor.isActivity(TestActivity);
                metadataAccessor.getActivityMethodNames(TestActivity);
                metadataAccessor.getActivityMetadata(TestActivity);
            }

            const finalMemory = process.memoryUsage();

            console.log('Memory usage before operations:', {
                rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            });

            console.log('Memory usage after operations:', {
                rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            });

            const memoryIncrease = {
                rss: `${((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
            };

            console.log('Memory increase:', memoryIncrease);

            // Memory increase should be reasonable (< 10MB)
            expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(10 * 1024 * 1024);
        });
    });

    describe('Concurrent Operations Performance', () => {
        it('should handle concurrent metadata operations', async () => {
            const startTime = Date.now();

            class TestActivity {
                method1() {}
                method2() {}
                method3() {}
            }

            // Run 100 concurrent metadata operations
            const promises = Array(100)
                .fill(null)
                .map(() =>
                    Promise.all([
                        metadataAccessor.isActivity(TestActivity),
                        metadataAccessor.getActivityMethodNames(TestActivity),
                        metadataAccessor.getActivityMetadata(TestActivity),
                    ]),
                );

            await Promise.all(promises.flat());

            const endTime = Date.now();
            const duration = endTime - startTime;

            console.log(`Concurrent metadata operations took: ${duration}ms`);
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });
    });
});
