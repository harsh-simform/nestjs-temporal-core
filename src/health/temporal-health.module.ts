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
 * - GET /temporal/health/system - Detailed system status
 * - GET /temporal/health/client - Client health check
 * - GET /temporal/health/worker - Worker health check
 * - GET /temporal/health/discovery - Discovery service health
 * - GET /temporal/health/schedules - Schedule service health
 * - GET /temporal/health/live - Liveness probe
 * - GET /temporal/health/ready - Readiness probe
 * - GET /temporal/health/startup - Startup probe
 */
@Module({
    controllers: [TemporalHealthController],
})
export class TemporalHealthModule {}
