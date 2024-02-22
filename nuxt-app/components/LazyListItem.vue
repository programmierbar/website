<template>
    <li ref="itemElement">
        <slot :is-new-to-viewport="isNewToViewport" />
    </li>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { computed, defineComponent, ref } from 'vue'
import { useIntersectionObserver } from '../composables'

export default defineComponent({
    props: {
        item: {
            type: Object as PropType<any>,
            required: true,
        },
        viewportItems: {
            type: Set as PropType<Set<unknown>>,
            required: true,
        },
        addViewportItem: {
            type: Function as PropType<(item: unknown) => void>,
            required: true,
        },
    },
    setup(props) {
        // Create item element reference
        const itemElement = ref<HTMLDivElement>()

        // Check if item is new to viewport
        const isNewToViewport = !props.viewportItems.has(props.item)

        // Create observation target
        const observationTarget = computed(() => (isNewToViewport ? itemElement.value : null))

        /**
         * It handels the visibility and adds the item to the viewport items.
         */
        const handleIntersection: IntersectionObserverCallback = ([{ isIntersecting }]) => {
            if (isIntersecting) {
                intersectionObserver.disconnect()
                props.addViewportItem(props.item)
            }
        }

        // Add intersection observer to element
        const intersectionObserver = useIntersectionObserver(observationTarget, handleIntersection, {
            threshold: 0,
        })

        return {
            itemElement,
            isNewToViewport,
        }
    },
})
</script>
