<template>
    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
        <h2 class="text-2xl font-black text-white md:text-3xl">Kostenlos anmelden</h2>

        <!-- Loading availability -->
        <p v-if="registration.phase === 'loading'" class="mt-6 text-lg font-light text-shade-200">
            Anmeldung wird geladen…
        </p>

        <!-- Could not load availability -->
        <div v-else-if="registration.phase === 'error'" class="mt-6" role="alert">
            <p class="text-lg font-light text-pink">{{ registration.message }}</p>
            <button type="button" :class="BUTTON_CLASS" class="mt-6" data-cursor-hover @click="registration.load()">
                Erneut versuchen
            </button>
        </div>

        <!-- Registered -->
        <div v-else-if="registration.phase === 'success'" class="mt-6 flex items-start gap-4" role="status">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime">
                <CheckIcon class="h-[26px] w-[26px] text-black" aria-hidden="true" />
            </div>
            <div>
                <p class="text-xl font-bold text-white">Du bist dabei!</p>
                <p class="mt-2 text-lg font-light leading-normal text-shade-200">
                    Wir haben dir eine Bestätigung an <strong class="font-bold text-lime">{{ form.email }}</strong>
                    geschickt. Darin findest du auch den Link, falls du doch nicht kommen kannst. Keine Mail da? Schau
                    bitte auch in deinen Spam-Ordner.
                </p>
            </div>
        </div>

        <!-- Closed (event started, registration switched off) -->
        <p v-else-if="registration.phase === 'unavailable'" class="mt-6 text-lg font-light text-shade-200">
            Die Anmeldung für dieses Meetup ist geschlossen.
        </p>

        <!-- Full: public spots are gone, internal registrations still possible -->
        <div v-else-if="registration.state === 'full' && !showFormWhenFull" class="mt-6">
            <p class="text-xl font-bold text-pink">Ausgebucht</p>
            <p class="mt-2 text-lg font-light leading-normal text-shade-200">
                Alle Plätze für dieses Meetup sind vergeben. Du arbeitest bei Lotum? Dann melde dich bitte trotzdem mit
                deiner Firmen-Adresse an, damit wir genug Essen einplanen.
            </p>
            <button type="button" :class="BUTTON_CLASS" class="mt-6" data-cursor-hover @click="showFormWhenFull = true">
                Intern anmelden
            </button>
        </div>

        <!-- Form -->
        <form v-else class="mt-6 space-y-6" :class="{ error: attempted }" novalidate @submit.prevent="onSubmit">
            <p
                v-if="registration.state === 'open' && registration.spotsLeft !== null"
                class="text-lg font-bold text-lime"
            >
                Noch {{ registration.spotsLeft }} {{ registration.spotsLeft === 1 ? 'Platz' : 'Plätze' }} frei
            </p>

            <!-- Honeypot: off-screen, hidden from AT and keyboard. The name is chosen so browsers and password
                 managers have no reason to autofill it; a filled one is dropped server-side. -->
            <input
                v-model="form.honeypot"
                class="sr-only"
                type="text"
                name="mr_extra"
                tabindex="-1"
                autocomplete="off"
                aria-hidden="true"
            />

            <div class="grid gap-6 md:grid-cols-2">
                <div>
                    <label class="form-label" :for="`${uid}-name`">Name *</label>
                    <input
                        :id="`${uid}-name`"
                        v-model="form.full_name"
                        type="text"
                        class="form-input"
                        autocomplete="name"
                        required
                        maxlength="100"
                    />
                </div>
                <div>
                    <label class="form-label" :for="`${uid}-pronouns`">Pronomen (optional)</label>
                    <input
                        :id="`${uid}-pronouns`"
                        v-model="form.pronouns"
                        type="text"
                        class="form-input"
                        placeholder="z. B. sie/ihr, er/ihm, they/them"
                        maxlength="50"
                    />
                </div>
                <div class="md:col-span-2">
                    <label class="form-label" :for="`${uid}-email`">E-Mail-Adresse *</label>
                    <input
                        :id="`${uid}-email`"
                        v-model="form.email"
                        type="email"
                        class="form-input"
                        autocomplete="email"
                        spellcheck="false"
                        required
                        maxlength="200"
                    />
                </div>
                <div>
                    <label class="form-label" :for="`${uid}-role`">Rolle (optional)</label>
                    <input
                        :id="`${uid}-role`"
                        v-model="form.role"
                        type="text"
                        class="form-input"
                        placeholder="z. B. Frontend-Entwicklerin, CTO"
                        autocomplete="organization-title"
                        maxlength="100"
                    />
                </div>
                <div>
                    <label class="form-label" :for="`${uid}-company`">Unternehmen (optional)</label>
                    <input
                        :id="`${uid}-company`"
                        v-model="form.company"
                        type="text"
                        class="form-input"
                        autocomplete="organization"
                        maxlength="100"
                    />
                </div>
                <div>
                    <label class="form-label" :for="`${uid}-heard`">
                        Wie hast du von diesem Meetup erfahren? (optional)
                    </label>
                    <select :id="`${uid}-heard`" v-model="form.heard_about_from" class="form-input">
                        <option value="">Bitte wählen</option>
                        <option v-for="option in MEETUP_HEARD_ABOUT_OPTIONS" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                </div>
                <div>
                    <label class="form-label" :for="`${uid}-meetup-account`">
                        Hast du einen Account auf meetup.com? (optional)
                    </label>
                    <select :id="`${uid}-meetup-account`" v-model="form.has_meetup_account" class="form-input">
                        <option value="">Keine Angabe</option>
                        <option value="yes">Ja</option>
                        <option value="no">Nein</option>
                    </select>
                </div>
                <div v-if="form.heard_about_from === 'other'" class="md:col-span-2">
                    <label class="form-label" :for="`${uid}-heard-other`">Woher denn? (optional)</label>
                    <input
                        :id="`${uid}-heard-other`"
                        v-model="form.heard_about_other"
                        type="text"
                        class="form-input"
                        maxlength="200"
                    />
                </div>
            </div>

            <label class="flex cursor-pointer items-start gap-3 text-base font-light text-white" data-cursor-hover>
                <input v-model="form.wants_meetup_updates" type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-lime" />
                <span>
                    Informiert mich per E-Mail über kommende Meetups.
                    <span class="text-shade-400">Freiwillig und jederzeit widerrufbar.</span>
                </span>
            </label>

            <TurnstileWidget
                v-if="registration.turnstileSiteKey"
                :key="turnstileKey"
                :site-key="registration.turnstileSiteKey"
                @token="(value) => (turnstileToken = value)"
            />

            <p v-if="registration.message" class="text-lg font-bold text-pink" role="alert">
                {{ registration.message }}
            </p>

            <button
                type="submit"
                :class="BUTTON_CLASS"
                :disabled="registration.phase === 'submitting'"
                data-cursor-hover
            >
                {{ registration.phase === 'submitting' ? 'Wird gesendet…' : 'Kostenlos anmelden' }}
            </button>

            <p class="text-sm font-light leading-normal text-shade-400">
                Mit der Anmeldung verarbeiten wir deine Angaben zur Organisation des Meetups. Details findest du in
                unserer
                <NuxtLink class="font-bold text-lime" data-cursor-hover to="/datenschutz">Datenschutzerklärung</NuxtLink
                >.
            </p>
        </form>
    </div>
