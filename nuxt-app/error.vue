<template>
  <div>
    <MouseCursor />
    <Header />
    <main class="min-h-screen">
      <LoadingScreen />
      <div class="relative">
        <div
          class="
            container
            px-6
            md:pl-48
            lg:pr-8
            3xl:px-8
            pt-32
            md:pt-40
            lg:pt-56
            2xl:pt-64
            pb-20
            md:pb-32
            lg:pb-52
          "
        >
          <Breadcrumbs :breadcrumbs="[{ label: 'Seite nicht gefunden' }]" />

          <!-- Heading -->
          <SectionHeading class="mt-8 md:mt-0" element="h1">
            Error 404
          </SectionHeading>

          <!-- Editor text -->
          <div
            class="
              editor-text
              grid
              gap-0.5
              md:gap-2
              lg:gap-4
              font-mono
              text-base
              md:text-xl
              lg:text-2xl
              text-white
              font-light
              break-all
              mt-8
              md:mt-16
            "
          >
            <div class="text-gray-500">1</div>
            <div>&lt;<span class="text-pink">template</span>&gt;</div>
            <div class="text-gray-500">2</div>
            <div class="ml-4">
              &lt;<span class="text-pink">main</span>
              <span class="text-blue">class</span>=<span class="text-lime"
                >"error-page"</span
              >&gt;
            </div>
            <div class="text-gray-500">3</div>
            <div class="ml-8">&lt;<span class="text-pink">h1</span>&gt;</div>
            <div class="text-gray-500">4</div>
            <div class="ml-12">Error 404</div>
            <div class="text-gray-500">5</div>
            <div class="ml-8">&lt;/<span class="text-pink">h1</span>&gt;</div>
            <div class="text-gray-500">6</div>
            <div class="ml-8">&lt;<span class="text-pink">h2</span>&gt;</div>
            <div class="text-gray-500">7</div>
            <div class="ml-12">Page not found. Can you fix it?</div>
            <div class="text-gray-500">8</div>
            <div class="ml-8">&lt;/<span class="text-pink">h2</span>&gt;</div>
            <div class="text-gray-500">9</div>
            <div class="ml-8">&lt;<span class="text-pink">p</span>&gt;</div>
            <div class="text-gray-500">10</div>
            <div class="ml-12">
              &lt;<span class="text-pink">a</span>
              <span class="text-blue">href</span>=<span class="text-lime"
                ><a
                  class="underline"
                  href="https://github.com/programmierbar/website"
                  target="_blank"
                  rel="noreferrer"
                  data-cursor-hover
                  >"https://github.com/programmierbar/website"</a
                ></span
              >&gt;
            </div>
            <div class="text-gray-500">11</div>
            <div class="ml-16">Check our code on GitHub!</div>
            <div class="text-gray-500">12</div>
            <div class="ml-12">&lt;/<span class="text-pink">a</span>&gt;</div>
            <div class="text-gray-500">13</div>
            <div class="ml-8">&lt;/<span class="text-pink">p</span>&gt;</div>
            <div class="text-gray-500">14</div>
            <div class="ml-4">&lt;/<span class="text-pink">main</span>&gt;</div>
            <div class="text-gray-500">15</div>
            <div>&lt;/<span class="text-pink">template</span>&gt;</div>
          </div>
        </div>
      </div>
    </main>
    <Footer />
    <PodcastPlayer />
    <!-- <CookieBanner /> -->
  </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from './composables';

// Disable loading screen
useLoadingScreen();

// Set page meta data
useHead({
  title: 'Error 404 – Seite nicht gefunden | programmier.bar',
  meta: [
    { hid: 'description', name: 'description', content: '' },
    { name: 'robots', content: 'noindex, nofollow' },
    { charset: 'utf-8' },
    {
      name: 'viewport',
      content:
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    },
    { name: 'theme-color', content: '#000000' },
    { name: 'format-detection', content: 'telephone=no' },
  ],
  link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'de',
  },
  bodyAttrs: {
    class: 'bg-black',
  },
});
</script>

<style scoped>
.editor-text {
  grid-template-columns: 25px 1fr;
}
@media (min-width: 768px) {
  .editor-text {
    grid-template-columns: 30px 1fr;
  }
}
</style>
