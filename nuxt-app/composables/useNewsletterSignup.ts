import { sleep } from '~/helpers'
import { reactive, ref } from 'vue'

export type NewsletterSignupStatus = 'idle' | 'loading' | 'success' | 'exists' | 'error'

/**
 * Composable that owns the newsletter double-opt-in signup flow.
 *
 * It is the single integration point for the backend: today `subscribe`
 * simulates the states the design describes (loading → success, and an
 * "already subscribed" branch), so the UI can be built and reviewed without a
 * live provider. Wire the real request in the marked block below — the public
 * API (`status`, `subscribe`, `reset`) should not need to change.
 *
 * @returns Reactive signup state and actions.
 */
export function useNewsletterSignup() {
    const status = ref<NewsletterSignupStatus>('idle')

    /**
     * It validates an email address well enough for a signup form. The
     * authoritative check happens server-side once the backend is wired up.
     */
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim())

    /**
     * It submits an email address to the newsletter.
     *
     * @param email The address to subscribe.
     */
    const subscribe = async (email: string) => {
        const value = (email || '').trim()

        if (!isValidEmail(value)) {
            status.value = 'error'
            return
        }

        // --- Backend integration point -------------------------------------
        // Replace this simulated flow with a real request (e.g. a Nuxt server
        // route wrapped in this composable). It should resolve to one of:
        //   - 'success' → double-opt-in mail sent
        //   - 'exists'  → address already subscribed
        // and throw / set 'error' on failure.
        if (/^test@/i.test(value) || /exist/i.test(value)) {
            status.value = 'exists'
            return
        }

        status.value = 'loading'
        await sleep(1300)
        status.value = 'success'
        // -------------------------------------------------------------------
    }

    /**
     * It resets the flow back to the empty form (e.g. to change the address).
     */
    const reset = () => {
        status.value = 'idle'
    }

    return reactive({
        status,
        isValidEmail,
        subscribe,
        reset,
    })
}
