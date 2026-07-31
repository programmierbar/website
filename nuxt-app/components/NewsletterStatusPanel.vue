<template>
    <section class="relative overflow-hidden">
        <!-- Ambient brand spotlights behind the content (see index.vue) -->
        <BackgroundSpotlights position="-top-40 fixed right-[-34vw] -translate-x-1/2 transform" index="-10" />
        <BackgroundSpotlights position="-top-40 fixed left-[-6vw] -translate-x-1/2 transform" index="-10" />

        <div class="relative z-10 flex min-h-[80vh] items-center justify-center px-6 py-24 md:py-32">
            <!-- Loading: the SSR/initial render. The state-changing call runs
                 client-side (see useNewsletterTokenAction) so crawlers, scanners
                 and prefetchers — which don't run JS — never trigger it. -->
            <div v-if="status === 'loading'" key="loading" class="max-w-[600px] text-center">
                <p class="text-xl font-light text-shade-200">{{ loadingText }}</p>

                <!-- Works entirely without JavaScript: when it is disabled,
                     blocked, or hydration failed, the client-side call never
                     runs and this is the only way to act. Rendered as part of
                     the loading state on purpose — it is also the escape hatch
                     if that call hangs. A POST (never a GET) keeps the scanner
                     protection intact. -->
                <form v-if="fallback" :action="fallback.action" method="post" class="mt-10">
                    <input type="hidden" name="token" :value="fallback.token" />
                    <p class="text-base font-light leading-normal text-shade-400">{{ fallback.hint }}</p>
                    <button type="submit" :class="CTA_CLASS" class="mt-6" data-cursor-hover>
                        {{ fallback.label }}
                    </button>
                </form>
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
                    <!-- Retrying must survive a missing client too: with a
                         fallback the retry is a real form submit, so it works
                         with and without JavaScript (this is the state a no-JS
                         visitor lands on when the form POST hit a failure). -->
                    <form v-if="view.retry && fallback" :action="fallback.action" method="post">
                        <input type="hidden" name="token" :value="fallback.token" />
                        <button type="submit" :class="CTA_CLASS" data-cursor-hover>
                            {{ view.cta.label }}
                        </button>
                    </form>
                    <button
                        v-else-if="view.retry"
                        type="button"
                        :class="CTA_CLASS"
                        data-cursor-hover
                        @click="emit('retry')"
                    >
                        {{ view.cta.label }}
                    </button>
                    <NuxtLink v-else :to="view.cta.to" :class="CTA_CLASS" data-cursor-hover>
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
                v-for="state in previewStates"
                :key="state"
                :to="{ query: { preview: state } }"
                class="rounded-full px-3 py-1 text-xs font-bold transition-colors"
                :class="status === state ? 'bg-lime text-black' : 'text-shade-200 hover:text-blue'"
                data-cursor-hover
            >
                {{ state }}
            </NuxtLink>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { NewsletterStatusView } from '~/composables/useNewsletterTokenAction'
import { computed } from 'vue'

/**
 * Shared result page for the token-driven newsletter flows (confirm,
 * unsubscribe): status icon, headline, copy and CTA, plus the non-prod state
 * switcher. Each page supplies its own `views` map and keeps the flow logic in
 * `useNewsletterTokenAction`.
 */
const props = withDefaults(
    defineProps<{
        /** Current state; 'loading' renders the neutral placeholder. */
        status: string
        /** Copy and styling per state, keyed by status. */
        views: Record<string, NewsletterStatusView>
        /** States offered by the preview switcher (non-prod only). */
        previewStates?: readonly string[]
        previewEnabled?: boolean
        loadingText?: string
        /**
         * Makes the action available without JavaScript, as a form POST to
         * `action` carrying `token`. Both token flows set it — the action has to
         * stay reachable when the client-side call can't run at all. Setting it
         * also turns a `retry` CTA into a form submit, so recovering from the
         * error state needs no client either. Omit it and the panel behaves as
         * it did before the fallback existed.
         */
        fallback?: { action: string; token: string; label: string; hint: string }
    }>(),
    {
        previewStates: () => [],
        previewEnabled: false,
        loadingText: 'Einen Moment…',
        fallback: undefined,
    }
)

// One pill for every CTA shape the panel renders (link, retry button, form
// submit), so they cannot drift apart visually.
const CTA_CLASS =
    'inline-flex h-[58px] items-center rounded-full bg-lime px-8 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-blue hover:text-white'

const emit = defineEmits<{ retry: [] }>()

const view = computed<NewsletterStatusView>(() => props.views[props.status] as NewsletterStatusView)
</script>
