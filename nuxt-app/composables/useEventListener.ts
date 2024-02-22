/* eslint-disable no-redeclare */
import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * Composable to add an event listener to an HTML
 * element, the document or window object.
 *
 * @param target The event target.
 * @param type The event type.
 * @param listener The event listener.
 */
export function useEventListener<T extends HTMLElement, U extends HTMLElementEventMap, V extends keyof U>(
    target: Ref<T | undefined | null>,
    type: V,
    listener: (this: T, event: U[V]) => any
): void
export function useEventListener<T extends MediaQueryList, U extends MediaQueryListEventMap, V extends keyof U>(
    target: Ref<T | undefined | null>,
    type: V,
    listener: (this: T, event: U[V]) => any
): void
export function useEventListener<T extends Document, U extends DocumentEventMap, V extends keyof U>(
    target: Ref<T | undefined | null>,
    type: V,
    listener: (this: T, event: U[V]) => any
): void
export function useEventListener<T extends Window, U extends WindowEventMap, V extends keyof U>(
    target: Ref<T | undefined | null>,
    type: V,
    listener: (this: T, event: U[V]) => any
): void
export function useEventListener(target: Ref<any>, type: any, listener: any) {
    // Add event listener to target when component has been mounted
    onMounted(() => {
        if (target.value) {
            target.value.addEventListener(type, listener)
        }
    })

    // Remove event listener from target before component is unmounted
    onBeforeUnmount(() => {
        if (target.value) {
            target.value.removeEventListener(type, listener as EventListenerOrEventListenerObject)
        }
    })

    // Update event listener when target changes
    watch(target, (newTarget, prevTarget) => {
        if (prevTarget) {
            prevTarget.removeEventListener(type, listener)
        }
        if (newTarget) {
            newTarget.addEventListener(type, listener)
        }
    })
}
