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
export default defineEventHandler(async (event) => {
    // Form submissions arrive as `application/x-www-form-urlencoded`; readBody
    // parses that into an object just like it does JSON.
    const body = await readBody(event)

    let status: string
    try {
        status = await performNewsletterUnsubscribe(body?.token)
    } catch (err: any) {
        // The page has an 'error' view for exactly this — a technical failure is
        // not the same as a dead link, and it offers another attempt.
        console.error('Newsletter unsubscribe (form) error:', err)
        status = 'error'
    }

    return await sendRedirect(event, `/newsletter/unsubscribe?status=${status}`, 303)
})
