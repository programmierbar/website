<template>
  <div v-if="contactPage">
    <section class="relative">
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
          pb-12
          md:pb-24
          lg:pb-32
        "
      >
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <!-- Address heading -->
        <SectionHeading class="mt-8 md:mt-0" element="h1">
          {{ contactPage.address_heading }}
        </SectionHeading>

        <!-- Page intro -->
        <MarkdownToHtml
          class="
            text-lg
            md:text-2xl
            lg:text-3xl
            text-white
            md:font-bold
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-16
          "
          :markdown="contactPage.intro_text"
        />
      </div>

      <!-- Google Maps -->
      <div class="md:container md:pr-6 md:pl-48 lg:pr-8 3xl:px-8">
        <GoogleMaps class="h-72 md:h-120 lg:h-160 2xl:h-192" />
      </div>

      <div
        class="
          container
          px-6
          md:pl-72
          lg:pl-80
          xl:pl-96
          lg:pr-8
          3xl:pl-52
          mt-16
          md:mt-24
          lg:mt-32
        "
      >
        <!-- Address text -->
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:leading-normal
            lg:leading-normal
            space-y-8
            break-words
          "
          :markdown="contactPage.address_text"
        />
      </div>
    </section>

    <section class="relative">
      <div
        class="
          container
          px-6
          md:pl-72
          lg:pl-80
          xl:pl-96
          lg:pr-8
          3xl:pl-52
          mt-8
          md:mt-16
          lg:mt-24
        "
      >
        <!-- Business text -->
        <MarkdownToHtml
          class="
            text-base
            md:text-xl
            lg:text-2xl
            text-white
            font-light
            md:leading-normal
            lg:leading-normal
            space-y-8
            break-words
          "
          :markdown="contactPage.business_text"
        />
      </div>

      <!-- Business heading -->
      <SectionHeading class="px-6 mt-16 md:mt-0" element="h2">
        {{ contactPage.business_heading }}
      </SectionHeading>

      <!-- Form -->
      <div
        class="
          container
          md:pr-6 md:pl-48
          lg:pr-8
          3xl:px-8
          mt-10
          md:mt-16
          lg:mt-24
          pb-24
          md:pb-36
          lg:pb-52
        "
      >
        <form
          class="
            flex flex-col
            items-center
            lg:items-end
            space-y-10
            md:space-y-14
            lg:space-y-20
          "
          @submit.prevent="submitForm"
        >
          <div
            class="
              w-full
              bg-gray-900
              space-y-8
              lg:space-y-20
              px-6
              md:px-8
              lg:px-12
              py-10
              md:py-12
              lg:py-16
            "
          >
            <div
              class="lg:flex space-y-4 md:space-y-8 lg:space-y-0 lg:space-x-12"
            >
              <input
                v-model="name"
                class="text-input"
                type="text"
                name="name"
                placeholder="Name"
                spellcheck="false"
                required
              />
              <input
                v-model="email"
                class="text-input"
                type="email"
                name="email"
                placeholder="E-Mail"
                spellcheck="false"
                required
              />
            </div>
            <textarea
              v-model="message"
              class="text-input"
              name="message"
              placeholder="Nachricht"
              rows="10"
              required
            />
            <!-- TODO: Implement error message -->
          </div>
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
              formState !== 'submitting' && formState !== 'submitted'
                ? 'after:scale-x-0'
                : 'after:scale-x-100',
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
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  GoogleMaps,
  MarkdownToHtml,
  SectionHeading,
} from '../components';
import { useStrapi, usePageMeta } from '../composables';

type FormState = 'pending' | 'submitting' | 'submitted' | 'error';

export default defineComponent({
  components: {
    Breadcrumbs,
    GoogleMaps,
    MarkdownToHtml,
    SectionHeading,
  },
  setup() {
    // Query Strapi contact-page
    const contactPage = useStrapi('contact-page');

    // Set page meta data
    usePageMeta(contactPage);

    // Create form field references
    const name = ref('');
    const email = ref('');
    const message = ref('');

    // Create form state an error references
    const formState = ref<FormState>('pending');
    const formError = ref('');

    // Reset form state after some time
    let timeout: NodeJS.Timeout;
    watch(formState, () => {
      clearTimeout(timeout);
      if (formState.value === 'submitted') {
        timeout = setTimeout(() => {
          formState.value = 'pending';
        }, 4000);
      } else if (formState.value === 'error') {
        timeout = setTimeout(() => {
          formState.value = 'error';
          formError.value = '';
        }, 10000);
      }
    });

    /**
     * It submits the form and triggers our backend.
     */
    const submitForm = async () => {
      try {
        // Set form state to submitting
        formState.value = 'submitting';

        // TODO: Implement real logic
        await new Promise((resolve) => {
          setTimeout(() => resolve(null), 5000);
        });

        // Set form state to submitted
        formState.value = 'submitted';

        // Handle errors
      } catch (error: any) {
        // Set form state and error
        formState.value = 'error';
        formError.value = error.message;
      }
    };

    return {
      contactPage,
      breadcrumbs: [{ label: 'Kontakt' }],
      name,
      email,
      message,
      formState,
      submitForm,
    };
  },
  head: {},
});
</script>

<style lang="postcss" scoped>
.text-input {
  @apply w-full bg-gray-800 text-white text-base md:text-xl lg:text-2xl font-light p-4 md:p-6 lg:p-8;
}
input.text-input {
  @apply h-12 md:h-16 lg:h-20;
}
</style>
