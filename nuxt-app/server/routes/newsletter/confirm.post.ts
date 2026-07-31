import { performNewsletterConfirm } from '../../utils/newsletterConfirm'

// No-JavaScript confirmation. Shares the URL of the confirm page but only handles
// POST, so the page itself (GET) is unaffected: the form on that page submits
// here without any client-side code.
//
// Unlike the unsubscribe fallback this one is not strictly required — a
// confirmation that never happens fails safe, since no subscription is created —
// but leaving these visitors stuck on a spinner means they can never subscribe at
// all, and the double opt-in is exactly the point where a real human action is
// being recorded. A form POST keeps the protection the client-side call was there
// for: scanners and link-expanders follow links, they do not submit forms.
//
// Answers with a redirect (POST → 303 → GET) so the outcome is rendered from the
// query server-side and a reload cannot repeat the submission — which matters
// here, because a repeat on an expired link would rotate the token again and send
// a second mail.
export default defineEventHandler(async (event) => {
    // Form submissions arrive as `application/x-www-form-urlencoded`; readBody
    // parses that into an object just like it does JSON.
    const body = await readBody(event)

    let status: string
    try {
        status = await performNewsletterConfirm(body?.token)
    } catch (err: any) {
        // The page has an 'error' view for exactly this — a technical failure is
        // not the same as a dead link, and it offers another attempt.
        console.error('Newsletter confirm (form) error:', err)
        status = 'error'
    }

    return await sendRedirect(event, `/newsletter/confirm?status=${status}`, 303)
})
