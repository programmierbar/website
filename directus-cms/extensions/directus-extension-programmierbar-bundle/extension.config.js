/**
 * Custom Rollup config for the Directus extension bundle.
 *
 * pdfkit uses `__dirname` internally to locate built-in font files.
 * When bundled into an ESM module, `__dirname` is not available.
 * By marking pdfkit as external, it loads from node_modules at runtime
 * where CJS globals (__dirname) work correctly.
 */
export default {
    plugins: [
        {
            name: 'externalize-pdfkit',
            resolveId(id) {
                if (id === 'pdfkit') {
                    return { id, external: true }
                }
                return null
            },
        },
    ],
}
