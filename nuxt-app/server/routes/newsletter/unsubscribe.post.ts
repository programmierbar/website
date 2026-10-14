import { performNewsletterUnsubscribe } from '../../utils/newsletterUnsubscribe'

// No-JavaScript opt-out. Shares the URL of the unsubscribe page but only handles
// POST, so the page itself (GET) is unaffected: the form on that page submits
// here without any client-side code.
//
// Opting out must work for everyone — it is the one action a recipient is always
// entitled to — and the page's client-side call cannot serve visitors with
// JavaScript disabled or blocked, or a hydration that failed. A form POST keeps
// the protection the client-side call was there for: scanners and link-expanders
// follow links, they do not submit forms.
//
// Answers with a redirect (POST → 303 → GET) so the outcome is rendered from the
// query server-side and a reload cannot repeat the submission.
//
// The same URL is the target of the `List-Unsubscribe` header in newsletter mails,
// so it also handles RFC 8058 one-click opt-outs: the mail provider POSTs the body
// `List-Unsubscribe=One-Click` to the link, with the token only in the query. That
// request comes from a server, not a browser, and only its status code counts, so it
// gets a plain 200 instead of a redirect (and a 500 on a technical failure, so the
// provider can retry). There is no CSRF check on this route to get in the way.
// The fields of the POST body. The page's form and most one-click senders use
// `application/x-www-form-urlencoded`, which readBody parses like JSON; RFC 8058
// also allows `multipart/form-data`, which readBody does not decode.
async function readUnsubscribeFields(event: Parameters<typeof readBody>[0]): Promise<Record<string, unknown>> {
    const contentType = getRequestHeader(event, 'content-type') ?? ''
    if (contentType.toLowerCase().startsWith('multipart/form-data')) {
        const fields: Record<string, string> = {}
        for (const part of (await readMultipartFormData(event)) ?? []) {
            if (part.name && !part.filename) {
                fields[part.name] = part.data.toString('utf8')
            }
        }
        return fields
    }
    return (await readBody(event)) ?? {}
}

export default defineEventHandler(async (event) => {
    const body = await readUnsubscribeFields(event)
    const isOneClick = body?.['List-Unsubscribe'] === 'One-Click'
    // The page's form sends the token in the body; a one-click POST only has the
    // link's query.
    const token = body?.token ?? getQuery(event).token

    let status: string
    try {
        status = await performNewsletterUnsubscribe(token)
    } catch (err: any) {
        // The page has an 'error' view for exactly this — a technical failure is
        // not the same as a dead link, and it offers another attempt.
        console.error('Newsletter unsubscribe (form) error:', err)
        status = 'error'
    }

    if (isOneClick) {
        if (status === 'error') {
            throw createError({ statusCode: 500, message: 'Bei der Abmeldung ist ein Fehler aufgetreten.' })
        }
        // Unknown tokens stay a neutral 200 here too — no enumeration.
        return { status }
    }

    return await sendRedirect(event, `/newsletter/unsubscribe?status=${status}`, 303)
})
