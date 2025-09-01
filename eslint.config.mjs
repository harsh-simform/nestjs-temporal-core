import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
    // Global ignores
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.nyc_output/**', '*.js', '*.mjs'],
    },

    // TypeScript files
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            prettier,
        },
        rules: {
            // Base ESLint rules
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'prefer-const': 'error',
            'no-var': 'error',

            // TypeScript ESLint rules (only commonly available ones)
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/ban-types': 'off',

            // Prettier
            'prettier/prettier': ['warn', { endOfLine: 'auto' }],
        },
    },

    // Test files
    {
        files: ['**/*.test.ts', '**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },

    // Apply Prettier config last to disable conflicting rules
    prettierConfig,
];
