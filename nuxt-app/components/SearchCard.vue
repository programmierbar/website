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
      <img
        class="w-32 md:w-48 lg:w-72 h-32 md:h-48 lg:h-72 object-cover"
        :src="image.url"
        :srcset="imageSrcSet"
        sizes="(min-width: 1024px) 288px, (min-width: 768px) 192px, 128px"
        loading="lazy"
        :alt="image.alternativeText || heading"
      />
      <div class="">
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
        >
          {{ description }}
        </p>
      </div>
    </component>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import removeMarkdown from 'remove-markdown';
import {
  StrapiPodcast,
  StrapiMeetup,
  StrapiPickOfTheDay,
  StrapiSpeaker,
} from 'shared-code';
import {
  getImageSrcSet,
  getFullPodcastTitle,
  getFullSpeakerName,
  getSubpagePath,
} from '../helpers';

type Item =
  | (StrapiPodcast & { itemType: 'podcast' })
  | (StrapiMeetup & { itemType: 'meetup' })
  | (StrapiPickOfTheDay & { itemType: 'pick_of_the_day' })
  | (StrapiSpeaker & { itemType: 'speaker' });

export default defineComponent({
  props: {
    item: {
      type: Object as PropType<Item>,
      required: true,
    },
  },
  setup(props) {
    // Create URL or path for <a> element
    const urlOrPath = computed(() =>
      props.item.itemType === 'podcast'
        ? getSubpagePath(
            'podcast',
            getFullPodcastTitle(props.item),
            props.item.id
          )
        : props.item.itemType === 'meetup'
        ? getSubpagePath('meetup', props.item.title, props.item.id)
        : props.item.itemType === 'pick_of_the_day'
        ? props.item.website_url
        : getSubpagePath(
            'hall-of-fame',
            getFullSpeakerName(props.item),
            props.item.id
          )
    );

    // Create is external URL boolean
    const isExternalUrl = computed(
      () => props.item.itemType === 'pick_of_the_day'
    );

    // Get image depending on item typ
    const image = computed(() =>
      props.item.itemType === 'podcast' || props.item.itemType === 'meetup'
        ? props.item.cover_image
        : props.item.itemType === 'pick_of_the_day'
        ? props.item.image
        : props.item.profile_image
    );

    // Create image src set
    const imageSrcSet = computed(() => getImageSrcSet(image.value));

    // Create type and date depending on item typ
    const typeAndDate = computed(
      () =>
        (props.item.itemType === 'podcast'
          ? 'Podcast'
          : props.item.itemType === 'meetup'
          ? 'Meetup'
          : props.item.itemType === 'pick_of_the_day'
          ? 'Pick of the Day'
          : 'Speaker') +
        ' // ' +
        new Date(props.item.published_at).toLocaleDateString('de-DE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
    );

    // Create heading depending on item typ
    const heading = computed(() =>
      props.item.itemType === 'podcast'
        ? getFullPodcastTitle(props.item)
        : props.item.itemType === 'meetup'
        ? props.item.title
        : props.item.itemType === 'pick_of_the_day'
        ? props.item.name
        : getFullSpeakerName(props.item)
    );

    // Create plain description text
    const description = computed(() => removeMarkdown(props.item.description));

    return {
      urlOrPath,
      isExternalUrl,
      image,
      imageSrcSet,
      typeAndDate,
      heading,
      description,
    };
  },
});
</script>
