module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
    },
    extends: ['@nuxt/eslint-config', 'plugin:nuxt/recommended', 'prettier'],
    plugins: [],
    // add your custom rules here
    rules: {
        'vue/multi-word-component-names': 0,
        '@typescript-eslint/consistent-type-imports': 'error',
    },
}
