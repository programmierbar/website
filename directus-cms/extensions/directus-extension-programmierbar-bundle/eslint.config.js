import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/podcast-transcription/**', '**/assets/**', 'eslint.config.js', 'jest.config.ts'],
    },
    eslint.configs.recommended,
    {
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: true,
            },
            globals: {
                process: 'readable',
            },
        },
        rules: {
            // TypeScript already reports genuinely-undefined identifiers and is aware of Node
            // globals (Buffer, fetch, setImmediate, …). Core `no-undef` does not understand the
            // TS lib/types, so leaving it on produces false positives. Disabling it is the
            // typescript-eslint recommendation for type-checked projects.
            'no-undef': 'off',
            // Defer unused-symbol detection to the TS-aware rule, which understands type-only
            // parameters (e.g. names in a function-type alias) and ignores `_`-prefixed args.
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            '@typescript-eslint/consistent-type-imports': 'error',
            // Catch unhandled promises (the buzzsprout-class bug that crashed the CMS): an
            // async hook handler must be awaited, returned, or have a `.catch`.
            '@typescript-eslint/no-floating-promises': 'error',
            // `checksVoidReturn: false` avoids false positives on Directus `action('x', async () => ...)`
            // callbacks, whose typings expect a void-returning function.
            '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
        },
        files: ['**/*.ts'],
    }
)
