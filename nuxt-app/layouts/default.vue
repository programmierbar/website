<template>
  <Theme>
    <Header />
    <main class="min-h-screen overflow-hidden">
      <Nuxt />
    </main>
    <Footer />
    <PodcastPlayer />
    <CookieBanner />
  </Theme>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api';
import {
  CookieBanner,
  Footer,
  Header,
  PodcastPlayer,
  Theme,
} from '../components';

export default defineComponent({
  components: {
    CookieBanner,
    Footer,
    Header,
    PodcastPlayer,
    Theme,
  },
});
</script>
