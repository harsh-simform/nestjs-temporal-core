import { Module } from '@nestjs/common';
import { TemporalHealthController } from './temporal-health.controller';

/**
 * Temporal Health Module
 *
 * Provides health check endpoints for Temporal components.
 * Import this module to add health check endpoints to your application.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     TemporalModule.register({
 *       connection: { address: 'localhost:7233' },
 *       taskQueue: 'default'
 *     }),
 *     TemporalHealthModule // Add health check endpoints
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * This will add the following endpoints:
 * - GET /temporal/health - Overall system health
 */
@Module({
    controllers: [TemporalHealthController],
})
export class TemporalHealthModule {}
