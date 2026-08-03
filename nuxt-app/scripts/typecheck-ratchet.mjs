#!/usr/bin/env node
/**
 * Typecheck ratchet.
 *
 * The app has a backlog of pre-existing `vue-tsc` errors, so a blocking typecheck gate is not
 * achievable today and a purely informational one would be ignored. Instead the build fails only
 * when the error count *increases* above the committed baseline in `.typecheck-baseline`.
 *
 * Existing debt is tolerated. New debt is not.
 *
 * When errors are fixed, lower the baseline in the same PR — the script prints the new value.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const baselineFile = resolve(appDir, '.typecheck-baseline')
const shouldWrite = process.argv.includes('--write')

function fail(message) {
    console.error(`\n${message}\n`)
    process.exit(1)
}

/**
 * Run a command and return its combined output.
 *
 * `toleratesDiagnosticExit` marks the vue-tsc call, which legitimately exits non-zero when it finds
 * type errors. Every other failure must stay fatal: swallowing one yields empty output, which parses
 * as zero errors and reports the ratchet green while the checker is in fact broken.
 */
function run(command, args, { toleratesDiagnosticExit = false } = {}) {
    const label = `${command} ${args.join(' ')}`
    try {
        return { output: execFileSync(command, args, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' }), status: 0 }
    } catch (error) {
        const output = `${error.stdout ?? ''}${error.stderr ?? ''}`

        // No numeric status means the process never ran or was killed — never a diagnostics exit.
        if (typeof error.status !== 'number') {
            fail(`Could not run \`${label}\`: ${error.message}\n${output}`)
        }
        if (!toleratesDiagnosticExit) {
            fail(`\`${label}\` exited ${error.status}:\n${output}`)
        }
        return { output, status: error.status }
    }
}

// `.nuxt/tsconfig.json` is generated, so it has to exist before vue-tsc can resolve auto-imports.
run('npx', ['nuxt', 'prepare'])

const { output, status } = run('npx', ['vue-tsc', '--noEmit', '-p', '.nuxt/tsconfig.json'], {
    toleratesDiagnosticExit: true,
})
const lines = output.split('\n')

// Two patterns, because both match a naive /error TS\d+:/ and conflating them lets a broken
// invocation masquerade as a dramatically improved error count. A source diagnostic is anchored to a
// file and position (`components/Foo.vue(17,10): error TS2440:`); a config or CLI failure is emitted
// bare (`error TS5058: The specified path does not exist`).
const errors = lines.filter((line) => /^.+\(\d+,\d+\): error TS\d+:/.test(line))
const configErrors = lines.filter((line) => /^error TS\d+:/.test(line))
const count = errors.length

if (configErrors.length > 0) {
    fail(`vue-tsc reported a configuration error rather than type diagnostics:\n${configErrors.join('\n')}`)
}

// A non-zero exit with nothing parseable means vue-tsc crashed rather than found errors. Counting
// that as zero is how a dead gate reports success.
if (status !== 0 && count === 0) {
    fail(`vue-tsc exited ${status} but reported no diagnostics — treating this as a broken typecheck:\n${output}`)
}

if (shouldWrite) {
    writeFileSync(baselineFile, `${count}\n`)
    console.log(`Wrote typecheck baseline: ${count}`)
    process.exit(0)
}

let baseline
try {
    baseline = Number.parseInt(readFileSync(baselineFile, 'utf8').trim(), 10)
} catch {
    console.error(`No baseline found at ${baselineFile}. Create one with: npm run typecheck:ratchet -- --write`)
    process.exit(1)
}

if (Number.isNaN(baseline)) {
    console.error(`Baseline file ${baselineFile} does not contain a number.`)
    process.exit(1)
}

if (count > baseline) {
    console.error(`\nTypecheck regression: ${count} errors, baseline is ${baseline} (+${count - baseline}).\n`)
    // Only the new errors are interesting, but we cannot reliably diff them without storing the
    // full list, so print everything and let the reviewer scan for their own files.
    console.error(output)
    console.error(
        `\nFix the new errors, or — if the increase is a deliberate, understood consequence of an ` +
            `upgrade — raise the baseline with: npm run typecheck:ratchet -- --write`
    )
    process.exit(1)
}

if (count < baseline) {
    console.log(
        `Typecheck improved: ${count} errors, baseline is ${baseline} (-${baseline - count}).\n` +
            `Lower the baseline in this PR: npm run typecheck:ratchet -- --write`
    )
    process.exit(0)
}

console.log(`Typecheck steady at ${count} errors (baseline ${baseline}).`)
