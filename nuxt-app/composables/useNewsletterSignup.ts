import { reactive, ref } from 'vue'
import { z } from 'zod'

export type NewsletterSignupStatus = 'idle' | 'loading' | 'success' | 'error'

const emailSchema = z.string().email()

/**
 * Composable that owns the newsletter double-opt-in signup flow.
 *
 * It is the single integration point for the backend: `subscribe` posts to the
 * `/api/newsletter/subscribe` server route (which holds the authenticated
 * Directus client and enforces spam prevention) and maps its response onto the
 * UI states the design describes.
 *
 * @returns Reactive signup state and actions.
 */
export function useNewsletterSignup() {
    const status = ref<NewsletterSignupStatus>('idle')
    // Human-readable reason shown in the `error` state — differs for a failed
    // client-side check vs. a server failure.
    const message = ref('')

    /**
     * It validates an email address well enough for a signup form. The
     * authoritative check happens server-side in the route.
     */
    const isValidEmail = (email: string) => emailSchema.safeParse((email || '').trim()).success

    /**
     * It submits an email address to the newsletter.
     *
     * @param email The address to subscribe.
     * @param honeypot Value of the hidden anti-bot field; empty for humans.
     */
    const subscribe = async (email: string, honeypot = '') => {
        const value = (email || '').trim()

        if (!isValidEmail(value)) {
            message.value = 'Bitte gib eine gültige E-Mail-Adresse ein.'
            status.value = 'error'
            return
        }

        status.value = 'loading'

        try {
            // The route returns an identical success response whether the
            // address is new or already subscribed, so the form can't be used
            // to probe whether a given email is on the list (enumeration).
            await $fetch('/api/newsletter/subscribe', {
                method: 'POST',
                body: { email: value, honeypot },
            })
            status.value = 'success'
        } catch {
            message.value = 'Es hat leider nicht geklappt. Bitte versuche es später erneut.'
            status.value = 'error'
        }
    }

    /**
     * It resets the flow back to the empty form (e.g. to change the address).
     */
    const reset = () => {
        status.value = 'idle'
        message.value = ''
    }

    return reactive({
        status,
        message,
        isValidEmail,
        subscribe,
        reset,
    })
}
