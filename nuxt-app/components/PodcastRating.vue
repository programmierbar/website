<template>
  <div class='flex flex-col w-full items-end mt-8 space-y-8'>
    <div v-if="!message" class='bg-gray-500 rounded-full w-fit box-border p-2'>
      <button type="button" class="inline-block p-1 md:p-3 border-white border-r-1" @click='rate("up")' data-cursor-hover>
        <thumbs_up class='inline -mt-1 md:-mt-2 h-4 md:h-6 pr-1'/>
      </button>
      <button type="button" class="inline-block p-1 md:p-3" @click='rate("down")' data-cursor-hover>
        <thumbs_down class='inline h-4 md:h-6 pl-2'/>
      </button>
    </div>
    <div v-if="message" class='text-base font-bold leading-normal text-lime md:text-xl lg:text-2xl p-4 '>
      <p>{{ message.text }}</p>
    </div>
  </div>
</template>

<script setup lang='ts'>
import thumbs_up from '~/assets/icons/thumb-up.svg'
import thumbs_down from '~/assets/icons/thumb-down.svg'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusPodcastItem } from '~/types';

const { message, setMessage } = useFlashMessage();
const directus = useDirectus();

const props = defineProps<{ podcast: DirectusPodcastItem }>()

const rate = async function(upOrDown: "up" | "down") {
  await directus.createRating(upOrDown, props.podcast);
    setMessage(
    'Vielen Dank für dein Feedback!',
    'rating',
    {}
    );
}

</script>

<style scoped lang='postcss'>

</style>
