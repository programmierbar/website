import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load the bundled Museo Sans font for PDF rendering.
 *
 * Lives in its own module because `import.meta.url` cannot be parsed by Jest's
 * CommonJS transform — tests mock this module and the rest of the invoice
 * generator stays testable.
 */
export function tryLoadMuseoFont(): Buffer | null {
    try {
        const distDir = path.dirname(fileURLToPath(import.meta.url))
        const fontPath = path.resolve(distDir, '..', 'assets', 'MuseoSans700.otf')
        return fs.readFileSync(fontPath)
    } catch {
        return null
    }
}
