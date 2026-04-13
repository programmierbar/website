/**
 * Custom Rollup config for the Directus extension bundle.
 *
 * Some dependencies (pdfkit, passkit-generator) use Node.js globals like
 * `__dirname` or native modules that don't work when bundled into ESM.
 * By marking them as external, they load from node_modules at runtime.
 */
export default {
    plugins: [
        {
            name: 'externalize-native-modules',
            resolveId(id) {
                if (id === 'pdfkit' || id === 'passkit-generator') {
                    return { id, external: true }
                }
                return null
            },
        },
    ],
}
