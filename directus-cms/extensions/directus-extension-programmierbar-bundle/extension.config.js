/**
 * Custom Rollup config for the Directus extension bundle.
 *
 * Some dependencies (pdfkit, passkit-generator) use Node.js globals like
 * `__dirname` or native modules that don't work when bundled into ESM.
 * mjml is CommonJS with a large dependency tree (juice, cssnano, html-minifier)
 * that is not meant to be bundled either; the same goes for nodemailer (CommonJS, used for
 * the accounting-mail SMTP transport).
 * By marking them as external, they load from node_modules at runtime.
 */
export default {
    plugins: [
        {
            name: 'externalize-native-modules',
            resolveId(id) {
                if (id === 'pdfkit' || id === 'passkit-generator' || id === 'mjml' || id === 'nodemailer') {
                    return { id, external: true }
                }
                return null
            },
        },
    ],
}
