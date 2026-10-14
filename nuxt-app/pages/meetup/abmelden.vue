<template>
    <NewsletterStatusPanel
        :status="status"
        :views="VIEWS"
        :preview-states="states"
        :preview-enabled="previewEnabled"
        :fallback="FALLBACK"
        loading-text="Absage wird verarbeitet…"
        @retry="run"
    />
</template>

<script setup lang="ts">
import AlertIcon from '~/assets/icons/alert.svg'
import CheckIcon from '~/assets/icons/check.svg'
import type { NewsletterStatusView } from '~/composables/useNewsletterTokenAction'
import { getMetaInfo } from '~/helpers'
import type { MeetupRegistrationCancelResult } from '~/server/utils/meetupRegistration'

// Cancel link from the meetup confirmation mail. Same token flow as the
// newsletter pages (client-side POST, no-JS form fallback), so it reuses their
// composable and panel.
type ViewStatus = MeetupRegistrationCancelResult | 'error'

const STATES: ViewStatus[] = ['cancelled', 'already_cancelled', 'invalid', 'error']

const { status, previewEnabled, states, run } = useNewsletterTokenAction<MeetupRegistrationCancelResult>(
    '/api/meetup-registration/cancel',
    STATES
)

const VIEWS: Record<ViewStatus, NewsletterStatusView> = {
    cancelled: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Meetup abgesagt',
        headline: 'Danke für deine Absage',
        text: 'Deine Teilnahme ist abgesagt, damit kann jemand anderes deinen Platz bekommen. Schade, dass es diesmal nicht klappt – vielleicht beim nächsten Meetup!',
        cta: { label: 'Zu den Meetups', to: '/meetup' },
    },
    already_cancelled: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Meetup',
        headline: 'Schon abgesagt',
        text: 'Diese Anmeldung ist bereits abgesagt. Du musst nichts weiter tun.',
        cta: { label: 'Zu den Meetups', to: '/meetup' },
    },
    invalid: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Link ungültig',
        headline: 'Link ungültig',
        text: 'Dieser Link konnte nicht verarbeitet werden. Bitte nutze den Link aus deiner Bestätigungsmail oder schreib uns kurz, dann sagen wir für dich ab.',
        cta: { label: 'Kontakt aufnehmen', to: '/kontakt' },
    },
    error: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Technischer Fehler',
        headline: 'Etwas ist schiefgelaufen',
        text: 'Deine Absage konnte gerade nicht verarbeitet werden. Das liegt an einem vorübergehenden technischen Problem. Bitte versuche es in ein paar Minuten erneut.',
        retry: true,
        cta: { label: 'Erneut versuchen', to: '/' },
    },
}

const route = useRoute()

const FALLBACK = computed(() => ({
    action: '/meetup/abmelden',
    token: typeof route.query.token === 'string' ? route.query.token : '',
    label: 'Teilnahme absagen',
    hint: 'Passiert nichts? Dann schließe die Absage hier ab:',
}))

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Meetup-Teilnahme absagen',
        noIndex: true,
    })
)
</script>
