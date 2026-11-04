import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, jest, test } from '@jest/globals'
import { renderEInvoiceSamples } from '../einvoice-samples.ts'
import { FACTURX_FILENAME } from '../einvoice.ts'
import { extractEmbeddedFile, pdfMetadata } from './pdf-inspect.ts'

// The real font (Jest cannot parse the loader's `import.meta.url`): PDF/A requires it
// to be embedded, so the samples handed to the validators must use it.
jest.mock('../museo-font.ts', () => ({
    tryLoadMuseoFont: () =>
        jest
            .requireActual<{ readFileSync: (file: string) => Buffer }>('node:fs')
            .readFileSync(`${process.cwd()}/assets/MuseoSans700.otf`),
}))

/**
 * Renders every e-invoice sample. With EINVOICE_SAMPLES_DIR set (see
 * `npm run einvoice:samples`), also writes the PDFs and their embedded XML there for
 * the official validators (`npm run einvoice:validate`).
 */
describe('e-invoice samples', () => {
    test('render as PDF/A-3b with an embedded factur-x.xml', async () => {
        const samples = await renderEInvoiceSamples()
        expect(samples.map((sample) => sample.name)).toEqual([
            'rechnung',
            'rechnungsberichtigung',
            'stornorechnung',
            'rechnung-privat',
            'rechnung-0-euro',
            'rechnung-rundung',
        ])

        const outDir = process.env.EINVOICE_SAMPLES_DIR
        if (outDir) {
            fs.mkdirSync(outDir, { recursive: true })
        }

        for (const sample of samples) {
            const metadata = pdfMetadata(sample.pdf)
            expect(metadata).toContain('<pdfaid:part>3</pdfaid:part>')
            expect(metadata).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>')

            const xml = extractEmbeddedFile(sample.pdf)
            expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>')

            if (outDir) {
                fs.writeFileSync(path.join(outDir, `${sample.name}.pdf`), sample.pdf)
                fs.writeFileSync(path.join(outDir, `${sample.name}.${FACTURX_FILENAME}`), xml)
            }
        }
    })
})
