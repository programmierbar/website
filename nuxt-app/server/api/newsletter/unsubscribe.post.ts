import { performNewsletterUnsubscribe, type NewsletterUnsubscribeResult } from '../../utils/newsletterUnsubscribe'

// JSON opt-out, called client-side by `pages/newsletter/unsubscribe.vue`. POST
// (not GET) because it changes state, which is also what keeps email scanners
// and link-expanders from opting someone out on their behalf.
//
// The visitors this route cannot serve — JavaScript disabled or blocked, or a
// failed hydration — go through the form POST in `server/routes/newsletter/
// unsubscribe.post.ts` instead. Both share the logic below.
export default defineEventHandler(async (event): Promise<{ status: NewsletterUnsubscribeResult }> => {
    const body = await readBody(event)

    try {
        return { status: await performNewsletterUnsubscribe(body?.token) }
    } catch (err: any) {
        console.error('Newsletter unsubscribe error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Abmeldung ist ein Fehler aufgetreten.',
        })
    }
})
