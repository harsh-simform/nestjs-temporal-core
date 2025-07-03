import { DynamicModule, Module, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TemporalSchedulesService } from './temporal-schedules.service';
import { TemporalDiscoveryService } from '../discovery/temporal-discovery.service';
import { SchedulesModuleOptions } from '../interfaces';
import { SCHEDULES_MODULE_OPTIONS } from '../constants';

/**
 * Standalone Schedules Module for NestJS
 * Provides schedule discovery, management, and execution capabilities
 *
 * @example
 * ```typescript
 * // Basic usage
 * @Module({
 *   imports: [
 *     TemporalSchedulesModule.forRoot({
 *       autoStart: true,
 *       defaultTimezone: 'UTC'
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // With async configuration
 * @Module({
 *   imports: [
 *     TemporalSchedulesModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (config: ConfigService) => ({
 *         autoStart: config.get('SCHEDULES_AUTO_START'),
 *         defaultTimezone: config.get('TIMEZONE')
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TemporalSchedulesModule {
    /**
     * Configure schedules module with synchronous options
     */
    static forRoot(options: SchedulesModuleOptions = {}): DynamicModule {
        return {
            module: TemporalSchedulesModule,
            imports: [DiscoveryModule],
            providers: [
                {
                    provide: SCHEDULES_MODULE_OPTIONS,
                    useValue: options,
                },
                TemporalDiscoveryService,
                TemporalSchedulesService,
            ],
            exports: [TemporalSchedulesService],
            global: options.global !== false,
        };
    }

    /**
     * Configure schedules module with asynchronous options
     */
    static forRootAsync(options: {
        imports?: (Type<unknown> | DynamicModule)[];
        useFactory: (
            ...args: unknown[]
        ) => Promise<SchedulesModuleOptions> | SchedulesModuleOptions;
        inject?: string[];
        global?: boolean;
    }): DynamicModule {
        return {
            module: TemporalSchedulesModule,
            imports: [DiscoveryModule, ...(options.imports || [])],
            providers: [
                {
                    provide: SCHEDULES_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                TemporalDiscoveryService,
                TemporalSchedulesService,
            ],
            exports: [TemporalSchedulesService],
            global: options.global !== false,
        };
    }
}
