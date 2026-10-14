import type { MeetupRegistrationState } from 'shared-code'
import { reactive, ref } from 'vue'

export type MeetupRegistrationPhase = 'loading' | 'unavailable' | 'ready' | 'submitting' | 'success' | 'error'

export interface MeetupRegistrationFormData {
    first_name: string
    last_name: string
    email: string
    pronouns: string
    job_title: string
    company: string
    heard_about_from: string
    heard_about_other: string
    /** '' = keine Angabe */
    has_meetup_account: '' | 'yes' | 'no'
    wants_meetup_updates: boolean
    honeypot: string
}

interface Availability {
    state: MeetupRegistrationState
    spotsLeft: number | null
    formToken: string | null
    turnstileSiteKey: string | null
}

/**
 * Composable behind `MeetupRegistrationForm`: loads whether the meetup still
 * takes registrations (plus the form token the register route requires) and
 * submits the form. Runs client-side only, because the meetup page is
 * ISR-cached and availability must be current.
 */
export function useMeetupRegistration(meetupId: string) {
    const phase = ref<MeetupRegistrationPhase>('loading')
    const state = ref<MeetupRegistrationState | null>(null)
    const spotsLeft = ref<number | null>(null)
    const turnstileSiteKey = ref<string | null>(null)
    const message = ref('')
    let formToken: string | null = null

    async function load() {
        phase.value = 'loading'
        message.value = ''
        try {
            const availability = await $fetch<Availability>('/api/meetup-registration/availability', {
                query: { meetup: meetupId },
            })
            state.value = availability.state
            spotsLeft.value = availability.spotsLeft
            turnstileSiteKey.value = availability.turnstileSiteKey
            formToken = availability.formToken
            phase.value = formToken ? 'ready' : 'unavailable'
        } catch {
            message.value = 'Die Anmeldung konnte gerade nicht geladen werden.'
            phase.value = 'error'
        }
    }

    async function submit(form: MeetupRegistrationFormData, turnstileToken: string | null) {
        phase.value = 'submitting'
        message.value = ''
        try {
            await $fetch('/api/meetup-registration/register', {
                method: 'POST',
                body: {
                    meetupId,
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    pronouns: form.pronouns,
                    job_title: form.job_title,
                    company: form.company,
                    heard_about_from: form.heard_about_from,
                    heard_about_other: form.heard_about_other,
                    has_meetup_account: form.has_meetup_account === '' ? null : form.has_meetup_account === 'yes',
                    wants_meetup_updates: form.wants_meetup_updates,
                    honeypot: form.honeypot,
                    formToken,
                    turnstileToken,
                },
            })
            phase.value = 'success'
        } catch (error: any) {
            const data = error?.data
            // Became full or closed while the form was open.
            if (data?.data?.state === 'full' || data?.data?.state === 'closed') {
                state.value = data.data.state
            }
            message.value = data?.message || 'Die Anmeldung hat leider nicht geklappt. Bitte versuche es später erneut.'
            phase.value = state.value === 'closed' ? 'unavailable' : 'ready'
            return false
        }
        return true
    }

    return reactive({ phase, state, spotsLeft, turnstileSiteKey, message, load, submit })
}
