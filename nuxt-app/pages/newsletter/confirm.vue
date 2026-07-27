<template>
    <section class="relative overflow-hidden">
        <!-- Ambient brand spotlights behind the content (see index.vue) -->
        <BackgroundSpotlights position="-top-40 fixed right-[-34vw] -translate-x-1/2 transform" index="-10" />
        <BackgroundSpotlights position="-top-40 fixed left-[-6vw] -translate-x-1/2 transform" index="-10" />

        <div class="relative z-10 flex min-h-[80vh] items-center justify-center px-6 py-24 md:py-32">
            <!-- Loading: the SSR/initial render. Confirmation runs client-side (see
                 script) so crawlers, scanners and prefetchers — which don't run JS —
                 never trigger the state change. -->
            <div v-if="status === 'loading'" key="loading" class="text-center">
                <p class="text-xl font-light text-shade-200">Anmeldung wird bestätigt…</p>
            </div>

            <div v-else key="result" class="flex max-w-[600px] flex-col items-center text-center" role="status">
                <!-- Status icon -->
                <div
                    class="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full"
                    :class="view.circleClass"
                >
                    <component :is="view.icon" class="h-[46px] w-[46px] text-black" aria-hidden="true" />
                </div>

                <!-- Eyebrow -->
                <div class="mt-9 font-azeret text-sm uppercase tracking-[0.15em] text-blue">
                    {{ view.eyebrow }}
                </div>

                <!-- Headline with signature lime/pink underline -->
                <h1
                    class="mt-4 inline-block border-b-[6px] pb-3 text-4xl font-black leading-[1.05] tracking-[-0.01em] text-white md:text-[44px]"
                    :class="view.underlineClass"
                >
                    {{ view.headline }}
                </h1>

                <!-- Body copy -->
                <p class="mt-7 text-xl font-light leading-normal text-shade-200">
                    {{ view.text }}
                </p>

                <!-- CTA -->
                <div class="mt-10">
                    <button
                        v-if="status === 'error'"
                        type="button"
                        class="inline-flex h-[58px] items-center rounded-full bg-lime px-8 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-blue hover:text-white"
                        data-cursor-hover
                        @click="runConfirm"
                    >
                        Erneut versuchen
                    </button>
                    <NuxtLink
                        v-else
                        :to="view.cta.to"
                        class="inline-flex h-[58px] items-center rounded-full bg-lime px-8 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-blue hover:text-white"
                        data-cursor-hover
                    >
                        {{ view.cta.label }}
                    </NuxtLink>
                </div>
            </div>
        </div>

        <!-- Non-prod state switcher (env-gated); lets us review every state without the flow. -->
        <div
            v-if="previewEnabled"
            class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-shade-800 bg-gray-900/95 px-2 py-1.5"
        >
            <span class="px-2 font-azeret text-[10px] uppercase tracking-widest text-shade-400">Preview</span>
            <NuxtLink
                v-for="s in PREVIEW_STATES"
                :key="s"
                :to="{ query: { preview: s } }"
                class="rounded-full px-3 py-1 text-xs font-bold transition-colors"
                :class="status === s ? 'bg-lime text-black' : 'text-shade-200 hover:text-blue'"
                data-cursor-hover
            >
                {{ s }}
            </NuxtLink>
        </div>
    </section>
</template>

<script setup lang="ts">
import AlertIcon from '~/assets/icons/alert.svg'
import CheckIcon from '~/assets/icons/check.svg'
import InfoCircleIcon from '~/assets/icons/info-circle.svg'
import { getMetaInfo } from '~/helpers'
import type { NewsletterConfirmResult } from '~/server/api/newsletter/confirm.post'
import { computed, onMounted, ref, watch } from 'vue'

// UI states: the API results plus two view-only states.
type ViewStatus = NewsletterConfirmResult | 'loading' | 'error'

const route = useRoute()

const PREVIEW_STATES: ViewStatus[] = ['confirmed', 'already_confirmed', 'resent', 'invalid', 'error']

// Non-prod only (env-gated, off in production): jump straight to any view state
// via `?preview=<state>` so the design can be reviewed without walking the whole
// double-opt-in flow. In production the flag is false, so this is inert.
const previewEnabled = Boolean(useRuntimeConfig().public.FLAG_ENABLE_UI_PREVIEWS)
const previewState = computed<ViewStatus | null>(() => {
    if (!previewEnabled) return null
    const p = route.query.preview
    return typeof p === 'string' && (PREVIEW_STATES as string[]).includes(p) ? (p as ViewStatus) : null
})

// Start on the preview state when previewing (so SSR and client agree), otherwise
// 'loading' until the client-side confirmation resolves.
const status = ref<ViewStatus>(previewState.value ?? 'loading')

// The page stays mounted when the preview switcher changes `?preview=`, so
// re-derive the view from previewState on query changes (preview-only; in prod
// previewState is always null and this never fires).
watch(previewState, (s) => {
    if (s) status.value = s
})

// Confirmation is a state-changing call, so it must NOT run during SSR — an
// email scanner or link prefetcher requesting the URL would confirm without the
// recipient acting, defeating double opt-in. Running it only on the client (like
// PodcastRating's vote) keeps non-JS agents from ever triggering it.
async function runConfirm() {
    const token = route.query.token
    if (typeof token !== 'string' || token.length === 0) {
        status.value = 'invalid'
        return
    }

    status.value = 'loading'
    try {
        const result = await $fetch<{ status: NewsletterConfirmResult }>('/api/newsletter/confirm', {
            method: 'POST',
            body: { token },
        })
        status.value = result.status
    } catch {
        // A technical failure (Directus down, token misconfigured) is distinct
        // from a bad link — offer a retry rather than "Link ungültig".
        status.value = 'error'
    }
}

onMounted(() => {
    if (previewState.value) return
    runConfirm()
})

type View = {
    circleClass: string
    underlineClass: string
    // svg imports are typed as their module default; all icons share this type.
    icon: typeof CheckIcon
    eyebrow: string
    headline: string
    text: string
    cta: { label: string; to: string }
}

const VIEWS: Record<Exclude<ViewStatus, 'loading'>, View> = {
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
        cta: { label: 'Erneut versuchen', to: '/' },
    },
}

// `status` is only ever a VIEWS key here (the loading branch renders separately).
const view = computed<View>(() => VIEWS[status.value as Exclude<ViewStatus, 'loading'>])

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Newsletter bestätigen',
        noIndex: true,
    })
)
</script>
