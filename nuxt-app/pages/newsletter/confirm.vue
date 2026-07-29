<template>
    <NewsletterStatusPanel
        :status="status"
        :views="VIEWS"
        :preview-states="previewStates"
        :preview-enabled="previewEnabled"
        :fallback="FALLBACK"
        loading-text="Anmeldung wird bestätigt…"
        @retry="run"
    />
</template>

<script setup lang="ts">
import AlertIcon from '~/assets/icons/alert.svg'
import CheckIcon from '~/assets/icons/check.svg'
import InfoCircleIcon from '~/assets/icons/info-circle.svg'
import type { NewsletterStatusView } from '~/composables/useNewsletterTokenAction'
import { getMetaInfo } from '~/helpers'
import type { NewsletterConfirmResult } from '~/server/utils/newsletterConfirm'

// The API results plus the view-only technical-failure state.
type ViewStatus = NewsletterConfirmResult | 'error'

const PREVIEW_STATES: ViewStatus[] = ['confirmed', 'already_confirmed', 'resent', 'invalid', 'error']

const { status, previewEnabled, previewStates, run } = useNewsletterTokenAction<ViewStatus>(
    '/api/newsletter/confirm',
    PREVIEW_STATES
)

const VIEWS: Record<ViewStatus, NewsletterStatusView> = {
    confirmed: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Newsletter bestätigt',
        headline: 'Du bist dabei!',
        text: 'Deine Anmeldung ist bestätigt. Ab jetzt bekommst du jeden Freitag die wichtigsten Dev-News, neue Folgen sowie Meetup- und Konferenz-Termine direkt in dein Postfach.',
        cta: { label: 'Zur programmier.bar', to: '/' },
    },
    already_confirmed: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: CheckIcon,
        eyebrow: '// Newsletter',
        headline: 'Schon bestätigt',
        text: 'Diese E-Mail-Adresse ist bereits für den Newsletter bestätigt. Du musst nichts weiter tun.',
        cta: { label: 'Zur programmier.bar', to: '/' },
    },
    resent: {
        circleClass: 'bg-lime',
        underlineClass: 'border-lime',
        icon: InfoCircleIcon,
        eyebrow: '// Neuer Link unterwegs',
        headline: 'Link war abgelaufen',
        text: 'Dein Bestätigungslink war nicht mehr gültig — wir haben dir gerade einen frischen Link geschickt. Bitte prüfe dein Postfach.',
        cta: { label: 'Zur Startseite', to: '/' },
    },
    invalid: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Link ungültig',
        headline: 'Link ungültig',
        text: 'Dieser Bestätigungslink konnte nicht verarbeitet werden. Bitte nutze den aktuellsten Link aus deiner E-Mail oder melde dich erneut an.',
        cta: { label: 'Zur Startseite', to: '/' },
    },
    error: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Technischer Fehler',
        headline: 'Etwas ist schiefgelaufen',
        text: 'Deine Anmeldung konnte gerade nicht bestätigt werden. Das liegt an einem vorübergehenden technischen Problem — bitte versuche es in ein paar Minuten erneut.',
        retry: true,
        cta: { label: 'Erneut versuchen', to: '/' },
    },
}

const route = useRoute()

// Confirming must not depend on JavaScript either: without this, a visitor whose
// client can't run the call is stuck on the spinner and can never subscribe. The
// panel renders it as a plain form POST to the Nitro route that shares this URL;
// it is a POST, so link scanners still cannot trigger it.
const FALLBACK = computed(() => ({
    action: '/newsletter/confirm',
    token: typeof route.query.token === 'string' ? route.query.token : '',
    label: 'Anmeldung bestätigen',
    hint: 'Passiert nichts? Dann bestätige deine Anmeldung hier:',
}))

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Newsletter bestätigen',
        noIndex: true,
    })
)
</script>
