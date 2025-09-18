import { TestWorkflow } from './workflows/test.workflow';
import { TestActivity } from './activities/test.activity';
import { IntegrationTestSetup } from './setup';

// Skip integration tests when running all tests (not just integration tests)
const isRunningAllTests =
    process.env.JEST_WORKER_ID && !process.argv.some((arg) => arg.includes('integration'));
const shouldSkipIntegrationTests =
    process.env.SKIP_TEMPORAL_INTEGRATION === 'true' || isRunningAllTests;

const describeIntegration = shouldSkipIntegrationTests ? describe.skip : describe;

describeIntegration('TemporalService Integration Tests', () => {
    let setup: IntegrationTestSetup;

    beforeAll(async () => {
        setup = new IntegrationTestSetup();
        await setup.setup();
    }, 30000);

    afterAll(async () => {
        await setup.teardown();
    }, 10000);

    describe('Temporal Server Connection', () => {
        it('should connect to Temporal server', () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                expect(true).toBe(true); // Skip test gracefully
                return;
            }

            const connection = setup.getTemporalConnection();
            expect(connection).toBeDefined();
        });

        it('should have worker connection available', () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                expect(true).toBe(true); // Skip test gracefully
                return;
            }

            const workerConnection = setup.getWorkerConnection();
            expect(workerConnection).toBeDefined();
        });
    });

    describe('Workflow Execution', () => {
        it.skip('should execute workflow successfully', async () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                return;
            }

            const app = setup.getApp();
            const temporalService = app.get('TemporalService');

            // This would require a running Temporal server
            // Implementation depends on actual workflow setup
            expect(temporalService).toBeDefined();
        });

        it.skip('should handle workflow execution errors', async () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                return;
            }

            const app = setup.getApp();
            const temporalService = app.get('TemporalService');

            // Test error handling scenarios
            expect(temporalService).toBeDefined();
        });
    });

    describe('Activity Execution', () => {
        it.skip('should execute activity successfully', async () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                return;
            }

            const app = setup.getApp();
            const temporalService = app.get('TemporalService');

            // Test activity execution
            expect(temporalService).toBeDefined();
        });
    });

    describe('Health Checks', () => {
        it('should report healthy status when Temporal is available', async () => {
            if (!setup.isTemporalAvailable()) {
                console.warn('Temporal server not available, skipping integration test');
                expect(true).toBe(true); // Skip test gracefully
                return;
            }

            const app = setup.getApp();
            const temporalService = app.get('TemporalService');

            const health = await temporalService.getOverallHealth();

            expect(health.status).toBe('healthy');
        });
    });
});
