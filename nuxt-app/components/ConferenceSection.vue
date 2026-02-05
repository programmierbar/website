<template>
    <section class="relative mb-14 mt-12 md:mb-32 md:mt-28 lg:mb-52 lg:mt-40">
        <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
            <SectionHeading element="h2">
                {{ heading }}
            </SectionHeading>
            <LazyList class="mt-10" :items="conferences" direction="vertical">
                <template #default="{ item, index, viewportItems, addViewportItem }">
                    <LazyListItem
                        :key="item.id"
                        :class="index > 0 && 'mt-14 md:mt-20 lg:mt-28'"
                        :item="item"
                        :viewport-items="viewportItems"
                        :add-viewport-item="addViewportItem"
                    >
                        <template #default="{ isNewToViewport }">
                            <FadeAnimation :fade-in="isNewToViewport ? 'from_right' : 'none'">
                                <ConferenceCard :conference="item" />
                            </FadeAnimation>
                        </template>
                    </LazyListItem>
                </template>
            </LazyList>
        </div>
    </section>
</template>

<script lang="ts">
import ConferenceCard from '~/components/ConferenceCard.vue'
import GenericLazyList from '~/components/GenericLazyList.vue'
import GenericListItem from '~/components/GenericListItem.vue'
import type { ConferenceItem } from '~/types'
import type { PropType } from 'vue'
import { defineComponent } from 'vue'
import SectionHeading from './SectionHeading.vue'

export default defineComponent({
    components: {
        SectionHeading,
        LazyList: GenericLazyList,
        LazyListItem: GenericListItem,
        ConferenceCard,
    },
    props: {
        conferences: {
            type: Array as PropType<Pick<ConferenceItem, 'start_on' | 'end_on' | 'title' | 'cover_image' | 'text_1'>[]>,
            required: true,
        },
        heading: {
            type: String,
        },
    },
})
</script>
