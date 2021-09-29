<template>
  <div class="relative" data-cursor-black>
    <!-- 16:9 aspect ratio -->
    <div class="w-full relative overflow-hidden" style="padding-top: 56.25%">
      <div class="w-full h-full absolute top-0 left-0 bg-white">
        <!-- Link & heading -->
        <a
          class="
            absolute
            z-10
            inline-flex
            items-center
            space-x-3
            bg-lime
            px-4
            pt-4
            pb-3
            m-4
            md:m-6
            lg:m-4
            xl:m-6
          "
          :href="pickOfTheDay.website_url"
          target="_blank"
          data-cursor-hover
        >
          <h2
            class="
              text-base
              md:text-xl
              xl:text-2xl
              2xl:text-3xl
              text-black
              font-black
            "
          >
            {{ pickOfTheDay.name }}
          </h2>
          <div
            class="h-4 lg:h-5 xl:h-6 text-black -mt-1"
            v-html="require('../assets/icons/leave-site.svg?raw')"
          />
        </a>

        <!-- Background image overlay -->
        <div
          class="w-full h-full absolute top-0 left-0 bg-black bg-opacity-30"
        />

        <!-- Background image -->
        <img
          v-if="pickOfTheDay.image"
          class="w-full h-full object-cover"
          :src="pickOfTheDay.image.url"
          :srcset="imageSrcSet"
          :sizes="
            variant === 'large'
              ? `
              (min-width: 1536px) 722px,
              (min-width: 1024px) 43vw,
              (min-width: 768px) 74vw,
              90vw
            `
              : `
              (min-width: 1536px) 460px,
              (min-width: 1024px) 28vw,
              (min-width: 768px) 74vw,
              90vw
            `
          "
          loading="lazy"
          :alt="pickOfTheDay.image.alternativeText || pickOfTheDay.name"
        />
      </div>
    </div>

    <!-- Content box -->
    <div class="w-full lg:h-full lg:absolute lg:top-0 lg:left-0 lg:p-4 xl:p-6">
      <div class="w-full lg:h-full relative">
        <!-- Background color -->
        <div
          class="
            w-full
            h-full
            absolute
            top-0
            left-0
            bg-lime
            lg:scale-0
            lg:group-hover:scale-100
            lg:origin-top-left
            lg:transition-transform
            lg:duration-300
          "
        />

        <!-- Content -->
        <div
          class="
            w-full
            lg:h-full
            relative
            lg:absolute
            lg:top-0
            lg:left-0
            lg:overflow-auto
            lg:opacity-0
            lg:group-hover:opacity-100
            lg:transition-opacity
            lg:duration-300
            lg:group-hover:duration-700
            lg:group-hover:delay-300
          "
        >
          <div
            class="
              min-h-full
              flex flex-col
              items-start
              justify-end
              space-y-6
              px-4
              pt-8
              pb-4
              md:px-6 md:pt-10 md:pb-6
              lg:px-4 lg:pt-14
              xl:pt-20
              lg:pb-4
            "
          >
            <!-- Description -->
            <MarkdownToHtml
              class="text-sm xs:text-base md:text-lg 2xl:text-xl text-black"
              :markdown="pickOfTheDay.description"
              variant="pick_of_the_day_card"
            />

            <div
              class="
                w-full
                flex
                md:flex-col
                items-end
                md:items-start
                justify-end
                md:justify-end
                space-x-6
                md:space-x-0 md:space-y-6
              "
            >
              <!-- Tags -->
              <TagList
                v-if="pickOfTheDay.tags.length"
                class="flex-grow"
                :tags="pickOfTheDay.tags"
                variant="pick_of_the_day_card"
              />

              <!-- Likes -->
              <LikeButton class="self-end" variant="pick_of_the_day_card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPickOfTheDay } from 'shared-code';
import { useImageSrcSet } from '../composables';
import LikeButton from './LikeButton.vue';
import MarkdownToHtml from './MarkdownToHtml.vue';
import TagList from './TagList.vue';

export default defineComponent({
  components: {
    LikeButton,
    MarkdownToHtml,
    TagList,
  },
  props: {
    pickOfTheDay: {
      type: Object as PropType<StrapiPickOfTheDay>,
      required: true,
    },
    variant: {
      type: String as PropType<'small' | 'large'>,
      required: true,
    },
  },
  setup(props) {
    // Create normal image src set
    const imageSrcSet = useImageSrcSet(props.pickOfTheDay.image);

    return { imageSrcSet };
  },
});
</script>
