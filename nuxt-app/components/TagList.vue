<template>
    <div>
        <ul class="-m-1.5 flex flex-wrap md:-m-2" :class="variant === 'pick_of_the_day_card' && 'lg:-m-1.5 xl:-m-2'">
            <li v-for="(tag, index) of tags" :key="tag.id">
                <button
                    class="m-1.5 rounded-full font-light transition-colors md:m-2"
                    :class="[
                        variant === 'default' && 'hover:bg-lime hover:selection:bg-black hover:selection:text-white',
                        variant === 'pick_of_the_day_card' &&
                            'xs:text-sm pt-0.75 md:pt-1.25 lg:pt-0.75 xl:pt-1.25 border-2 border-gray-700 px-3 pb-0.5 text-xs hover:bg-opacity-0 md:px-4 md:pb-1 lg:m-1.5 lg:px-3 lg:pb-0.5 xl:m-2 xl:px-4 xl:pb-1 xl:text-base',
                        (variant === 'default' || variant === 'pick_of_the_day_card') && 'hover:text-black',
                        (variant === 'default' || variant === 'tag_filter') &&
                            'pt-1.25 px-4 pb-1 text-sm md:px-5 md:text-base lg:text-lg',
                        variant === 'tag_filter' && tag.is_active
                            ? 'bg-lime text-black selection:bg-black selection:text-white'
                            : 'bg-gray-700 text-white',
                    ]"
                    type="button"
                    data-cursor-hover
                    @click="() => onClick(tag, index)"
                >
                    {{ tag.name }}
                </button>
            </li>
        </ul>
    </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import { defineComponent } from 'vue'
import type { TagItem } from '../types'

interface Tag extends Pick<TagItem, 'id' | 'name'> {
    is_active?: boolean
}

export default defineComponent({
    props: {
        tags: {
            type: Array as PropType<Tag[]>,
            required: true,
        },
        onClick: {
            type: Function as PropType<(tag: Tag, index: number) => void>,
            required: true,
        },
        variant: {
            type: String as PropType<'default' | 'tag_filter' | 'pick_of_the_day_card'>,
            default: 'default',
        },
    },
})
</script>
