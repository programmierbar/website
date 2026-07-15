<template>
  <div
    class='relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-32'
  >
    <!-- Decorative spotlights -->
    <div v-if='showSpotlights' class='pointer-events-none absolute inset-0' aria-hidden='true'>
      <div
        class='absolute -left-20 -top-32 h-[520px] w-[520px] rounded-full bg-blue opacity-30 blur-[140px]'
      />
      <div
        class='absolute -bottom-36 -right-16 h-[460px] w-[460px] rounded-full bg-pink opacity-30 blur-[150px]'
      />
    </div>

    <article
      class='relative flex w-[640px] max-w-full flex-col gap-5 rounded-2xl border border-[#3a3d3f] bg-gray-900 px-9 pb-7 pt-8 shadow-[0_24px_60px_rgba(0,0,0,0.6)]'
    >
      <!-- Header: date + source tag -->
      <header class='flex items-center justify-between gap-3.5'>
        <span class='text-[13px] font-light italic text-[#abb2b5]'>{{ formattedDate }}</span>
        <span
          class='rounded-full bg-lime px-4 pb-1 pt-1.25 text-sm font-light text-black selection:bg-black selection:text-white'
        >
                    Link
                </span>
      </header>

      <!-- Title -->
      <h1 class='m-0 text-[28px] font-black leading-tight text-white [text-wrap:pretty]'>
        {{ newsLink.title }}
      </h1>


      <div class='flex items-center gap-2.5'>
        <div
          class='flex h-12 w-12 flex-none items-center justify-center rounded-full border-3 border-lime bg-black text-base font-black text-lime'
        >
          {{ initials }}
        </div>
        <div class='flex flex-col'>
          <span class='text-base font-black leading-tight text-white'>{{ authorName }}</span>
          <span class='text-[11px] font-black uppercase tracking-[0.15em] text-lime'>Meinung</span>
        </div>
      </div>

      <!-- Opinion block -->
      <div v-if='hasOpinion' class='flex gap-4 border-l-4 border-lime pl-[18px]'>
        <InnerHtml
          class='text-[17px] font-light leading-relaxed text-[#e5e7e8] [text-wrap:pretty]'
          :html="newsLink.comment ?? ''"
        />
      </div>

      <!-- Footer: article link + brand mark -->
      <footer
        class='flex flex-wrap items-center justify-between gap-4 border-t border-[#3a3d3f] pt-5'
      >
        <LinkButton :href='newsLink.link' target='_blank' rel='noreferrer'>Zum Artikel</LinkButton>
        <BrandLogo v-if='showBrandMark' class='h-5 opacity-85' alt='programmier.bar' />
      </footer>
    </article>
  </div>
</template>

<script setup lang='ts'>
import { computed, toRefs } from 'vue';
import BrandLogo from '~/assets/images/brand-logo.svg';
import type { DirectusMemberItem, DirectusNewsLinkItem } from '~/types/directus';
import InnerHtml from './InnerHtml.vue';
import LinkButton from './LinkButton.vue';

const props = withDefaults(
  defineProps<{
    newsLink: DirectusNewsLinkItem
    showSpotlights?: boolean
    showBrandMark?: boolean
  }>(),
  {
    showSpotlights: true,
    showBrandMark: true,
  },
);
const { newsLink } = toRefs(props);

// The member is only usable when it was expanded (an object, not an id/null).
const member = computed<DirectusMemberItem | null>(() =>
  newsLink.value.member && typeof newsLink.value.member === 'object'
    ? (newsLink.value.member as DirectusMemberItem)
    : null,
);

// Only render the opinion block when there is both a comment and an author.
const hasOpinion = computed(() => Boolean(newsLink.value.comment && member.value));

const authorName = computed(() => (member.value ? `${member.value.first_name} ${member.value.last_name}` : ''));

const initials = computed(() =>
  member.value ? `${member.value.first_name.charAt(0)}${member.value.last_name.charAt(0)}`.toUpperCase() : '',
);

const formattedDate = computed(() =>
  new Date(newsLink.value.date_created).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
);
</script>
