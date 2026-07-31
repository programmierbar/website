#!/usr/bin/env node
/**
 * Typecheck ratchet.
 *
 * The app has a backlog of pre-existing `vue-tsc` errors, so a blocking typecheck gate is not
 * achievable today. A purely informational check would be ignored. So instead we ratchet:
 * the build fails only when the error count *increases* above the committed baseline in
 * `.typecheck-baseline`.
 *
 * Existing debt is tolerated. New debt is not.
 *
 * This matters most during the dependency upgrade phases (see docs/dependency-upgrade-plan.md):
 * a framework major is exactly the kind of change that quietly introduces type errors, and this
 * turns that into a number instead of a surprise.
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

function run(command, args) {
    try {
        return execFileSync(command, args, { cwd: appDir, encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
        // vue-tsc exits non-zero when it reports errors, which is the normal path here.
        return `${error.stdout ?? ''}${error.stderr ?? ''}`
    }
}

// `.nuxt/tsconfig.json` is generated, so it has to exist before vue-tsc can resolve auto-imports.
run('npx', ['nuxt', 'prepare'])

const output = run('npx', ['vue-tsc', '--noEmit', '-p', '.nuxt/tsconfig.json'])
const errors = output.split('\n').filter((line) => /error TS\d+:/.test(line))
const count = errors.length

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
