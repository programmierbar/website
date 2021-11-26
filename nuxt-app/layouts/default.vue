<template>
  <div>
    <MouseCursor />
    <Header />
    <main class="min-h-screen">
      <LoadingScreen />
      <Nuxt />
    </main>
    <Footer />
    <PodcastPlayer />
    <!-- <CookieBanner /> -->
  </div>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api';
import {
  // CookieBanner,
  Footer,
  Header,
  LoadingScreen,
  MouseCursor,
  PodcastPlayer,
} from '../components';

export default defineComponent({
  components: {
    // CookieBanner,
    Footer,
    Header,
    LoadingScreen,
    MouseCursor,
    PodcastPlayer,
  },
});
</script>

<style>
/* Body */
body {
  font-family: 'Museo Sans', sans-serif;
  font-weight: 500;
}

* {
  -webkit-tap-highlight-color: transparent;
}

/* SVG */
svg {
  height: 100%;
}

/* Input range slider */
input[type='range'] {
  appearance: none;
  width: 100%;
  background: transparent;
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  border-radius: 50%;
  transition: all 0.2s ease;
}
input[type='range']::-moz-range-thumb {
  border: none;
  transition: all 0.2s ease;
}
input[type='range']:hover::-webkit-slider-thumb {
  transform: scale(1.3);
}
input[type='range']:hover::-moz-range-thumb {
  transform: scale(1.3);
}
input[type='range']::-webkit-slider-runnable-track {
  background: linear-gradient(var(--progress-color), var(--progress-color))
    var(--track-color);
  background-repeat: no-repeat;
  background-size: var(--progress-percentage) 100%;
  border-radius: 99px;
}
input[type='range']::-moz-range-progress,
input[type='range']::-moz-range-track {
  border-radius: 99px;
}

/* Font face */
/* @font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-100-italic.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-100-italic.woff') format('woff');
  font-weight: 100;
  font-style: italic;
  font-display: swap;
} */
/* @font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-100.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-100.woff') format('woff');
  font-weight: 100;
  font-style: normal;
  font-display: swap;
} */
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-300-italic.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-300-italic.woff') format('woff');
  font-weight: 300;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-300.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-300.woff') format('woff');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-500-italic.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-500-italic.woff') format('woff');
  font-weight: 500;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-500.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-500.woff') format('woff');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-700-italic.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-700-italic.woff') format('woff');
  font-weight: 700;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-700.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-700.woff') format('woff');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-900-italic.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-900-italic.woff') format('woff');
  font-weight: 900;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'Museo Sans';
  src: url('~/assets/fonts/museo-sans-900.woff2') format('woff2'),
    url('~/assets/fonts/museo-sans-900.woff') format('woff');
  font-weight: 900;
  font-style: normal;
  font-display: swap;
}
</style>
