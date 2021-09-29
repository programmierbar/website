<template>
  <Theme>
    <Header />
    <main class="min-h-screen overflow-hidden">
      <Nuxt />
    </main>
    <Footer />
    <PodcastPlayer />
  </Theme>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api';
import { Footer, Header, PodcastPlayer, Theme } from '../components';

export default defineComponent({
  components: {
    Footer,
    Header,
    PodcastPlayer,
    Theme,
  },
});
</script>
