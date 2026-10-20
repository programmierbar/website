export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Load the Cloudflare Turnstile script once and resolve with its API. A failed
 * download removes its script element again: otherwise the next attempt (the
 * widget remounts after a failed submit) would find it and wait for events that
 * already fired, so retrying could never recover once the network is back.
 */
export function loadTurnstileScript(doc: Document = document, win: any = window): Promise<any> {
    if (win.turnstile) return Promise.resolve(win.turnstile)

    return new Promise((resolve, reject) => {
        const existing = doc.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
        const script = existing ?? doc.createElement('script')
        script.addEventListener('load', () => resolve(win.turnstile))
        script.addEventListener('error', (error) => {
            script.remove()
            reject(error)
        })
        if (!existing) {
            script.src = TURNSTILE_SCRIPT_URL
            script.async = true
            doc.head.appendChild(script)
        }
    })
}
