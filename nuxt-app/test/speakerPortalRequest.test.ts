import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    getSpeakerPortalErrorMessage,
    getSpeakerPortalUserMessage,
    requestSpeakerPortal,
    SpeakerPortalError,
} from '../helpers/speakerPortalRequest'

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Exactly what Vercel answers when the request body exceeds its 4.5 MB limit.
const vercelPayloadTooLarge = () =>
    new Response('Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\niad1::abc', {
        status: 413,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-vercel-error': 'FUNCTION_PAYLOAD_TOO_LARGE' },
    })

const fetchMock = vi.fn()

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

async function messageFor(response: Response | Error): Promise<string> {
    if (response instanceof Error) {
        fetchMock.mockRejectedValue(response)
    } else {
        fetchMock.mockResolvedValue(response)
    }
    const error: unknown = await requestSpeakerPortal('/api/speaker-portal/submit').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(SpeakerPortalError)
    return (error as SpeakerPortalError).message
}

describe('requestSpeakerPortal', () => {
    it('returns the JSON body of a successful response', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { success: true }))
        await expect(requestSpeakerPortal('/api/speaker-portal/submit')).resolves.toEqual({ success: true })
    })

    // Regression: the portal used to call response.json() on this and show the SyntaxError.
    it('maps a plain-text Vercel 413 to a friendly message instead of a JSON parse error', async () => {
        const message = await messageFor(vercelPayloadTooLarge())
        expect(message).toContain('zu groß')
        expect(message).not.toMatch(/JSON|Entity|FUNCTION_/)
        expect(console.error).toHaveBeenCalled()
    })

    it('maps an HTML or plain-text 5xx to the generic message', async () => {
        const html = new Response('<!DOCTYPE html><html>Gateway Timeout</html>', {
            status: 504,
            headers: { 'content-type': 'text/html' },
        })
        expect(await messageFor(html)).toMatch(/^Da ist leider etwas schiefgelaufen\..*podcast@programmier\.bar\.$/)
    })

    it('never shows the message of a JSON 500', async () => {
        const message = await messageFor(jsonResponse(500, { message: 'NUXT_DIRECTUS_API_TOKEN not configured' }))
        expect(message).not.toContain('NUXT_DIRECTUS_API_TOKEN')
        expect(message).toMatch(/^Da ist leider etwas schiefgelaufen/)
    })

    it("passes our handler's message through for deliberate 4xx answers", async () => {
        const message = await messageFor(
            jsonResponse(409, { message: 'Du hast deine Informationen bereits eingereicht.' })
        )
        expect(message).toBe('Du hast deine Informationen bereits eingereicht.')
    })

    it('maps a network failure to a connection hint', async () => {
        expect(await messageFor(new TypeError('Load failed'))).toContain('Internetverbindung')
    })

    it('rejects a successful response that is not JSON', async () => {
        const message = await messageFor(new Response('<html></html>', { status: 200 }))
        expect(message).toMatch(/^Da ist leider etwas schiefgelaufen/)
    })
})

describe('getSpeakerPortalErrorMessage', () => {
    it.each([400, 404, 409, 410])('has a fallback sentence for %i without a server message', (status) => {
        const message = getSpeakerPortalErrorMessage(status, undefined)
        expect(message).toMatch(/\.$/)
        expect(message).not.toMatch(/^Da ist leider/)
    })

    it('ignores a server message for 413', () => {
        expect(getSpeakerPortalErrorMessage(413, { message: 'Payload Too Large' })).toContain('zu groß')
    })
})

describe('getSpeakerPortalUserMessage', () => {
    it('never exposes the message of an unexpected error', () => {
        const message = getSpeakerPortalUserMessage(new SyntaxError('JSON.parse: unexpected character'))
        expect(message).not.toContain('JSON')
        expect(message).toMatch(/^Da ist leider etwas schiefgelaufen/)
    })
})
