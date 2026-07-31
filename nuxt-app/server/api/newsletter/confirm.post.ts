import { performNewsletterConfirm, type NewsletterConfirmResult } from '../../utils/newsletterConfirm'

// JSON confirmation, called client-side by `pages/newsletter/confirm.vue`. POST
// (not GET) because it changes state, which is also what keeps email scanners
// and link-expanders from confirming a subscription on the recipient's behalf.
//
// The visitors this route cannot serve — JavaScript disabled or blocked, or a
// failed hydration — go through the form POST in `server/routes/newsletter/
// confirm.post.ts` instead. Both share the logic below.
export default defineEventHandler(async (event): Promise<{ status: NewsletterConfirmResult }> => {
    const body = await readBody(event)

    try {
        return { status: await performNewsletterConfirm(body?.token) }
    } catch (err: any) {
        console.error('Newsletter confirm error:', err)
        throw createError({
            statusCode: 500,
            message: 'Bei der Bestätigung ist ein Fehler aufgetreten.',
        })
    }
})
