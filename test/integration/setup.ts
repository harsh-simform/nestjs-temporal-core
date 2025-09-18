import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TemporalModule } from '../../src/temporal.module';
import { Connection } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

export class IntegrationTestSetup {
    private app: INestApplication;
    private temporalConnection: Connection;
    private workerConnection: NativeConnection;

    async setup(): Promise<INestApplication> {
        // Create test module
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                TemporalModule.registerAsync({
                    useFactory: () => ({
                        connection: {
                            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
                            tls: false,
                        },
                        taskQueue: 'test-integration-queue',
                        namespace: 'default',
                        worker: {
                            workflowsPath: './test/integration/workflows',
                            activities: [],
                        },
                    }),
                }),
            ],
        }).compile();

        this.app = moduleFixture.createNestApplication();
        await this.app.init();

        // Initialize Temporal connections for testing
        try {
            this.temporalConnection = await Connection.connect({
                address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
            });

            this.workerConnection = await NativeConnection.connect({
                address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
            });
        } catch (error) {
            console.warn('Temporal server not available for integration tests:', error.message);
            // Explicitly set to null to indicate unavailability
            this.temporalConnection = null as any;
            this.workerConnection = null as any;
        }

        return this.app;
    }

    async teardown(): Promise<void> {
        if (this.workerConnection) {
            await this.workerConnection.close();
        }
        if (this.temporalConnection) {
            this.temporalConnection.close();
        }
        if (this.app) {
            await this.app.close();
        }
    }

    getApp(): INestApplication {
        return this.app;
    }

    getTemporalConnection(): Connection | undefined {
        return this.temporalConnection;
    }

    getWorkerConnection(): NativeConnection | undefined {
        return this.workerConnection;
    }

    isTemporalAvailable(): boolean {
        return !!this.temporalConnection;
    }
}