</template>

<script setup lang="ts">
import CheckIcon from '~/assets/icons/check.svg'
import { useMeetupRegistration, type MeetupRegistrationFormData } from '~/composables/useMeetupRegistration'
import { MEETUP_HEARD_ABOUT_OPTIONS } from 'shared-code'
import { onMounted, reactive, ref } from 'vue'

const props = defineProps<{ meetupId: string }>()

const BUTTON_CLASS =
    'h-14 w-64 rounded-full border-4 border-lime text-sm font-black uppercase tracking-widest text-lime transition-all hover:bg-lime hover:text-black disabled:cursor-not-allowed disabled:opacity-50 md:h-16 md:w-80 md:border-5 md:text-lg'

const uid = useId()
const registration = useMeetupRegistration(props.meetupId)
const showFormWhenFull = ref(false)
const attempted = ref(false)
const turnstileToken = ref<string | null>(null)
// A Turnstile token is single-use, so a failed attempt needs a fresh challenge.
const turnstileKey = ref(0)

const form = reactive<MeetupRegistrationFormData>({
    full_name: '',
    email: '',
    pronouns: '',
    role: '',
    company: '',
    heard_about_from: '',
    heard_about_other: '',
    has_meetup_account: '',
    wants_meetup_updates: false,
    honeypot: '',
})

async function onSubmit(event: Event) {
    attempted.value = true
    const formElement = event.target as HTMLFormElement
    if (!formElement.reportValidity()) {
        return
    }
    form.email = form.email.trim()
    const registered = await registration.submit(form, turnstileToken.value)
    if (!registered && registration.turnstileSiteKey) {
        turnstileToken.value = null
        turnstileKey.value += 1
    }
}

onMounted(() => registration.load())
</script>

<style lang="postcss" scoped>
.form-label {
    @apply mb-2 block text-sm font-medium text-white/70;
}

.form-input {
    @apply w-full rounded border-2 border-gray-600 bg-gray-600 px-4 py-3 text-base text-white transition-colors focus:border-lime focus:outline-none;
}

.error .form-input:invalid {
    @apply border-pink;
}
</style>
