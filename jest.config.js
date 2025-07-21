module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: {
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                },
            },
        ],
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            branches: 98,
            functions: 98,
            lines: 98,
            statements: 98,
        },
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    testTimeout: 10000,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
