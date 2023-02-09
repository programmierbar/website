<template>
  <section
    class="w-full flex flex-col items-center overflow-x-hidden pt-20 md:pt-24 lg:pt-32"
  >
    <div class="relative">
      <NuxtLink
        class="min-w-56 md:min-w-76 lg:min-w-88 inline-block hover:bg-lime border-lime border-4 text-lime hover:text-black rounded-full text-sm md:text-lg lg:text-xl text-center font-black tracking-widest uppercase transition-colors px-10 pt-4 md:pt-5 lg:pt-6 pb-3 md:pb-4 lg:pb-5"
        to="/kontakt"
        data-cursor-hover
      >
        Feedback
      </NuxtLink>
      <div
        class="h-32 md:h-40 lg:h-48 absolute -z-1 -top-20 md:-top-24 lg:-top-32 -right-32 md:-right-44 lg:-right-48"
        v-html="feedbackFigure"
      />
    </div>
    <SocialNetworks class="h-8 md:h-9 lg:h-10 mt-10" />
  </section>
</template>

<script>
import feedbackFigure from '~/assets/images/feedback-figure.svg';
import { defineComponent } from 'vue';
import SocialNetworks from './SocialNetworks.vue';

export default defineComponent({
  components: {
    SocialNetworks,
  },
});
</script>
