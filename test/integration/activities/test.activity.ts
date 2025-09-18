import { Activity } from '../../../src';

export interface TestActivityInput {
    data: string;
    multiplier?: number;
}

export interface TestActivityOutput {
    transformed: string;
    length: number;
}

export class TestActivity {
    @Activity()
    async processData(input: TestActivityInput): Promise<TestActivityOutput> {
        const transformed = `${input.data}_processed`;
        const repeated = input.multiplier ? transformed.repeat(input.multiplier) : transformed;

        return {
            transformed: repeated,
            length: repeated.length,
        };
    }

    @Activity()
    async validateInput(input: string): Promise<boolean> {
        return input && input.length > 0;
    }
}
