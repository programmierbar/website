import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * Composable for observing DOM changes of an
 * HTML element with a mutation observer.
 *
 * @param target The observation target.
 * @param listener The observation listener.
 * @param options The observation options.
 */
export function useMutationObserver<T extends HTMLElement>(
    target: Ref<T | undefined | null>,
    listener: MutationCallback,
    options?: MutationObserverInit | undefined
) {
    let mutationObserver: MutationObserver

    onMounted(() => {
        if (target.value) {
            mutationObserver = new MutationObserver(listener)
            mutationObserver.observe(target.value, options)
        }
    })

    onBeforeUnmount(() => {
        mutationObserver?.disconnect()
    })

    watch(target, () => {
        mutationObserver?.disconnect()
        if (target.value) {
            mutationObserver = new MutationObserver(listener)
            mutationObserver.observe(target.value, options)
        }
    })
}
