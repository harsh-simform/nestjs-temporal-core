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
                isolatedModules: true,
                useESM: false,
            },
        ],
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts', '!src/interfaces.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    testTimeout: 5000,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
