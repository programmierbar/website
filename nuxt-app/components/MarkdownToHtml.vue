<template>
  <div class="markdown-to-html" :class="variantClass" v-html="html" />
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from '@nuxtjs/composition-api';
import snarkdown from 'snarkdown';

export default defineComponent({
  props: {
    markdown: {
      type: String,
      required: true,
    },
    variant: {
      type: String as PropType<'default' | 'pick_of_the_day_card'>,
      default: 'default',
    },
  },
  setup(props) {
    // Convert variant to class string
    const variantClass = computed(() => props.variant.replace(/_/g, '-'));

    // Convert markdown of description to HTML
    const html = computed(() =>
      props.markdown
        .split(/(?:\r?\n){2,}/)
        .map((text) =>
          /^(\s|#{1,6}|-|\*|>)\s+/.test(text)
            ? snarkdown(text)
            : `<p>${snarkdown(text)}</p>`
        )
        .join('\n')
        .replace(
          /<a /g,
          '<a target="_blank" rel="noreferrer" data-cursor-hover '
        )
    );

    return { html, variantClass };
  },
});
</script>

<style lang="postcss">
.markdown-to-html p {
  @apply whitespace-pre-line;
}
.markdown-to-html strong {
  @apply font-black;
}
.markdown-to-html a {
  @apply text-lime hover:text-blue font-bold transition-colors;
}
.markdown-to-html.pick-of-the-day-card *::selection {
  @apply bg-black text-white;
}
.markdown-to-html.pick-of-the-day-card a {
  @apply text-pink hover:text-blue;
}
.markdown-to-html ul {
  @apply list-disc;
}
.markdown-to-html ol {
  @apply list-decimal;
}
.markdown-to-html ul,
.markdown-to-html ol {
  @apply ml-4 md:ml-6 lg:ml-8;
}
.markdown-to-html li {
  @apply pl-1 md:pl-3 lg:pl-4;
}
.markdown-to-html ul > * + *,
.markdown-to-html ol > * + * {
  @apply mt-4;
}
</style>
