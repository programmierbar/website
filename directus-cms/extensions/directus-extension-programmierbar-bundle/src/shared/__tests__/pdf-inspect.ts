import zlib from 'node:zlib'

/**
 * Minimal readers for the PDFs pdfkit writes (uncompressed object syntax), enough
 * for tests to look at the embedded e-invoice and the XMP metadata.
 */

/** The PDF as latin1, so string offsets equal byte offsets. */
function raw(pdf: Buffer): string {
    return pdf.toString('latin1')
}

/** Content of the (single) embedded file stream, inflated, as UTF-8. */
export function extractEmbeddedFile(pdf: Buffer): string {
    const text = raw(pdf)
    const typeAt = text.indexOf('/Type /EmbeddedFile')
    if (typeAt < 0) {
        throw new Error('PDF has no embedded file')
    }
    const streamStart = text.indexOf('stream\n', typeAt) + 'stream\n'.length
    const streamEnd = text.indexOf('\nendstream', streamStart)
    const dictionary = text.slice(text.lastIndexOf('obj', typeAt), streamStart)
    const data = pdf.subarray(streamStart, streamEnd)
    return (dictionary.includes('/FlateDecode') ? zlib.inflateSync(data) : data).toString('utf-8')
}

/** The XMP metadata packet (pdfkit writes it uncompressed). */
export function pdfMetadata(pdf: Buffer): string {
    const text = raw(pdf)
    const start = text.indexOf('<x:xmpmeta')
    const end = text.indexOf('</x:xmpmeta>', start) + '</x:xmpmeta>'.length
    if (start < 0 || end < start) {
        throw new Error('PDF has no XMP metadata')
    }
    return pdf.subarray(start, end).toString('utf-8')
}

/** The file specification dictionary of the embedded file. */
export function embeddedFileSpec(pdf: Buffer): string {
    const text = raw(pdf)
    const typeAt = text.indexOf('/Type /Filespec')
    if (typeAt < 0) {
        throw new Error('PDF has no file specification')
    }
    return text.slice(text.lastIndexOf('<<', typeAt), text.indexOf('>>', text.indexOf('/EF', typeAt) + 10) + 2)
}
