import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/assets/**', 'eslint.config.js', 'jest.config.ts'],
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
    },
    // The bundle's one Vue SFC (`publishable/presentation-publishable.vue`) was previously the only
    // unlinted source file in the tree, because the block above matches `**/*.ts` only.
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        // `vue-eslint-parser` handles the SFC itself and delegates `<script lang="ts">` to whichever
        // parser it is handed — without this, the TypeScript in the script block fails to parse.
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    // Must stay last: it switches off the stylistic rules that overlap with Prettier, and later
    // config objects win. `eslint-plugin-vue`'s recommended set brings ~20 of them (`vue/html-indent`
    // wants 2-space indentation, `.prettierrc` says 4), so without this the two tools disagree on
    // every save. `eslint-config-prettier` was already a dependency but had never been applied —
    // harmless while the config was TypeScript-only and enabled no formatting rules.
    prettierConfig
)
