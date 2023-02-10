<template>
  <form
    class="
      contact-form
      flex flex-col
      items-center
      lg:items-end
      space-y-10
      md:space-y-14
      lg:space-y-20
    "
    :class="formState"
    novalidate
    @submit.prevent="submitForm"
  >
    <div
      class="w-full bg-gray-900 px-6 md:px-8 lg:px-12 py-10 md:py-12 lg:py-16"
    >
      <div class="lg:flex space-y-4 md:space-y-8 lg:space-y-0 lg:space-x-12">
        <!-- Name -->
        <input
          v-model="name"
          class="text-input"
          type="text"
          name="name"
          placeholder="Name"
          spellcheck="false"
          maxlength="50"
          required
        />

        <!-- Email -->
        <input
          v-model="email"
          class="text-input"
          type="email"
          name="email"
          placeholder="E-Mail"
          spellcheck="false"
          maxlength="50"
          required
        />
      </div>

      <!-- Message -->
      <textarea
        v-model="message"
        class="text-input mt-8 lg:mt-20"
        name="message"
        placeholder="Nachricht"
        rows="10"
        maxlength="5000"
        required
      />

      <!-- Spam protection -->
      <input v-model="spam" class="hidden" type="phone" name="phone" required />

      <!-- Error -->
      <p
        v-if="formError"
        class="
          text-base
          md:text-xl
          lg:text-2xl
          text-pink
          mt-10
          md:mt-12
          lg:mt-16
        "
      >
        {{ formError }}
      </p>
    </div>

    <!-- Button -->
    <button
      class="
        w-64
        md:w-80
        lg:w-112
        h-14
        md:h-16
        lg:h-20
        relative
        border-4
        md:border-5
        lg:border-6
        border-lime
        rounded-full
        overflow-hidden
        text-sm
        md:text-lg
        lg:text-xl
        font-black
        uppercase
        tracking-widest
        transition-colors
        duration-500
        after:w-full
        after:h-full
        after:absolute
        after:-z-1
        after:top-0
        after:left-0
        after:bg-lime
        after:rounded-full
        after:origin-left
        after:transition-transform
      "
      :class="[
        formState === 'submitted' ? 'text-black' : 'text-lime',
        formState === 'submitting'
          ? 'after:scale-x-75'
          : formState === 'submitted'
          ? 'after:scale-x-100'
          : 'after:scale-x-0',
        formState === 'submitting'
          ? 'text-transparent after:duration-3000'
          : 'after:duration-1000',
      ]"
      style="will-change: transform"
      type="submit"
      :disabled="formState === 'submitting' || formState === 'submitted'"
      :data-cursor-hover="
        formState !== 'submitting' && formState !== 'submitted'
      "
    >
      {{ formState === 'submitted' ? 'Gesendet' : 'Senden' }}
    </button>
  </form>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import { SEND_CONTACT_EMAIL_URL, SEND_CONTACT_FORM_EVENT_ID } from '../config';
import { sleep, trackGoal } from '../helpers';

type FormState = 'pending' | 'submitting' | 'submitted' | 'error';

export default defineComponent({
  setup() {
    // Create form field references
    const name = ref('');
    const email = ref('');
    const message = ref('');
    const spam = ref('');

    // Create form state an error references
    const formState = ref<FormState>('pending');
    const formError = ref('');

    // Reset form state, error and fields after submitted
    let timeout: NodeJS.Timeout;
    watch(formState, () => {
      clearTimeout(timeout);
      if (formState.value === 'submitted') {
        timeout = setTimeout(() => {
          formState.value = 'pending';
          formError.value = '';
          name.value = '';
          email.value = '';
          message.value = '';
        }, 5000);
      }
    });

    /**
     * It submits the form and triggers our backend.
     */
    const submitForm = async (event: Event) => {
      try {
        if (!spam.value) {
          // Add value to required spam field
          spam.value = '1234';

          // Stop code execution for 100ms while
          // spam value is entered into the form
          await sleep(100);

          // Report validity and throw error if necessary
          const formElement = event.target as HTMLFormElement;
          if (formElement.reportValidity && !formElement.reportValidity()) {
            throw new Error(
              'Ein Pflichtfeld wurde nicht ausgefüllt oder eine deiner Angaben ist ungültig.'
            );
          }

          // Set form state to submitting
          formState.value = 'submitting';

          // Send form data to Cloud Functions
          const response = await fetch(SEND_CONTACT_EMAIL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.value,
              email: email.value,
              message: message.value,
            }),
          });

          // Check response and throw error if necessary
          if (!response.ok) {
            throw new Error((await response.json()).message);
          }

          // Track analytic event
          trackGoal(SEND_CONTACT_FORM_EVENT_ID);

          // Set form state to submitted
          formState.value = 'submitted';
        }

        // Handle errors
      } catch (error: any) {
        // Set form state and error
        formState.value = 'error';
        formError.value = error.message;

        // Remove value from required spam field
      } finally {
        spam.value = '';
      }
    };

    return {
      name,
      email,
      message,
      spam,
      formState,
      formError,
      submitForm,
    };
  },
});
</script>

<style lang="postcss" scoped>
.text-input {
  @apply w-full appearance-none bg-gray-800 border-2 border-gray-800 rounded-none text-white text-base md:text-xl lg:text-2xl font-light p-4 md:p-6 lg:p-8;
}
.contact-form.error .text-input:invalid {
  @apply border-pink;
}
input.text-input {
  @apply h-12 md:h-16 lg:h-20;
}
</style>
