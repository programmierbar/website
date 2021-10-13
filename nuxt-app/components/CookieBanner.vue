<template>
  <div v-if="isVisible" class="w-full fixed z-40 left-0 bottom-0 bg-pink">
    <div
      class="
        flex flex-col
        lg:flex-row
        space-y-5
        lg:space-y-0 lg:space-x-8
        xl:space-x-24
        container
        p-6
        lg:p-8
      "
    >
      <!-- Text -->
      <p class="text-sm lg:text-lg text-lime font-bold">
        Zur fortlaufenden Verbesserung unserer Website und deines
        Nutzererlebnisses verwenden wir Cookies, in denen Informationen über
        deinen Besuch auf unserer Website gespeichert werden. Die durch die
        Cookies erhobenen Daten werden durch uns sowie durch dritte
        Dienstleister (Google Analytics) ausgewertet. Mit Klick auf den Button
        "[Y]ES" erklärst du deine Einwilligung in diese Datenverarbeitung. Deine
        Einwilligung kannst du jederzeit mit Wirkung für die Zukunft frei
        widerrufen.
        <NuxtLink class="underline" to="/datenschutz" data-cursor-hover>
          Mehr Infos
        </NuxtLink>
      </p>

      <!-- Buttons -->
      <div
        class="
          flex
          lg:flex-col
          self-end
          lg:self-center
          space-x-4
          lg:space-x-0 lg:space-y-3
        "
      >
        <button
          v-for="i of 2"
          :key="i"
          ref="buttonElements"
          class="
            w-28
            lg:w-48
            pt-1
            lg:pt-2
            pb-0.5
            lg:pb-1.5
            border-2
            lg:border-3
            rounded-full
            text-sm
            lg:text-xl
            font-black
            transition-colors
          "
          :class="
            i === 1
              ? 'hover:bg-lime focus:bg-lime border-lime text-lime hover:text-black focus:text-black'
              : 'hover:bg-black focus:bg-black border-black text-black hover:text-white focus:text-white'
          "
          type="button"
          data-cursor-hover-blue
          @click="() => answer(i === 1)"
        >
          {{ i === 1 ? '[Y]ES' : '[N]O' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from '@nuxtjs/composition-api';
import { useEventListener, useDocument } from '../composables';
import { getCookie, setCookie } from '../helpers';

const COOKIE_NAME = 'cookies_consented';

export default defineComponent({
  setup() {
    // Create state references
    const isVisible = ref(false);
    const buttonElements = ref<HTMLButtonElement[]>();

    // Check if banner must be displayed
    onMounted(() => {
      isVisible.value = getCookie(COOKIE_NAME) === undefined;
    });

    /**
     * It answers the cookie question.
     */
    const answer = (choice: boolean) => {
      setCookie(COOKIE_NAME, `${choice}`, 30);
      isVisible.value = false;
    };

    /**
     * It handles key down events.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isVisible) {
        // Get selected key
        const key = event.key.toLowerCase();

        // Focus selected button
        if (['y', 'n'].includes(key)) {
          buttonElements.value?.[key === 'y' ? 0 : 1].focus();
        }
      }
    };

    // Add key down event listener
    useEventListener(useDocument(), 'keydown', handleKeyDown);

    return {
      isVisible,
      buttonElements,
      answer,
    };
  },
});
</script>
