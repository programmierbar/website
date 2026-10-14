import { describe, expect, it } from 'vitest'
import { loadTurnstileScript, TURNSTILE_SCRIPT_URL } from '../helpers/loadTurnstileScript'

// Minimal DOM: just enough of document/head/script for the loader (tests run in Node).
function fakeDom() {
    const scripts: any[] = []
    const createScript = () => {
        const listeners: Record<string, ((event?: unknown) => void)[]> = {}
        const script: any = {
            src: '',
            async: false,
            addEventListener: (type: string, fn: (event?: unknown) => void) => (listeners[type] ??= []).push(fn),
            fire: (type: string) => listeners[type]?.forEach((fn) => fn(new Error(type))),
            remove: () => scripts.splice(scripts.indexOf(script), 1),
        }
        return script
    }
    const doc = {
        head: { appendChild: (script: any) => scripts.push(script) },
        createElement: createScript,
        querySelector: (selector: string) =>
            scripts.find((script) => selector === `script[src="${script.src}"]`) ?? null,
    } as unknown as Document
    return { doc, scripts }
}

describe('loadTurnstileScript', () => {
    it('resolves with the API once the script has loaded', async () => {
        const { doc, scripts } = fakeDom()
        const win: any = {}
        const loading = loadTurnstileScript(doc, win)
        expect(scripts).toHaveLength(1)
        expect(scripts[0].src).toBe(TURNSTILE_SCRIPT_URL)

        win.turnstile = { render: () => 'w1' }
        scripts[0].fire('load')
        await expect(loading).resolves.toBe(win.turnstile)
    })

    it('removes a failed script so a retry downloads it again', async () => {
        const { doc, scripts } = fakeDom()
        const win: any = {}

        const first = loadTurnstileScript(doc, win)
        scripts[0].fire('error')
        await expect(first).rejects.toBeDefined()
        expect(scripts).toHaveLength(0)

        const retry = loadTurnstileScript(doc, win)
        expect(scripts).toHaveLength(1)
        win.turnstile = {}
        scripts[0].fire('load')
        await expect(retry).resolves.toBe(win.turnstile)
    })
})
