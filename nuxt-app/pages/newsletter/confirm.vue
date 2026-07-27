<template>
    <section class="relative overflow-hidden">
        <BackgroundSpotlights position="-top-40 fixed right-[-34vw] -translate-x-1/2 transform" index="-10" />
        <BackgroundSpotlights position="-top-40 fixed left-[-6vw] -translate-x-1/2 transform" index="-10" />

        <div class="relative z-10 flex min-h-[80vh] items-center justify-center px-6 py-24 md:py-32">
            <!-- Loading (SSR resolves before paint; visible only on client navigation) -->
            <!-- Distinct keys: without them Vue reuses this <div> across the v-if/v-else
                 branches and keeps the first branch's static class/role, leaving the icon left-aligned. -->
            <div v-if="pending" key="loading" class="text-center">
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
                    <NuxtLink
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
import { getMetaInfo } from '~/helpers'
import type { NewsletterConfirmResult } from '~/server/api/newsletter/confirm.get'
import { computed } from 'vue'

const route = useRoute()

const PREVIEW_STATES: NewsletterConfirmResult[] = ['confirmed', 'already_confirmed', 'expired', 'invalid']

// Non-prod only (env-gated, off in production): jump straight to any view state
// via `?preview=<state>` so the design can be reviewed without walking the whole
// double-opt-in flow. In production the flag is false, so this is inert.
const previewEnabled = Boolean(useRuntimeConfig().public.FLAG_ENABLE_UI_PREVIEWS)
const previewState = computed<NewsletterConfirmResult | null>(() => {
    if (!previewEnabled) return null
    const p = route.query.preview
    return typeof p === 'string' && (PREVIEW_STATES as string[]).includes(p) ? (p as NewsletterConfirmResult) : null
})

// The confirmation (a status flip) runs server-side during SSR, so it happens
// exactly once per page load and the token never re-fetches on hydration. In
// preview mode there's no token, so the route returns `invalid` without touching
// Directus (no backend needed) and `previewState` overrides the result below.
// Kept `immediate` (the default) so `pending` agrees on server and client —
// disabling it made SSR render the loading branch and the client reuse that
// element, stripping the result branch's classes.
const { data, pending, error } = await useFetch('/api/newsletter/confirm', {
    query: { token: route.query.token },
})

// Preview override wins; otherwise a 500 (error) collapses to the neutral
// 'invalid' branch rather than crashing.
const status = computed<NewsletterConfirmResult>(
    () => previewState.value ?? (error.value ? 'invalid' : (data.value?.status ?? 'invalid'))
)

// One descriptor per state. The design specifies the 'confirmed' state (lime
// accent + check); expired/invalid reuse the same layout with the pink accent
// and an alert mark. Class strings are spelled out in full so Tailwind keeps them.
type View = {
    circleClass: string
    underlineClass: string
    // svg imports are typed as their module default (see other icon usages that
    // feed `<component :is>`); both icons share this type.
    icon: typeof CheckIcon
    eyebrow: string
    headline: string
    text: string
    cta: { label: string; to: string }
}

const VIEWS: Record<NewsletterConfirmResult, View> = {
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
    expired: {
        circleClass: 'bg-pink',
        underlineClass: 'border-pink',
        icon: AlertIcon,
        eyebrow: '// Link abgelaufen',
        headline: 'Link abgelaufen',
        text: 'Dieser Bestätigungslink ist nicht mehr gültig. Melde dich einfach erneut an, dann schicken wir dir einen frischen Link.',
        cta: { label: 'Erneut anmelden', to: '/' },
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
}

const view = computed<View>(() => VIEWS[status.value])

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Newsletter bestätigen',
        noIndex: true,
    })
)
</script>
