import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/podcast-transcription/**', '**/assets/**', 'eslint.config.js'],
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
            '@typescript-eslint/consistent-type-imports': 'error',
        },
        files: ['**/*.ts'],
    }
)
