<template>
    <div>
        <nuxt-link
            class="block space-y-6 lg:flex lg:space-x-12 lg:space-y-0"
            :to="viewModel.url"
            data-cursor-more
            :target="viewModel.target"
        >
            <nuxt-img
                v-if="item.image"
                class="h-32 w-32 object-cover md:h-48 md:w-48 lg:h-72 lg:w-72"
                :src="item.image"
                sizes="xs:128px md:192px lg:288px"
                loading="lazy"
                quality="80"
                fit="cover"
            />

            <div>
                <!-- Type and date -->
                <div class="text-xs font-light italic text-white md:text-base lg:text-xl">
                    {{ viewModel.typeAndDate }}
                </div>

                <!-- Heading -->
                <h2
                    class="mt-2 line-clamp-2 text-xl font-black leading-snug text-white md:text-3xl lg:mt-5 lg:text-4xl lg:leading-snug"
                >
                    {{ viewModel.heading }}
                    <LeaveSiteIcon
                        v-if="viewModel.isExternalUrl"
                        class="ml-1 mt-px inline-block h-4 text-white xl:h-6"
                    />
                </h2>

                <!-- Description -->
                <p
                    class="mt-4 line-clamp-4 text-sm font-light leading-normal text-white md:text-lg lg:mt-8 lg:text-xl lg:leading-relaxed"
                    v-html="viewModel.description"
                />
            </div>
        </nuxt-link>
    </div>
</template>

<script setup lang="ts">
import LeaveSiteIcon from '~/assets/icons/leave-site.svg'
import { getFullPodcastTitle, getFullSpeakerName } from 'shared-code'
import { computed } from 'vue'

const props = defineProps<{
    item: {
        _type: string
        published_on: string

        image: string

        slug?: string
        name?: string
        title?: string
        description?: string
        transcript?: string
        website_url?: string
    }
}>()

class ViewModel {
    constructor(
        public url = '',
        public heading = '',
        public typeAndDate = '',
        public description = '',
        public isExternalUrl = false
    ) {}
    get target(): string {
        if (this.isExternalUrl) {
            return '_blank'
        }

        return '_self'
    }
}

const viewModel = computed(() => {
    const publishDate = new Date(props.item.published_on).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
    switch (props.item._type) {
        case 'podcast':
            return new ViewModel(
                `/podcast/${props.item.slug}`,
                getFullPodcastTitle(props.item) || '',
                'Podcast // ' + publishDate,
                props.item.description?.replace(/<[^<>]+>/g, '') || ''
            )
        case 'transcript':
            return new ViewModel(
                `/podcast/${props.item.slug}`,
                getFullPodcastTitle(props.item) || '',
                'Podcast // ' + publishDate,
                props.item.transcript?.replace(/<[^<>]+>/g, '') || ''
            )
        case 'meetup':
            return new ViewModel(
                `/meetup/${props.item.slug}`,
                props.item.title || '',
                'Meetup // ' + publishDate,
                props.item.description?.replace(/<[^<>]+>/g, '') || ''
            )
        case 'speaker':
            return new ViewModel(
                `/hall-of-fame/${props.item.slug}`,
                getFullSpeakerName(props.item) || '',
                'Speaker // ' + publishDate,
                props.item.description?.replace(/<[^<>]+>/g, '') || ''
            )
        case 'pick_of_the_day':
            return new ViewModel(
                props.item.website_url,
                props.item.name || '',
                'Pick of the Day // ' + publishDate,
                props.item.description?.replace(/<[^<>]+>/g, '') || '',
                true
            )
        default:
            return new ViewModel()
    }
})
</script>
