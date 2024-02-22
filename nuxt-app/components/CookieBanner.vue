<template>
    <div v-if="isVisible" class="bg-pink fixed bottom-0 left-0 z-50 w-full">
        <div class="container flex flex-col space-y-5 p-6 lg:flex-row lg:space-x-8 lg:space-y-0 lg:p-8 xl:space-x-24">
            <!-- Text -->
            <p class="text-lime text-sm font-bold lg:text-lg">
                Zur fortlaufenden Verbesserung unserer Website und deines Nutzererlebnisses verwenden wir Cookies, in
                denen Informationen über deinen Besuch auf unserer Website gespeichert werden. Die durch die Cookies
                erhobenen Daten werden durch uns sowie durch dritte Dienstleister (Google Analytics) ausgewertet. Mit
                Klick auf den Button "[Y]ES" erklärst du deine Einwilligung in diese Datenverarbeitung. Deine
                Einwilligung kannst du jederzeit mit Wirkung für die Zukunft frei widerrufen.
                <NuxtLink class="underline" to="/datenschutz" data-cursor-hover> Mehr Infos </NuxtLink>
            </p>

            <!-- Buttons -->
            <div class="flex space-x-4 self-end lg:flex-col lg:space-x-0 lg:space-y-3 lg:self-center">
                <button
                    v-for="number of 2"
                    :key="number"
                    class="lg:border-3 w-28 rounded-full border-2 pb-0.5 pt-1 text-sm font-black transition-colors lg:w-48 lg:pb-1.5 lg:pt-2 lg:text-xl"
                    :class="
                        number === 1
                            ? 'hover:bg-lime focus:bg-lime border-lime text-lime hover:text-black focus:text-black'
                            : 'border-black text-black hover:bg-black hover:text-white focus:bg-black focus:text-white'
                    "
                    type="button"
                    data-cursor-hover-blue
                    @click="() => answer(number === 1)"
                >
                    {{ number === 1 ? '[Y]ES' : '[N]O' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import { useDocument, useEventListener } from '../composables'
import { getCookie, setCookie } from '../helpers'

const COOKIE_NAME = 'cookies_consented'

export default defineComponent({
    setup() {
        // Create state references
        const isVisible = ref(false)

        // Check if banner must be displayed
        onMounted(() => {
            isVisible.value = getCookie(COOKIE_NAME) === undefined
        })

        /**
         * It answers the cookie question.
         */
        const answer = (choice: boolean) => {
            setCookie(COOKIE_NAME, `${choice}`, 30)
            isVisible.value = false
        }

        /**
         * It handles keydown events and answers the cookie question.
         */
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isVisible.value) {
                // Get selected key
                const key = event.key.toLowerCase()

                // If the key is "y", answer true
                if (key === 'y') {
                    answer(true)

                    // If the key is "n", answer false
                } else if (key === 'n') {
                    answer(false)
                }
            }
        }

        // Add keydown event listener to document
        useEventListener(useDocument(), 'keydown', handleKeyDown)

        return {
            isVisible,
            answer,
        }
    },
})
</script>
