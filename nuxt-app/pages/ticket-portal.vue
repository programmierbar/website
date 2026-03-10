<template>
    <div class="relative min-h-screen">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Loading State -->
            <div v-if="loading" class="mt-16 text-center">
                <p class="text-xl text-white">Zugang wird überprüft...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="mt-16">
                <SectionHeading element="h1">Zugang verweigert</SectionHeading>
                <p class="mt-8 text-xl text-pink">{{ error }}</p>
                <p class="mt-4 text-lg text-white/60">
                    Falls du glaubst, dass es sich um einen Fehler handelt, kontaktiere uns bitte unter
                    <a href="mailto:podcast@programmier.bar" class="text-lime hover:text-blue">
                        podcast@programmier.bar
                    </a>
                </p>
            </div>

            <!-- Success State -->
            <div v-else-if="submitted" class="mt-16">
                <SectionHeading element="h1">Vielen Dank!</SectionHeading>
                <p class="mt-8 text-xl text-white">
                    Deine Angaben wurden erfolgreich gespeichert.
                    Dein Ticket mit QR-Code wird dir in Kürze per E-Mail zugeschickt.
                </p>
            </div>

            <!-- Form -->
            <div v-else-if="ticket">
                <SectionHeading class="mt-8 md:mt-0" element="h1">Ticket vervollständigen</SectionHeading>

                <p class="mt-8 text-lg text-white md:text-xl">
                    Hallo {{ ticket.attendee_first_name }}! Bitte vervollständige deine Angaben,
                    damit wir dir dein finales Ticket für die {{ ticket.conference_title }} zusenden können.
                </p>

                <form
                    class="mt-12 space-y-8"
                    :class="formState"
                    novalidate
                    @submit.prevent="submitForm"
                >
                    <!-- Personal Info Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Persönliche Informationen</h2>

                        <div class="grid gap-6 md:grid-cols-2">
                            <!-- Job Title -->
                            <div>
                                <label class="form-label">Job / Rolle *</label>
                                <input
                                    v-model="formData.job_title"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. Senior Developer, CTO, Product Manager"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <!-- Company -->
                            <div>
                                <label class="form-label">Unternehmen *</label>
                                <input
                                    v-model="formData.company"
                                    type="text"
                                    class="form-input"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <!-- Pronouns -->
                            <div>
                                <label class="form-label">Pronomen (optional)</label>
                                <input
                                    v-model="formData.pronouns"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. sie/ihr, er/ihm, they/them"
                                    maxlength="50"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Event Details Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Event-Details</h2>

                        <div class="grid gap-6 md:grid-cols-2">
                            <!-- Dietary Preferences -->
                            <div>
                                <label class="form-label">Ernährungspräferenzen (optional)</label>
                                <input
                                    v-model="formData.dietary_preferences"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. vegetarisch, vegan, glutenfrei"
                                    maxlength="200"
                                />
                            </div>

                            <!-- T-Shirt Size -->
                            <div>
                                <label class="form-label">T-Shirt-Größe (optional)</label>
                                <select v-model="formData.tshirt_size" class="form-select">
                                    <option value="">Bitte wählen</option>
                                    <option value="S">S</option>
                                    <option value="M">M</option>
                                    <option value="L">L</option>
                                    <option value="XL">XL</option>
                                    <option value="XXL">XXL</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Feedback Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Feedback</h2>

                        <div class="space-y-6">
                            <!-- Last Event Visited -->
                            <div>
                                <label class="form-label">Letztes Event besucht? (optional)</label>
                                <input
                                    v-model="formData.last_event_visited"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. San Juan Conf 2025, programmier.bar Meetup #42"
                                    maxlength="200"
                                />
                            </div>

                            <!-- How did you hear about this event -->
                            <div>
                                <label class="form-label">Wie hast du von diesem Event erfahren? (optional)</label>
                                <input
                                    v-model="formData.heard_about_from"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. Podcast, Social Media, Empfehlung"
                                    maxlength="500"
                                />
                            </div>

                            <!-- Additional Notes -->
                            <div>
                                <label class="form-label">Möchtest du uns noch etwas mitteilen? (optional)</label>
                                <textarea
                                    v-model="formData.additional_notes"
                                    class="form-textarea"
                                    rows="4"
                                    maxlength="1000"
                                />
                                <p class="mt-1 text-sm text-white/60">
                                    {{ formData.additional_notes?.length || 0 }} / 1000 Zeichen
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <p v-if="formError" class="text-lg text-pink">{{ formError }}</p>

                    <!-- Submit Button -->
                    <div class="flex justify-center">
                        <button
                            type="submit"
                            class="h-14 w-64 rounded-full border-4 border-lime text-sm font-black uppercase tracking-widest text-lime transition-all hover:bg-lime hover:text-black disabled:cursor-not-allowed disabled:opacity-50 md:h-16 md:w-80 md:border-5 md:text-lg lg:h-20 lg:w-112 lg:border-6 lg:text-xl"
                            :disabled="formState === 'submitting'"
                        >
                            {{ formState === 'submitting' ? 'Wird gesendet...' : 'Absenden' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMetaInfo } from '~/helpers'

const route = useRoute()

const breadcrumbs = [{ label: 'Ticket vervollständigen' }]

// State
const loading = ref(true)
const error = ref<string | null>(null)
const submitted = ref(false)
const ticket = ref<any>(null)
const formState = ref<'pending' | 'submitting' | 'error'>('pending')
const formError = ref('')

// Form data
const formData = ref({
    job_title: '',
    company: '',
    pronouns: '',
    dietary_preferences: '',
    tshirt_size: '',
    last_event_visited: '',
    heard_about_from: '',
    additional_notes: '',
})

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Ticket vervollständigen',
        noIndex: true,
    })
)

