import type { FunctionalComponent, SVGAttributes } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'

// `*.svg` imports are components at runtime but typed as their module default,
// so accept either shape here.
export type NewsletterStatusIcon = FunctionalComponent<SVGAttributes> | string

/** One rendered outcome of a token action — see `NewsletterStatusPanel`. */
export type NewsletterStatusView = {
    circleClass: string
    underlineClass: string
    icon: NewsletterStatusIcon
    eyebrow: string
    headline: string
    text: string
    /** Renders the CTA as a retry button instead of a link. */
    retry?: boolean
    cta: { label: string; to: string }
}

export type NewsletterTokenActionStatus<TResult extends string> = TResult | 'loading' | 'error'

/**
 * Composable behind the token-driven newsletter pages (confirm, unsubscribe).
 *
 * Both flows are the same shape: an emailed link carries a `?token=`, the page
 * hands it to a POST route and renders the returned status. The shared piece
 * that matters is *when* the call happens: it runs on the client only, in
 * `onMounted`, and never during SSR. These endpoints change state, and email
 * scanners, link-expanders and prefetchers request URLs without running JS —
 * so keeping the call client-side is what stops them from confirming or
 * unsubscribing on the recipient's behalf.
 *
 * @param endpoint Server route to post the token to.
 * @param previewStates States selectable via `?preview=` (non-prod only).
 */
export function useNewsletterTokenAction<TResult extends string>(
    endpoint: string,
    previewStates: readonly NewsletterTokenActionStatus<TResult>[]
) {
    const route = useRoute()

    // Non-prod only (env-gated, off in production): jump straight to any view
    // state via `?preview=<state>` so the design can be reviewed without walking
    // the whole flow. In production the flag is false, so this is inert.
    const previewEnabled = Boolean(useRuntimeConfig().public.FLAG_ENABLE_UI_PREVIEWS)
    const previewState = computed<NewsletterTokenActionStatus<TResult> | null>(() => {
        if (!previewEnabled) return null
        const preview = route.query.preview
        if (typeof preview !== 'string') return null
        return (previewStates as readonly string[]).includes(preview)
            ? (preview as NewsletterTokenActionStatus<TResult>)
            : null
    })

    // Start on the preview state when previewing (so SSR and client agree),
    // otherwise 'loading' until the client-side call resolves.
    const status = ref<NewsletterTokenActionStatus<TResult>>(previewState.value ?? 'loading')

    // The page stays mounted when the preview switcher changes `?preview=`, so
    // re-derive the view on query changes (preview-only; in production
    // previewState is always null and this never fires).
    watch(previewState, (state) => {
        if (state) status.value = state
    })

    /** It posts the token from the URL and maps the result onto `status`. */
    async function run() {
        status.value = 'loading'

        try {
            // A missing or malformed token is not checked here on purpose: the
            // route answers 'invalid' for it without touching Directus, so what
            // counts as an unusable link is defined in exactly one place.
            const token = typeof route.query.token === 'string' ? route.query.token : ''
            const result = await $fetch<{ status: TResult }>(endpoint, {
                method: 'POST',
                body: { token },
            })
            status.value = result.status
        } catch {
            // A technical failure (Directus down, misconfiguration) is distinct
            // from a dead link — the view offers a retry instead of blaming the
            // link.
            status.value = 'error'
        }
    }

    onMounted(() => {
        if (previewState.value) return
        run()
    })

    return { status, previewEnabled, previewStates, run }
}
