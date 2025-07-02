import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TemporalActivityService } from './temporal-activity.service';
import { ActivityModuleOptions } from '../interfaces';
import { ACTIVITY_MODULE_OPTIONS } from '../constants';

/**
 * Standalone Activity Module for NestJS
 * Provides activity registration and management capabilities
 *
 * @example
 * ```typescript
 * // Basic usage
 * @Module({
 *   imports: [
 *     TemporalActivityModule.forRoot({
 *       activityClasses: [EmailActivities, PaymentActivities]
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // With async configuration
 * @Module({
 *   imports: [
 *     TemporalActivityModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         activityClasses: config.get('ACTIVITY_CLASSES'),
 *         timeout: config.get('ACTIVITY_TIMEOUT')
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TemporalActivityModule {
    /**
     * Configure activity module with synchronous options
     */
    static forRoot(options: ActivityModuleOptions = {}): DynamicModule {
        return {
            module: TemporalActivityModule,
            imports: [DiscoveryModule],
            providers: [
                {
                    provide: ACTIVITY_MODULE_OPTIONS,
                    useValue: options,
                },
                TemporalActivityService,
            ],
            exports: [TemporalActivityService],
            global: options.global !== false,
        };
    }

    /**
     * Configure activity module with asynchronous options
     */
    static forRootAsync(options: {
        imports?: any[];
        useFactory: (...args: any[]) => Promise<ActivityModuleOptions> | ActivityModuleOptions;
        inject?: any[];
        global?: boolean;
    }): DynamicModule {
        return {
            module: TemporalActivityModule,
            imports: [DiscoveryModule, ...(options.imports || [])],
            providers: [
                {
                    provide: ACTIVITY_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                TemporalActivityService,
            ],
            exports: [TemporalActivityService],
            global: options.global !== false,
        };
    }
}
