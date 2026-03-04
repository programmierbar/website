<template>
  <div class='flex flex-col w-full items-end mt-8 space-y-8'>
    <div v-if='!message' class='bg-gray-500 rounded-full w-fit box-border p-2'>
      <button type='button' class='inline-block p-1 md:p-3 border-white border-r-1' data-cursor-hover
              @click='rate("up")'>
        <thumbs_up class='inline -mt-1 md:-mt-2 h-4 md:h-6 pr-1' />
      </button>
      <button type='button' class='inline-block p-1 md:p-3' data-cursor-hover @click='rate("down")'>
        <thumbs_down class='inline h-4 md:h-6 pl-2' />
      </button>
    </div>
    <div v-if='message' class='text-base font-bold leading-normal text-lime md:text-xl lg:text-2xl p-4 '>
      <p>{{ message.text }}</p>
    </div>
  </div>

    <form

      class='contact-form flex flex-col items-center space-y-10 lg:items-end'
      :class='formState'
      novalidate
      @submit.prevent="submitForm"
    >
      <div class='w-full bg-gray-900 px-6 py-6'>
        <p class='text-white block md:text-xl lg:text-2xl mb-3'>Wenn du möchtest, kannst du zu deinem Feedback noch ein Kommentar hinterlassen:</p>
        <textarea
          v-model='comment'
          class='text-input'
          name='message'
          placeholder='Feedback'
          rows='3'
          maxlength='1000'
          required
        />
        <p v-if='formError' class='mt-6 text-base text-pink'>
          {{ formError }}
        </p>
      </div>
      <button
        class='relative h-14 w-64 m-auto overflow-hidden rounded-full border-4 border-lime md:text-xl lg:text-2xl font-black uppercase tracking-widest transition-colors duration-500 after:absolute after:left-0 after:top-0 after:-z-1 after:h-full after:w-full after:origin-left after:rounded-full after:bg-lime after:transition-transform md:border-5 lg:border-6'
        :class="[
                formState === 'submitted' ? 'text-black' : 'text-lime',
                formState === 'submitting'
                    ? 'after:scale-x-75'
                    : formState === 'submitted'
                      ? 'after:scale-x-100'
                      : 'after:scale-x-0',
                formState === 'submitting' ? 'text-transparent after:duration-3000' : 'after:duration-1000',
            ]"
        style='will-change: transform'
        type='submit'
        :disabled="formState === 'submitting' || formState === 'submitted'"
        :data-cursor-hover="formState !== 'submitting' && formState !== 'submitted'"
      >
        {{ formState === 'submitted' ? 'Gesendet' : 'Senden' }}
      </button>
    </form>

</template>

<script setup lang='ts'>
import thumbs_up from '~/assets/icons/thumb-up.svg';
import thumbs_down from '~/assets/icons/thumb-down.svg';
import type { DirectusPodcastItem } from '~/types';
import { useWebHaptics } from 'web-haptics/vue';
import { defaultPatterns } from 'web-haptics';
import { ref } from 'vue';
import { useDirectus } from '~/composables/useDirectus';

const { message, setMessage, clearMessage } = useFlashMessage();
const props = defineProps<{ podcast: DirectusPodcastItem }>();
const { trigger } = useWebHaptics();
const istActive = ref(false);

const directus = useDirectus();

type FormState = 'pending' | 'submitting' | 'submitted' | 'error'
const formState = ref<FormState>('pending');
const formError = ref('');

const comment = ref('');

let ratingId = ref(message.value?.payload?.id || '');

const rate = async function(upOrDown: 'up' | 'down') {
  if (istActive.value) return;
  istActive.value = true;
  try {
    trigger(defaultPatterns.buzz);
    const result = await $fetch<{ success: boolean; message: string, payload: any }>(`/podcast/${props.podcast.slug}/${upOrDown}`, {
      headers: {
        Accept: 'application/json',
      },
    });
    setMessage(result.message, 'rating', {});
    ratingId.value = result.payload?.id;
  } catch {
    setMessage('Leider trat ein Fehler auf.', 'rating', {});
  }
  istActive.value = false;
};

const submitForm = async (event: Event) => {
  try {
      const formElement = event.target as HTMLFormElement
      if (formElement.reportValidity && !formElement.reportValidity()) {
        throw new Error('Ein Pflichtfeld wurde nicht ausgefüllt oder eine deiner Angaben ist ungültig.')
      }

      formState.value = 'submitting';

      console.log('Adding comment to rating with id', comment.value, ratingId.value)

      //await directus.addCommentToRating({id: props.podcast.id}, comment.value)
      formState.value = 'submitted'
  } catch (error: any) {
    formState.value = 'error'
    formError.value = error.message
  }
}

onUnmounted(() => {
  clearMessage();
});

</script>

<style scoped lang='postcss'>
.text-input {
  @apply w-full appearance-none rounded-none border-2 border-gray-600 bg-gray-600 p-4 text-base font-light text-white md:text-xl lg:text-2xl;
}

.contact-form.error .text-input:invalid {
  @apply border-pink;
}

input.text-input {
  @apply h-12;
}
</style>
