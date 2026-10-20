import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load the bundled Museo Sans font for PDF rendering.
 *
 * PDF/A requires every font to be embedded: the invoice is only PDF/A-conformant
 * when this font is found (the standard-font fallback is not embedded).
 *
 * Lives in its own module because `import.meta.url` cannot be parsed by Jest's
 * CommonJS transform — tests mock this module and the rest of the invoice
 * generator stays testable.
 */
export function tryLoadMuseoFont(): Buffer | null {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url))
    // dist/api.js in the built bundle; src/shared/museo-font.ts when run from source
    // (e.g. the e-invoice sample script).
    for (const fontPath of [
        path.resolve(moduleDir, '..', 'assets', 'MuseoSans700.otf'),
        path.resolve(moduleDir, '..', '..', 'assets', 'MuseoSans700.otf'),
    ]) {
        try {
            return fs.readFileSync(fontPath)
        } catch {
            // try the next location
        }
    }
    return null
}
