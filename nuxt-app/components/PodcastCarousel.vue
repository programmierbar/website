<template>
  <Carousel
    :active-index="carousel.activeIndex"
    @active-index-change="carousel.changeActiveIndex"
  >
    <CarouselSlide
      v-for="(podcast, index) in podcasts"
      :key="podcast.id"
      :index="index"
      :active-index="carousel.activeIndex"
      :is-clickable="index === carousel.activeIndex"
      :is-centerable="true"
      @active-index-change="carousel.changeActiveIndex"
    >
      <PodcastCard
        :podcast="podcast"
        :is-active="index === carousel.activeIndex"
      />
    </CarouselSlide>
  </Carousel>
</template>

<script lang="ts">
import { defineComponent, PropType } from '@nuxtjs/composition-api';
import { StrapiPodcast } from 'shared-code';
import { useCarousel } from '../composables';
import Carousel from './Carousel.vue';
import CarouselSlide from './CarouselSlide.vue';
import PodcastCard from './PodcastCard.vue';

export default defineComponent({
  components: {
    Carousel,
    CarouselSlide,
    PodcastCard,
  },
  props: {
    podcasts: {
      type: Array as PropType<StrapiPodcast[]>,
      required: true,
    },
  },
  setup(props) {
    const carousel = useCarousel(props.podcasts.length > 2 ? 1 : 0);
    return { carousel };
  },
});
</script>