// Validate token on mount
onMounted(async () => {
    const token = route.query.token as string

    if (!token) {
        loading.value = false
        error.value = 'Kein Zugangstoken vorhanden. Bitte nutze den Link aus deiner E-Mail.'
        return
    }

    try {
        const response = await fetch(`/api/ticket-portal/validate?token=${encodeURIComponent(token)}`)
        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.message || 'Ungültiger oder abgelaufener Token')
        }

        ticket.value = data.ticket

        // Pre-fill form with existing data
        formData.value = {
            job_title: data.ticket.job_title || '',
            company: data.ticket.company || '',
            pronouns: data.ticket.pronouns || '',
            dietary_preferences: data.ticket.dietary_preferences || '',
            tshirt_size: data.ticket.tshirt_size || '',
            last_event_visited: data.ticket.last_event_visited || '',
            heard_about_from: data.ticket.heard_about_from || '',
            additional_notes: data.ticket.additional_notes || '',
        }
    } catch (err: any) {
        error.value = err.message
    } finally {
        loading.value = false
    }
})

async function submitForm(event: Event) {
    const formElement = event.target as HTMLFormElement
    if (formElement.reportValidity && !formElement.reportValidity()) {
        formError.value = 'Bitte fülle alle Pflichtfelder aus.'
        formState.value = 'error'
        return
    }

    formState.value = 'submitting'
    formError.value = ''

    try {
        const token = route.query.token as string

        const response = await fetch('/api/ticket-portal/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                data: formData.value,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.message || 'Fehler beim Absenden')
        }

        submitted.value = true
        window.scrollTo(0, 0)
    } catch (err: any) {
        formError.value = err.message
        formState.value = 'error'
    }
}
</script>

<style lang="postcss" scoped>
.form-label {
    @apply mb-2 block text-sm font-medium text-white/70;
}

.form-input {
    @apply w-full rounded border-2 border-gray-600 bg-gray-600 px-4 py-3 text-base text-white transition-colors focus:border-lime focus:outline-none;
}

.form-select {
    @apply w-full rounded border-2 border-gray-600 bg-gray-600 px-4 py-3 text-base text-white transition-colors focus:border-lime focus:outline-none;
}

.form-textarea {
    @apply w-full rounded border-2 border-gray-600 bg-gray-600 px-4 py-3 text-base text-white transition-colors focus:border-lime focus:outline-none;
}

.error .form-input:invalid,
.error .form-textarea:invalid {
    @apply border-pink;
}
</style>
