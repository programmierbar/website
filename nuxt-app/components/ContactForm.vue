<template>
    <form
        class="contact-form flex flex-col items-center space-y-10 md:space-y-14 lg:items-end lg:space-y-20"
        :class="formState"
        novalidate
        @submit.prevent="submitForm"
    >
        <div class="w-full bg-gray-900 px-6 py-10 md:px-8 md:py-12 lg:px-12 lg:py-16">
            <div class="space-y-4 md:space-y-8 lg:flex lg:space-x-12 lg:space-y-0">
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
            <input
                v-model="honeypot"
                class="hidden"
                type="text"
                name="website"
                tabindex="-1"
                autocomplete="off"
            />

            <!-- Error -->
            <p v-if="formError" class="mt-10 text-base text-pink md:mt-12 md:text-xl lg:mt-16 lg:text-2xl">
                {{ formError }}
            </p>
        </div>

        <!-- Button -->
        <button
            class="relative h-14 w-64 overflow-hidden rounded-full border-4 border-lime text-sm font-black uppercase tracking-widest transition-colors duration-500 after:absolute after:left-0 after:top-0 after:-z-1 after:h-full after:w-full after:origin-left after:rounded-full after:bg-lime after:transition-transform md:h-16 md:w-80 md:border-5 md:text-lg lg:h-20 lg:w-112 lg:border-6 lg:text-xl"
            :class="[
                formState === 'submitted' ? 'text-black' : 'text-lime',
                formState === 'submitting'
                    ? 'after:scale-x-75'
                    : formState === 'submitted'
                      ? 'after:scale-x-100'
                      : 'after:scale-x-0',
                formState === 'submitting' ? 'text-transparent after:duration-3000' : 'after:duration-1000',
            ]"
            style="will-change: transform"
            type="submit"
            :disabled="formState === 'submitting' || formState === 'submitted'"
            :data-cursor-hover="formState !== 'submitting' && formState !== 'submitted'"
        >
            {{ formState === 'submitted' ? 'Gesendet' : 'Senden' }}
        </button>
    </form>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { SEND_CONTACT_EMAIL_URL, SEND_CONTACT_FORM_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'

type FormState = 'pending' | 'submitting' | 'submitted' | 'error'

export default defineComponent({
    setup() {
        // Create form field references
        const name = ref('')
        const email = ref('')
        const message = ref('')
        const honeypot = ref('')

        // Create form state an error references
        const formState = ref<FormState>('pending')
        const formError = ref('')

        // Reset form state, error and fields after submitted
        let timeout: NodeJS.Timeout
        watch(formState, () => {
            clearTimeout(timeout)
            if (formState.value === 'submitted') {
                timeout = setTimeout(() => {
                    formState.value = 'pending'
                    formError.value = ''
                    name.value = ''
                    email.value = ''
                    message.value = ''
                    honeypot.value = ''
                }, 5000)
            }
        })

        /**
         * It submits the form and triggers our backend.
         */
        const submitForm = async (event: Event) => {
            try {
                if (honeypot.value) {
                    formState.value = 'submitted'
                    return
                }

                // Report validity and throw error if necessary
                const formElement = event.target as HTMLFormElement
                if (formElement.reportValidity && !formElement.reportValidity()) {
                    throw new Error('Ein Pflichtfeld wurde nicht ausgefüllt oder eine deiner Angaben ist ungültig.')
                }

                // Set form state to submitting
                formState.value = 'submitting'

                // Send form data to Cloud Functions
                const response = await fetch(SEND_CONTACT_EMAIL_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.value,
                        email: email.value,
                        message: message.value,
                        honeypot: honeypot.value,
                    }),
                })

                // Check response and throw error if necessary
                if (!response.ok) {
                    throw new Error((await response.json()).message)
                }

                // Track analytic event
                trackGoal(SEND_CONTACT_FORM_EVENT_ID)

                // Set form state to submitted
                formState.value = 'submitted'

                // Handle errors
            } catch (error: any) {
                // Set form state and error
                formState.value = 'error'
                formError.value = error.message

                // Remove value from required spam field
            } finally {
                honeypot.value = ''
            }
        }

        return {
            name,
            email,
            message,
            honeypot,
            formState,
            formError,
            submitForm,
        }
    },
})
</script>

<style lang="postcss" scoped>
.text-input {
    @apply w-full appearance-none rounded-none border-2 border-gray-600 bg-gray-600 p-4 text-base font-light text-white md:p-6 md:text-xl lg:p-8 lg:text-2xl;
}
.contact-form.error .text-input:invalid {
    @apply border-pink;
}
input.text-input {
    @apply h-12 md:h-16 lg:h-20;
}
</style>
