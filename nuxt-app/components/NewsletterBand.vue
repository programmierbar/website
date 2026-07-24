<script setup lang="ts">
import { useNewsletterSignup } from '~/composables'
import { ref } from 'vue'

const props = withDefaults(
    defineProps<{
        expanded?: boolean
    }>(),
    {
        expanded: false,
    }
)

const showNewsletter = useRuntimeConfig().public.FLAG_SHOW_NEWSLETTER

const email = ref('')
// Honeypot: kept empty by humans, filled by naive bots. Submitted to the
// server route, which silently drops any request where it's set.
const honeypot = ref('')
const signup = useNewsletterSignup()

// Unique per instance so the label/hint stay valid when rendered often
const uid = useId()
const emailId = `${uid}-email`
const hintId = `${uid}-hint`

const title = '// Newsletter'
const headline = props.expanded ? 'Nichts mehr verpassen' : 'Regelmäßige Dev-News'
const subheadline = props.expanded
    ? 'Neue Folgen, Meetups und Konferenzen — einmal pro Woche direkt in dein Postfach. Kein Spam, versprochen.'
    : 'Eine E-Mail. Alles Wichtige. Kein Spam.'
const privacyUrl = '/datenschutz'

// Clear a previous validation error as soon as the user edits the field again.
function onInput() {
    if (signup.status === 'error') {
        signup.reset()
    }
}

function onSubmit() {
    signup.subscribe(email.value, honeypot.value)
}

function onReset() {
    email.value = ''
    honeypot.value = ''
    signup.reset()
}
</script>

<template>
    <div
        v-if="showNewsletter"
        class="newsletter-band relative"
        :class="expanded ? 'px-6 py-12 md:px-16 md:py-20' : 'px-6 py-10 md:px-14 md:py-12'"
    >
        <div
            class="relative z-10 flex flex-col items-center"
            :class="
                expanded
                    ? 'mx-auto max-w-[640px] gap-5 text-center'
                    : 'gap-8 text-left md:flex-row md:items-center md:gap-12'
            "
        >
            <div :class="expanded ? '' : 'min-w-0 md:flex-1'">
                <div class="mb-3 font-azeret text-sm uppercase tracking-[0.15em] text-blue">
                    {{ title }}
                </div>
                <h3
                    class="m-0 font-black leading-[1.05] text-white"
                    :class="expanded ? 'text-4xl md:text-[44px]' : 'text-3xl'"
                >
                    {{ headline }}
                </h3>
                <p class="mt-3.5 text-lg font-light leading-normal text-shade-200">
                    {{ subheadline }}
                </p>
            </div>

            <div class="w-full" :class="expanded ? 'max-w-[520px]' : 'md:flex-1'">
                <form
                    v-if="signup.status === 'idle' || signup.status === 'error' || signup.status === 'loading'"
                    class="flex flex-col gap-2.5"
                    novalidate
                    @submit.prevent="onSubmit"
                >
                    <!-- Honeypot: off-screen, hidden from AT and keyboard; bots that fill it are dropped server-side. -->
                    <input
                        v-model="honeypot"
                        class="sr-only"
                        type="text"
                        name="website"
                        tabindex="-1"
                        autocomplete="off"
                        aria-hidden="true"
                    />

                    <div class="flex flex-wrap items-end gap-3.5">
                        <label class="sr-only" :for="emailId">E-Mail-Adresse</label>
                        <input
                            :id="emailId"
                            v-model="email"
                            type="email"
                            name="email"
                            placeholder="deine@email.de"
                            autocomplete="email"
                            spellcheck="false"
                            :aria-invalid="signup.status === 'error'"
                            :aria-describedby="hintId"
                            class="min-w-[200px] flex-1 rounded-none border-0 border-b-2 bg-transparent px-0.5 py-3 text-lg font-medium text-white outline-none transition-colors focus:border-blue"
                            :class="signup.status === 'error' ? 'border-pink' : 'border-shade-800'"
                            @input="onInput"
                        />
                        <button
                            type="submit"
                            :disabled="signup.status === 'loading'"
                            class="h-12 rounded-full bg-lime px-6 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            data-cursor-hover
                        >
                            {{ signup.status === 'loading' ? 'Wird gesendet…' : 'Abonnieren' }}
                        </button>
                    </div>

                    <p
                        v-if="signup.status === 'error'"
                        class="flex items-center gap-2 text-sm font-bold text-pink"
                        role="alert"
                    >
                        <svg
                            class="shrink-0"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
                        </svg>
                        <span>{{ signup.message || 'Bitte gib eine gültige E-Mail-Adresse ein.' }}</span>
                    </p>

                    <p :id="hintId" class="mt-1 text-xs font-light text-shade-400">
                        Abmeldung jederzeit möglich.
                        <NuxtLink class="font-bold text-lime" data-cursor-hover :href="privacyUrl">
                            Datenschutzbestimmungen
                        </NuxtLink>
                        gelten.
                    </p>
                </form>

                <!-- Success: double-opt-in mail sent -->
                <div v-else-if="signup.status === 'success'" class="flex items-center gap-4 text-left" role="status">
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime">
                        <svg
                            width="26"
                            height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#000"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    </div>
                    <div>
                        <div class="text-lg font-bold text-white">Fast geschafft!</div>
                        <p class="mt-0.5 text-sm font-light text-shade-300">
                            Bestätige den Link an <strong class="font-black text-lime">{{ email }}</strong
                            >.
                            <button
                                type="button"
                                class="text-[11px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:text-blue"
                                @click="onReset"
                            >
                                Ändern
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
