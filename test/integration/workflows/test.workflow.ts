import { Workflow } from '../../../src';

export interface TestWorkflowInput {
    message: string;
    delay?: number;
}

export interface TestWorkflowOutput {
    result: string;
    processedAt: Date;
}

@Workflow()
export class TestWorkflow {
    async execute(input: TestWorkflowInput): Promise<TestWorkflowOutput> {
        // Simulate some processing
        await new Promise((resolve) => setTimeout(resolve, input.delay || 100));

        return {
            result: `Processed: ${input.message}`,
            processedAt: new Date(),
        };
    }
}
