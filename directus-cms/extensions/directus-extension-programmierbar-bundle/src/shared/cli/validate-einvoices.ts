/**
 * Validate the e-invoice sample PDFs with Mustang (ZUGFeRD/Factur-X validator, Apache-2.0).
 *
 * Mustang checks, per file: PDF/A-3 conformance (embedded veraPDF), the XSD of the
 * embedded CII XML, and the EN 16931 + Factur-X Schematron business rules for the
 * declared profile. Run through `npm run einvoice:validate`, which renders the samples
 * first (`npm run einvoice:samples`). Needs Java 11+ on the PATH.
 *
 * The Mustang CLI jar is downloaded from Maven Central once and verified against the
 * pinned SHA-256 below. Set MUSTANG_JAR to use an existing jar instead.
 *
 * Usage: tsx src/shared/cli/validate-einvoices.ts [samples-dir]
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const MUSTANG_VERSION = '2.26.0'
const MUSTANG_SHA256 = '42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736'
const MUSTANG_URL = `https://repo1.maven.org/maven2/org/mustangproject/Mustang-CLI/${MUSTANG_VERSION}/Mustang-CLI-${MUSTANG_VERSION}.jar`
const CACHE_DIR = path.resolve('.cache', 'mustang')

/** Every document type must be among the samples — an empty directory must not pass. */
const REQUIRED_SAMPLES = ['rechnung', 'rechnungsberichtigung', 'stornorechnung']

function sha256(file: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureMustangJar(): Promise<string> {
    if (process.env.MUSTANG_JAR) {
        return process.env.MUSTANG_JAR
    }

    const jar = path.join(CACHE_DIR, `Mustang-CLI-${MUSTANG_VERSION}.jar`)
    if (fs.existsSync(jar) && sha256(jar) === MUSTANG_SHA256) {
        return jar
    }

    fs.mkdirSync(CACHE_DIR, { recursive: true })
    // Maven Central rate-limits bursts (HTTP 429): back off and retry.
    for (const delay of [0, 2000, 4000, 8000, 16000, 32000]) {
        await sleep(delay)
        console.log(`Downloading ${MUSTANG_URL}`)
        const response = await fetch(MUSTANG_URL)
        if (response.ok) {
            fs.writeFileSync(jar, Buffer.from(await response.arrayBuffer()))
            break
        }
        console.warn(`Download failed with HTTP ${response.status}`)
    }

    if (!fs.existsSync(jar) || sha256(jar) !== MUSTANG_SHA256) {
        fs.rmSync(jar, { force: true })
        throw new Error(`Could not download Mustang ${MUSTANG_VERSION} with the expected checksum`)
    }
    return jar
}

interface Result {
    file: string
    valid: boolean
    pdf: string
    xml: string
    messages: string[]
}

function sectionStatus(report: string, section: 'pdf' | 'xml'): string {
    const body = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`).exec(report)?.[1] ?? ''
    return /<summary status="(\w+)"\/>/.exec(body)?.[1] ?? 'missing'
}

function validate(jar: string, file: string): Result {
    const run = spawnSync('java', ['-jar', jar, '--action', 'validate', '--source', file, '--no-notices'], {
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    })
    if (run.error) {
        throw run.error
    }
    const report = run.stdout
    fs.writeFileSync(file.replace(/\.pdf$/, '.mustang.xml'), report)

    const overall = /<summary status="(\w+)"\/>\s*<\/validation>/.exec(report)?.[1]
    const messages = [...report.matchAll(/<(error|warning)[^>]*>([\s\S]*?)<\/\1>/g)].map(
        (match) => `${match[1]}: ${match[2]?.trim()}`
    )
    return {
        file: path.basename(file),
        valid: run.status === 0 && overall === 'valid',
        pdf: sectionStatus(report, 'pdf'),
        xml: sectionStatus(report, 'xml'),
        messages,
    }
}

async function main() {
    const samplesDir = path.resolve(process.argv[2] ?? 'einvoice-samples')
    const pdfs = fs.existsSync(samplesDir)
        ? fs
              .readdirSync(samplesDir)
              .filter((name) => name.endsWith('.pdf'))
              .sort()
        : []

    const missing = REQUIRED_SAMPLES.filter((name) => !pdfs.includes(`${name}.pdf`))
    if (missing.length > 0) {
        throw new Error(`Missing samples in ${samplesDir}: ${missing.join(', ')} — run npm run einvoice:samples first`)
    }

    const jar = await ensureMustangJar()
    console.log(`Validating ${pdfs.length} e-invoices with Mustang ${MUSTANG_VERSION}\n`)

    const results = pdfs.map((name) => validate(jar, path.join(samplesDir, name)))
    for (const result of results) {
        console.log(`${result.valid ? 'VALID  ' : 'INVALID'} ${result.file} (PDF/A: ${result.pdf}, XML: ${result.xml})`)
        for (const message of result.messages) {
            console.log(`        ${message}`)
        }
    }

    const invalid = results.filter((result) => !result.valid)
    if (invalid.length > 0) {
        console.error(`\n${invalid.length} of ${results.length} e-invoices are invalid — see the *.mustang.xml reports`)
        process.exit(1)
    }
    console.log(`\nAll ${results.length} e-invoices are valid.`)
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
})
