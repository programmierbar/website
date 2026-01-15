<template>
  <div v-if="!message" class='mt-8 space-y-8 text-base leading-normal text-white md:mt-14 md:text-xl lg:text-2xl'>
    <p>Wie hat dir diese Folge gefallen? Stimme jetzt mit
      <button type="button" class="contents" @click='rate("up")' data-cursor-hover>
        <thumbs_up class='inline -mt-2 mx-1 h-6'/>
      </button>
      oder
      <button type="button" class="contents" @click='rate("down")' data-cursor-hover>
        <thumbs_down class='inline mx-1 h-6'/>
      </button>
      ab!
    </p>
  </div>
  <div v-if="message" class='mt-8 space-y-8 text-base font-bold leading-normal text-lime md:mt-14 md:text-xl lg:text-2xl'>
    <p>{{ message.text }}</p>
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
