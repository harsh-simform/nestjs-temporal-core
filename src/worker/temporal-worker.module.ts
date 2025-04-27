import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TEMPORAL_WORKER_MODULE_OPTIONS, ERRORS } from '../constants';
import {
    TemporalWorkerAsyncOptions,
    TemporalWorkerOptions,
    TemporalWorkerOptionsFactory,
} from '../interfaces';
import { TemporalMetadataAccessor } from './temporal-metadata.accessor';
import { WorkerManager } from './worker-manager.service';

/**
 * NestJS module for Temporal worker integration
 * Provides worker management for Temporal activities and workflows
 */
@Module({})
export class TemporalWorkerModule {
    /**
     * Register the module with synchronous options
     *
     * @param options Worker configuration options
     * @returns Configured dynamic module
     *
     * @example
     * ```typescript
     * @Module({
     *   imports: [
     *     TemporalWorkerModule.register({
     *       connection: { address: 'localhost:7233' },
     *       namespace: 'default',
     *       taskQueue: 'my-task-queue',
     *       workflowsPath: './dist/workflows',
     *       activityClasses: [EmailActivities]
     *     })
     *   ]
     * })
     * export class AppModule {}
     * ```
     */
    static register(options: TemporalWorkerOptions): DynamicModule {
        const activityProviders = this.createActivityProviders(options.activityClasses || []);

        return {
            module: TemporalWorkerModule,
            global: true,
            providers: [
                {
                    provide: TEMPORAL_WORKER_MODULE_OPTIONS,
                    useValue: options,
                },
                ...activityProviders,
                TemporalMetadataAccessor,
                DiscoveryService,
                WorkerManager,
            ],
            exports: [WorkerManager, TEMPORAL_WORKER_MODULE_OPTIONS],
        };
    }

    /**
     * Register the module with asynchronous options
     *
     * @param options Async worker configuration options
     * @returns Configured dynamic module
     *
     * @example
     * ```typescript
     * @Module({
     *   imports: [
     *     ConfigModule.forRoot(),
     *     TemporalWorkerModule.registerAsync({
     *       imports: [ConfigModule],
     *       useFactory: (configService: ConfigService) => ({
     *         connection: {
     *           address: configService.get('TEMPORAL_ADDRESS')
     *         },
     *         namespace: configService.get('TEMPORAL_NAMESPACE'),
     *         taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
     *         workflowsPath: './dist/workflows',
     *         activityClasses: [EmailActivities]
     *       }),
     *       inject: [ConfigService]
     *     })
     *   ]
     * })
     * export class AppModule {}
     * ```
     */
    static registerAsync(options: TemporalWorkerAsyncOptions): DynamicModule {
        return {
            module: TemporalWorkerModule,
            global: true,
            imports: options.imports || [],
            providers: [
                ...this.createAsyncProviders(options),
                TemporalMetadataAccessor,
                DiscoveryService,
                WorkerManager,
            ],
            exports: [WorkerManager, TEMPORAL_WORKER_MODULE_OPTIONS],
        };
    }

    /**
     * Create providers for activity classes
     * @private
     */
    private static createActivityProviders(activityClasses: Array<Type<any>>): Provider[] {
        return activityClasses.map((activity) => ({
            provide: activity,
            useClass: activity,
        }));
    }

    /**
     * Create providers for async module configuration
     * @private
     */
    private static createAsyncProviders(options: TemporalWorkerAsyncOptions): Provider[] {
        if (options.useFactory) {
            return [
                {
                    provide: TEMPORAL_WORKER_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ];
        }

        if (options.useClass) {
            return [
                {
                    provide: TEMPORAL_WORKER_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalWorkerOptionsFactory) =>
                        await optionsFactory.createWorkerOptions(),
                    inject: [options.useClass],
                },
                {
                    provide: options.useClass,
                    useClass: options.useClass,
                },
            ];
        }

        if (options.useExisting) {
            return [
                {
                    provide: TEMPORAL_WORKER_MODULE_OPTIONS,
                    useFactory: async (optionsFactory: TemporalWorkerOptionsFactory) =>
                        await optionsFactory.createWorkerOptions(),
                    inject: [options.useExisting],
                },
            ];
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }
}
