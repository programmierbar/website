import { computed, onMounted, type ComputedRef } from 'vue'

/**
 * Reactive "now" that survives SSR hydration without mismatches.
 *
 * The SSR-render timestamp is serialized into the Nuxt payload, so the initial
 * client render at hydration time agrees with the prerendered HTML. Immediately
 * after mount the value is refreshed to the client's actual current time,
 * triggering a post-hydration re-render of anything that derives from it.
 *
 * Read this anywhere you'd otherwise reach for `new Date()` inside a computed
 * or template — `isEarlyBird`, `isPast`, countdowns, etc.
 */
export function useNow(): ComputedRef<Date> {
    const nowMs = useState<number>('now', () => Date.now())

    onMounted(() => {
        nowMs.value = Date.now()
    })

    return computed(() => new Date(nowMs.value))
}
