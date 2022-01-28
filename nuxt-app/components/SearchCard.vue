<template>
  <div>
    <component
      :is="isExternalUrl ? 'a' : 'nuxt-link'"
      class="block lg:flex space-y-6 lg:space-y-0 lg:space-x-12"
      :href="isExternalUrl ? urlOrPath : undefined"
      :target="isExternalUrl ? '_blank' : undefined"
      :rel="isExternalUrl ? 'noreferrer' : undefined"
      :to="isExternalUrl ? undefined : urlOrPath"
      data-cursor-more
    >
      <!-- Image -->
      <DirectusImage
        class="w-32 md:w-48 lg:w-72 h-32 md:h-48 lg:h-72 object-cover"
        :image="image"
        :alt="heading"
        sizes="xs:128px md:192px lg:288px"
        loading="lazy"
      />
      <div>
        <!-- Type and date -->
        <div
          class="text-xs md:text-base lg:text-xl text-white font-light italic"
        >
          {{ typeAndDate }}
        </div>

        <!-- Heading -->
        <h2
          class="
            text-xl
            md:text-3xl
            lg:text-4xl
            text-white
            font-black
            leading-snug
            lg:leading-snug
            line-clamp-2
            mt-2
            lg:mt-5
          "
        >
          {{ heading }}
          <span
            v-if="isExternalUrl"
            class="h-4 xl:h-6 inline-block text-white ml-1 mt-px"
            v-html="require('../assets/icons/leave-site.svg?raw')"
          />
        </h2>

        <!-- Description -->
        <p
          class="
            text-sm
            md:text-lg
            lg:text-xl
            text-white
            font-light
            leading-normal
            lg:leading-relaxed
            line-clamp-4
            mt-4
            lg:mt-8
          "
          v-html="description"
        />
      </div>
    </component>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import { getFullPodcastTitle, getFullSpeakerName } from 'shared-code';
import { SearchItem } from '../types';
import DirectusImage from './DirectusImage.vue';

export default defineComponent({
  components: {
    DirectusImage,
  },
  props: {
    item: {
      type: Object as PropType<SearchItem>,
      required: true,
    },
  },
  setup(props) {
    // Create URL or path for <a> element
    const urlOrPath = computed(() =>
      props.item.item_type === 'podcast'
        ? `/podcast/${props.item.slug}`
        : props.item.item_type === 'meetup'
        ? `/meetup/${props.item.slug}`
        : props.item.item_type === 'pick_of_the_day'
        ? props.item.website_url
        : `/hall-of-fame/${props.item.slug}`
    );

    // Create is external URL boolean
    const isExternalUrl = computed(
      () => props.item.item_type === 'pick_of_the_day'
    );

    // Get image depending on item typ
    const image = computed(() =>
      props.item.item_type === 'podcast' || props.item.item_type === 'meetup'
        ? props.item.cover_image
        : props.item.item_type === 'pick_of_the_day'
        ? props.item.image
        : props.item.profile_image
    );

    // Create type and date depending on item typ
    const typeAndDate = computed(
      () =>
        (props.item.item_type === 'podcast'
          ? 'Podcast'
          : props.item.item_type === 'meetup'
          ? 'Meetup'
          : props.item.item_type === 'pick_of_the_day'
          ? 'Pick of the Day'
          : 'Speaker') +
        ' // ' +
        new Date(props.item.published_on).toLocaleDateString('de-DE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
    );

    // Create heading depending on item typ
    const heading = computed(() =>
      props.item.item_type === 'podcast'
        ? getFullPodcastTitle(props.item)
        : props.item.item_type === 'meetup'
        ? props.item.title
        : props.item.item_type === 'pick_of_the_day'
        ? props.item.name
        : getFullSpeakerName(props.item)
    );

    // Create plain description text
    const description = computed(() =>
      props.item.description.replace(/<[^<>]+>/g, '')
    );

    return {
      urlOrPath,
      isExternalUrl,
      image,
      typeAndDate,
      heading,
      description,
    };
  },
});
</script>
