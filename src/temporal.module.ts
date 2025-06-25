import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { TemporalService } from './temporal.service';
import { TemporalAsyncOptions, TemporalOptions, TemporalOptionsFactory } from './interfaces';
import { DEFAULT_TASK_QUEUE, ERRORS } from './constants';
import { TemporalClientModule } from './client';
import { TemporalWorkerModule } from './worker';
import { TemporalDiscoveryService, TemporalScheduleManagerService } from './discovery';

/**
 * Streamlined unified module for Temporal integration with NestJS
 *
 * Provides comprehensive Temporal functionality including:
 * - Client operations (workflows, signals, queries)
 * - Worker management (activities, workflow execution)
 * - Auto-discovery (activities, scheduled workflows)
 * - Schedule management (cron, interval-based scheduling)
 *
 * @example
 * ```typescript
 * // Simple setup with client and worker
 * @Module({
 *   imports: [
 *     TemporalModule.register({
 *       connection: {
 *         address: 'localhost:7233',
 *         namespace: 'production'
 *       },
 *       taskQueue: 'main-queue',
 *       worker: {
 *         workflowsPath: './dist/workflows',
 *         activityClasses: [EmailActivities, PaymentActivities]
 *       }
 *     })
 *   ],
 *   providers: [EmailActivities, PaymentActivities], // Activities auto-discovered
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TemporalModule {
    /**
     * Register Temporal module with synchronous options
     *
     * @param options Configuration options for Temporal integration
     * @returns Configured dynamic module
     */
    static register(options: TemporalOptions): DynamicModule {
        const { clientOptions, workerOptions } = this.processOptions(options);
        const imports: any[] = [TemporalClientModule.register(clientOptions)];

        // Add worker module if worker configuration is provided
        if (workerOptions) {
            imports.push(TemporalWorkerModule.register(options));
        }

        return {
            module: TemporalModule,
            imports,
            providers: [
                // Core NestJS discovery services
                DiscoveryService,
                MetadataScanner,

                // Our discovery and management services
                TemporalDiscoveryService,
                TemporalScheduleManagerService,

                // Unified service
                TemporalService,
            ],
            exports: [TemporalService],
            global: options.isGlobal,
        };
    }

    /**
     * Register Temporal module with asynchronous options
     *
     * @param options Async configuration options for Temporal integration
     * @returns Configured dynamic module
     *
     * @example
     * ```typescript
     * // Async setup with ConfigService
     * @Module({
     *   imports: [
     *     ConfigModule.forRoot(),
     *     TemporalModule.registerAsync({
     *       imports: [ConfigModule],
     *       useFactory: (configService: ConfigService) => ({
     *         connection: {
     *           address: configService.get('TEMPORAL_ADDRESS'),
     *           namespace: configService.get('TEMPORAL_NAMESPACE'),
     *           apiKey: configService.get('TEMPORAL_API_KEY')
     *         },
     *         taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
     *         worker: {
     *           workflowBundle: require('./workflows-bundle'),
     *           activityClasses: [EmailActivities, PaymentActivities]
     *         }
     *       }),
     *       inject: [ConfigService]
     *     })
     *   ]
     * })
     * export class AppModule {}
     * ```
     */
    static registerAsync(options: TemporalAsyncOptions): DynamicModule {
        this.validateAsyncOptions(options);

        const imports: any[] = [
            ...(options.imports || []),

            // Client module (always required)
            TemporalClientModule.registerAsync({
                imports: options.imports,
                useFactory: async (...args: any[]) => {
                    const temporalOptions = await this.createOptionsFromFactory(options, args);
                    const { clientOptions } = this.processOptions(temporalOptions);
                    return clientOptions;
                },
                inject: options.inject,
            }),
        ];

        // Worker module (conditional - only if worker configuration is provided)
        imports.push(
            TemporalWorkerModule.registerAsync({
                imports: options.imports,
                useFactory: async (...args: any[]) => {
                    const temporalOptions = await this.createOptionsFromFactory(options, args);
                    const { workerOptions } = this.processOptions(temporalOptions);

                    // If no worker configuration, return minimal config to satisfy the module
                    if (!workerOptions) {
                        return {
                            connection: temporalOptions.connection,
                            taskQueue: temporalOptions.taskQueue || DEFAULT_TASK_QUEUE,
                            worker: { activityClasses: [] },
                        };
                    }

                    return temporalOptions;
                },
                inject: options.inject,
            }),
        );

        return {
            module: TemporalModule,
            imports,
            providers: [
                // Core NestJS discovery services
                DiscoveryService,
                MetadataScanner,

                // Our discovery and management services
                TemporalDiscoveryService,
                TemporalScheduleManagerService,

                // Unified service
                TemporalService,
            ],
            exports: [TemporalService],
            global: options.isGlobal,
        };
    }

    /**
     * Register Temporal module for client-only usage (no worker)
     *
     * @param options Client-only configuration options
     * @returns Configured dynamic module
     *
     * @example
     * ```typescript
     * // Client-only setup (no worker)
     * @Module({
     *   imports: [
     *     TemporalModule.forClient({
     *       connection: {
     *         address: 'temporal.company.com:7233',
     *         namespace: 'production',
     *         tls: true
     *       }
     *     })
     *   ]
     * })
     * export class ClientOnlyModule {}
     * ```
     */
    static forClient(options: {
        connection: TemporalOptions['connection'];
        isGlobal?: boolean;
    }): DynamicModule {
        return {
            module: TemporalModule,
            imports: [
                TemporalClientModule.register({
                    connection: options.connection,
                    isGlobal: options.isGlobal,
                }),
            ],
            providers: [
                // Core NestJS discovery services
                DiscoveryService,
                MetadataScanner,

                // Our discovery and management services
                TemporalDiscoveryService,
                TemporalScheduleManagerService,

                // Unified service
                TemporalService,
            ],
            exports: [TemporalService],
            global: options.isGlobal,
        };
    }

    /**
     * Register Temporal module for worker-only usage
     *
     * @param options Worker-only configuration options
     * @returns Configured dynamic module
     *
     * @example
     * ```typescript
     * // Worker-only setup (separate from client)
     * @Module({
     *   imports: [
     *     TemporalModule.forWorker({
     *       connection: {
     *         address: 'localhost:7233',
     *         namespace: 'development'
     *       },
     *       taskQueue: 'worker-queue',
     *       workflowsPath: './dist/workflows',
     *       activityClasses: [ProcessingActivities]
     *     })
     *   ]
     * })
     * export class WorkerOnlyModule {}
     * ```
     */
    static forWorker(options: {
        connection: TemporalOptions['connection'];
        taskQueue: string;
        workflowsPath?: string;
        workflowBundle?: any;
        activityClasses?: any[];
        isGlobal?: boolean;
    }): DynamicModule {
        const temporalOptions: TemporalOptions = {
            connection: options.connection,
            taskQueue: options.taskQueue,
            worker: {
                workflowsPath: options.workflowsPath,
                workflowBundle: options.workflowBundle,
                activityClasses: options.activityClasses,
            },
            isGlobal: options.isGlobal,
        };

        return {
            module: TemporalModule,
            imports: [
                TemporalClientModule.register(temporalOptions),
                TemporalWorkerModule.register(temporalOptions),
            ],
            providers: [
                // Core NestJS discovery services
                DiscoveryService,
                MetadataScanner,

                // Our discovery and management services
                TemporalDiscoveryService,
                TemporalScheduleManagerService,

                // Unified service
                TemporalService,
            ],
            exports: [TemporalService],
            global: options.isGlobal,
        };
    }

    /**
     * Register with full functionality (shorthand for register)
     *
     * @param options Full configuration options
     * @returns Configured dynamic module
     */
    static withFullFeatures(options: TemporalOptions): DynamicModule {
        return this.register(options);
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    /**
     * Process and validate Temporal options, converting to client and worker options
     */
    private static processOptions(options: TemporalOptions) {
        this.validateOptions(options);

        // Build client options (always required)
        const clientOptions = {
            connection: options.connection,
            allowConnectionFailure: options.allowConnectionFailure !== false,
        };

        // Build worker options (optional)
        let workerOptions = null;
        if (options.worker) {
            workerOptions = {
                connection: options.connection,
                taskQueue: options.taskQueue || DEFAULT_TASK_QUEUE,
                workflowsPath: options.worker.workflowsPath,
                workflowBundle: options.worker.workflowBundle,
                activityClasses: options.worker.activityClasses,
                autoStart: options.worker.autoStart !== false,
                allowWorkerFailure: options.allowConnectionFailure !== false,
                workerOptions: options.worker.workerOptions,
            };
        }

        return { clientOptions, workerOptions };
    }

    /**
     * Validate synchronous options
     */
    private static validateOptions(options: TemporalOptions): void {
        if (!options.connection) {
            throw new Error('Connection configuration is required');
        }

        if (!options.connection.address) {
            throw new Error('Connection address is required');
        }

        // Validate worker configuration if provided
        if (options.worker) {
            const hasWorkflowsPath = Boolean(options.worker.workflowsPath);
            const hasWorkflowBundle = Boolean(options.worker.workflowBundle);

            if (!hasWorkflowsPath && !hasWorkflowBundle) {
                throw new Error('Worker requires either workflowsPath or workflowBundle');
            }

            if (hasWorkflowsPath && hasWorkflowBundle) {
                throw new Error('Worker cannot have both workflowsPath and workflowBundle');
            }
        }
    }

    /**
     * Validate async options
     */
    private static validateAsyncOptions(options: TemporalAsyncOptions): void {
        const hasFactory = Boolean(options.useFactory);
        const hasClass = Boolean(options.useClass);
        const hasExisting = Boolean(options.useExisting);

        const configMethods = [hasFactory, hasClass, hasExisting].filter(Boolean).length;

        if (configMethods === 0) {
            throw new Error(
                `${ERRORS.INVALID_OPTIONS}: Must provide useFactory, useClass, or useExisting`,
            );
        }

        if (configMethods > 1) {
            throw new Error(
                `${ERRORS.INVALID_OPTIONS}: Cannot provide multiple configuration methods`,
            );
        }
    }

    /**
     * Create options from factory method
     */
    private static async createOptionsFromFactory(
        options: TemporalAsyncOptions,
        args: any[],
    ): Promise<TemporalOptions> {
        if (options.useFactory) {
            return await options.useFactory(...args);
        }

        if (options.useClass) {
            const optionsFactory = new options.useClass() as TemporalOptionsFactory;
            return await optionsFactory.createTemporalOptions();
        }

        if (options.useExisting) {
            // Note: useExisting should be handled by DI container
            throw new Error('useExisting should be handled by dependency injection');
        }

        throw new Error(ERRORS.INVALID_OPTIONS);
    }
}
