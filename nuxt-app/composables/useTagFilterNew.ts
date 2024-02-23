import type { Tag } from '~/composables/useDirectus'
import type { Ref } from 'vue'
import { computed, reactive, ref, watch } from 'vue'
import { ADD_TAG_FILTER_EVENT_ID, REMOVE_TAG_FILTER_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import type { TagItem } from '../types'

interface LocalTag extends Tag {
    is_active: boolean
}

/**
 * Composable that provide the functionality of the tag filter.
 *
 * @param items The data to be filtered. Usually the result of a directus request from the composable useDirectus.
 * @param tags The tags to be used for filtering.
 *
 * @returns State and methods to use the tag filter.
 */
export function useTagFilterNew<Items>(items: Ref<Items[] | null | undefined>, tags: Ref<Tag[] | undefined>) {
    const reactiveTags = ref<LocalTag[]>([])

    // Track analytic events
    watch(reactiveTags, (nextTags, prevTags) => {
        if (prevTags.length === 0 && nextTags.length > 0) {
            trackGoal(ADD_TAG_FILTER_EVENT_ID)
        } else if (prevTags.length > 0 && nextTags.length === 0) {
            trackGoal(REMOVE_TAG_FILTER_EVENT_ID)
        }
    })

    // Update tags when input changes
    watch(items, () => {
        if (tags.value) {
            reactiveTags.value = tags.value.map((tag) => ({ ...tag, is_active: false }))
        }
    })

    const toggleTag = (_: any, index: number) => {
        reactiveTags.value.splice(index, 1, {
            ...reactiveTags.value[index],
            is_active: !reactiveTags.value[index].is_active,
        })
    }

    const output = computed(() => {
        const activeTags = reactiveTags.value.filter((tag) => tag.is_active)

        // Filter entity if at least one tag from an entity has the same name as an active tag
        if (activeTags.length) {
            return (
                items.value?.filter((entityItem) => {
                    return entityItem.tags?.some((entityTag: TagItem) => {
                        return activeTags.some((tag) => tag.name === entityTag.tag?.name)
                    })
                }) || []
            )
        }

        // Otherwise return entity
        return items.value || []
    })

    return reactive({
        tags: reactiveTags,
        toggleTag,
        output,
    })
}
