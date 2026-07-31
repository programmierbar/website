<template>
    <NewsletterStatusPanel
        :status="status"
        :views="VIEWS"
        :preview-states="states"
        :preview-enabled="previewEnabled"
        :fallback="FALLBACK"
        loading-text="Abmeldung wird verarbeitet…"
        @retry="run"
    />
</template>

<script setup lang="ts">
import AlertIcon from '~/assets/icons/alert.svg'
import CheckIcon from '~/assets/icons/check.svg'
import type { NewsletterStatusView } from '~/composables/useNewsletterTokenAction'
import { getMetaInfo } from '~/helpers'
import type { NewsletterUnsubscribeResult } from '~/server/utils/newsletterUnsubscribe'

// The API results plus the view-only technical-failure state. Only used to key
// the view map below — the composable is given `NewsletterUnsubscribeResult`, so
// the posted response stays typed to what the route can actually return.
type ViewStatus = NewsletterUnsubscribeResult | 'error'

const STATES: ViewStatus[] = ['unsubscribed', 'already_unsubscribed', 'invalid', 'error']

const { status, previewEnabled, states, run } = useNewsletterTokenAction<NewsletterUnsubscribeResult>(
    '/api/newsletter/unsubscribe',
    STATES
)

const VIEWS: Record<ViewStatus, NewsletterStatusView> = {
    unsubscribed: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Newsletter abgemeldet',
        headline: 'Du bist abgemeldet',
        text: 'Deine E-Mail-Adresse wurde aus dem Newsletter-Verteiler entfernt. Du bekommst ab jetzt keine weiteren Newsletter von uns. Schade, dass du gehst!',
        cta: { label: 'Zur programmier.bar', to: '/' },
    },
    already_unsubscribed: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Newsletter',
        headline: 'Schon abgemeldet',
        text: 'Diese E-Mail-Adresse ist bereits abgemeldet. Du musst nichts weiter tun — von uns kommt kein Newsletter mehr.',
        cta: { label: 'Zur programmier.bar', to: '/' },
    },
    invalid: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Link ungültig',
        headline: 'Link ungültig',
        text: 'Dieser Abmeldelink konnte nicht verarbeitet werden. Bitte nutze den Link aus einer aktuellen Newsletter-Mail oder schreib uns kurz — wir melden dich dann von Hand ab.',
        cta: { label: 'Kontakt aufnehmen', to: '/kontakt' },
    },
    error: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Technischer Fehler',
        headline: 'Etwas ist schiefgelaufen',
        text: 'Deine Abmeldung konnte gerade nicht verarbeitet werden. Das liegt an einem vorübergehenden technischen Problem — bitte versuche es in ein paar Minuten erneut.',
        retry: true,
        cta: { label: 'Erneut versuchen', to: '/' },
    },
}

const route = useRoute()

// Opting out is the one action a recipient is always entitled to, so it must not
// depend on JavaScript being available. The panel renders this as a plain form
// POST to the Nitro route that shares this URL; it is a POST, so link scanners
// still cannot trigger it.
const FALLBACK = computed(() => ({
    action: '/newsletter/unsubscribe',
    token: typeof route.query.token === 'string' ? route.query.token : '',
    label: 'Jetzt abmelden',
    hint: 'Passiert nichts? Dann schließe die Abmeldung hier ab:',
}))

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Newsletter abmelden',
        noIndex: true,
    })
)
</script>
