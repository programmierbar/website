<template>
    <div>
        <nuxt-link class="block space-y-6 lg:flex lg:space-x-12 lg:space-y-0" :to="urlOrPath" data-cursor-more>
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
                {{ typeAndDate }}
              </div>

              <!-- Heading -->
              <h2
                class="mt-2 line-clamp-2 text-xl font-black leading-snug text-white md:text-3xl lg:mt-5 lg:text-4xl lg:leading-snug"
              >
                {{ heading }}
                <LeaveSiteIcon v-if="isExternalUrl" class="ml-1 mt-px inline-block h-4 text-white xl:h-6" />
              </h2>

              <!-- Description -->
              <p
                class="mt-4 line-clamp-4 text-sm font-light leading-normal text-white md:text-lg lg:mt-8 lg:text-xl lg:leading-relaxed"
                v-html="description"
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
      _type: string,
      published_on: string,

      url: string,
      name: string,
      title: string,
      description: string,
      image: string,

    }
}>()

// Refactor this separate by type

// Create URL or path for <a> element
const urlOrPath = computed(() =>
  props.item._type === 'podcast'
    ? `/podcast/${props.item.slug}`
    : props.item._type === 'meetup'
      ? `/meetup/${props.item.slug}`
      : props.item._type === 'pick_of_the_day'
        ? props.item.website_url
        : `/hall-of-fame/${props.item.slug}`
)

// Create is external URL boolean
const isExternalUrl = computed(() => props.item._type === 'pick_of_the_day')

// Get image depending on item typ
const image = computed(() =>
  props.item._type === 'podcast' || props.item._type === 'meetup'
    ? props.item.cover_image
    : props.item._type === 'pick_of_the_day'
      ? props.item.image
      : props.item.profile_image
)

// Create type and date depending on item typ
const typeAndDate = computed(
  () =>
    (props.item._type === 'podcast'
      ? 'Podcast'
      : props.item._type === 'meetup'
        ? 'Meetup'
        : props.item._type === 'pick_of_the_day'
          ? 'Pick of the Day'
          : 'Speaker') +
    ' // ' +
    new Date(props.item.published_on).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
)


// Create heading depending on item typ
const heading = computed(() =>
  props.item._type === 'podcast'
    ? getFullPodcastTitle(props.item)
    : props.item._type === 'meetup'
      ? props.item.title
      : props.item._type === 'pick_of_the_day'
        ? props.item.name
        : getFullSpeakerName(props.item)
)

const description = computed(() => props.item.description.replace(/<[^<>]+>/g, ''))

</script>
