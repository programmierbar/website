import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * Composable for observing the visibility of an
 * HTML element with a intersection observer.
 *
 * @param target The observation target.
 * @param listener The observation listener.
 * @param options The observation options.
 */
export function useIntersectionObserver<T extends HTMLElement>(
    target: Ref<T | undefined | null>,
    listener: IntersectionObserverCallback,
    options?: IntersectionObserverInit | undefined
): { disconnect: () => void } {
    let intersectionObserver: IntersectionObserver

    onMounted(() => {
        if (target.value) {
            intersectionObserver = new IntersectionObserver(listener)
            intersectionObserver.observe(target.value)
        }
    })

    onBeforeUnmount(() => {
        intersectionObserver?.disconnect()
    })

    watch(target, () => {
        intersectionObserver?.disconnect()
        if (target.value) {
            intersectionObserver = new IntersectionObserver(listener, options)
            intersectionObserver.observe(target.value)
        }
    })

    const disconnect = () => {
        intersectionObserver?.disconnect()
    }

    return { disconnect }
}
