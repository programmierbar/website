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
                    Deine Informationen wurden erfolgreich übermittelt.
                    Wir melden uns bei dir, sobald wir alles geprüft haben.
                </p>
            </div>

            <!-- Form -->
            <div v-else-if="speaker">
                <SectionHeading class="mt-8 md:mt-0" element="h1">Speaker Portal</SectionHeading>

                <p class="mt-8 text-lg text-white md:text-xl">
                    Hallo {{ speaker.first_name }}! Bitte fülle die folgenden Informationen aus,
                    damit wir dich optimal auf unserer Website präsentieren können.
                </p>

                <p v-if="deadline" class="mt-4 text-base text-lime">
                    Bitte bis {{ formatDate(deadline) }} ausfüllen.
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
                            <!-- Academic Title -->
                            <div>
                                <label class="form-label">Akademischer Titel (optional)</label>
                                <select v-model="formData.academic_title" class="form-select">
                                    <option value="">Kein Titel</option>
                                    <option value="Dr.">Dr.</option>
                                    <option value="Prof.">Prof.</option>
                                    <option value="Prof. Dr.">Prof. Dr.</option>
                                </select>
                            </div>

                            <!-- First Name -->
                            <div>
                                <label class="form-label">Vorname *</label>
                                <input
                                    v-model="formData.first_name"
                                    type="text"
                                    class="form-input"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <!-- Last Name -->
                            <div>
                                <label class="form-label">Nachname *</label>
                                <input
                                    v-model="formData.last_name"
                                    type="text"
                                    class="form-input"
                                    required
                                    maxlength="100"
                                />
                            </div>

                            <!-- Job Title -->
                            <div>
                                <label class="form-label">Jobtitel *</label>
                                <input
                                    v-model="formData.job_title"
                                    type="text"
                                    class="form-input"
                                    placeholder="z.B. Senior Developer, CTO"
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
                        </div>

                        <!-- Bio -->
                        <div class="mt-6">
                            <label class="form-label">Bio / Beschreibung *</label>
                            <textarea
                                v-model="formData.description"
                                class="form-textarea"
                                rows="5"
                                placeholder="Erzähl uns ein bisschen über dich und deine Arbeit..."
                                required
                                maxlength="2000"
                            />
                            <p class="mt-1 text-sm text-white/60">{{ formData.description?.length || 0 }} / 2000 Zeichen</p>
                        </div>
                    </div>

                    <!-- Social Links Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Social Media & Links</h2>
                        <p class="mb-6 text-white/60">Alle Felder sind optional. LinkedIn empfehlen wir besonders, da wir dich dort taggen können.</p>

                        <div class="grid gap-6 md:grid-cols-2">
                            <div>
                                <label class="form-label">Website</label>
                                <input
                                    v-model="formData.website_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label class="form-label">LinkedIn (empfohlen)</label>
                                <input
                                    v-model="formData.linkedin_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://linkedin.com/in/..."
                                />
                            </div>
                            <div>
                                <label class="form-label">Twitter / X</label>
                                <input
                                    v-model="formData.twitter_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://twitter.com/..."
                                />
                            </div>
                            <div>
                                <label class="form-label">Bluesky</label>
                                <input
                                    v-model="formData.bluesky_url"
                                    type="text"
                                    class="form-input"
                                    placeholder="@handle.bsky.social"
                                />
                            </div>
                            <div>
                                <label class="form-label">GitHub</label>
                                <input
                                    v-model="formData.github_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://github.com/..."
                                />
                            </div>
                            <div>
                                <label class="form-label">Instagram</label>
                                <input
                                    v-model="formData.instagram_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                            <div>
                                <label class="form-label">YouTube</label>
                                <input
                                    v-model="formData.youtube_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                            <div>
                                <label class="form-label">Mastodon</label>
                                <input
                                    v-model="formData.mastodon_url"
                                    type="url"
                                    class="form-input"
                                    placeholder="https://mastodon.social/@..."
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Image Upload Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Bilder</h2>

                        <div class="grid gap-8 md:grid-cols-2">
                            <!-- Profile Image -->
                            <div>
                                <label class="form-label">Profilbild *</label>
                                <p class="mb-4 text-sm text-white/60">
                                    Ein professionelles Portrait. Mindestens 800x800 Pixel, JPG oder PNG.
                                </p>
                                <div class="relative">
                                    <input
                                        ref="profileImageInput"
                                        type="file"
                                        accept="image/jpeg,image/png"
                                        class="hidden"
                                        @change="handleProfileImageChange"
                                    />
                                    <div
                                        class="flex h-48 w-full cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-600 transition-colors hover:border-lime"
                                        @click="($refs.profileImageInput as HTMLInputElement).click()"
                                    >
                                        <img
                                            v-if="profileImagePreview"
                                            :src="profileImagePreview"
                                            class="h-full w-full object-contain"
                                            alt="Profile preview"
                                        />
                                        <span v-else class="text-white/60">Klicken zum Hochladen</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Image -->
                            <div>
                                <label class="form-label">Action Shot / Candid Foto *</label>
                                <p class="mb-4 text-sm text-white/60">
                                    Ein lockeres Foto bei der Arbeit oder einer Aktivität. Mindestens 800x800 Pixel.
                                </p>
                                <div class="relative">
                                    <input
                                        ref="actionImageInput"
                                        type="file"
                                        accept="image/jpeg,image/png"
                                        class="hidden"
                                        @change="handleActionImageChange"
                                    />
                                    <div
                                        class="flex h-48 w-full cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-600 transition-colors hover:border-lime"
                                        @click="($refs.actionImageInput as HTMLInputElement).click()"
                                    >
                                        <img
                                            v-if="actionImagePreview"
                                            :src="actionImagePreview"
                                            class="h-full w-full object-contain"
                                            alt="Action preview"
                                        />
                                        <span v-else class="text-white/60">Klicken zum Hochladen</span>
                                    </div>
                                </div>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getMetaInfo } from '~/helpers'

const route = useRoute()

const breadcrumbs = [{ label: 'Speaker Portal' }]

// State
const loading = ref(true)
const error = ref<string | null>(null)
const submitted = ref(false)
const speaker = ref<any>(null)
const deadline = ref<string | null>(null)
const formState = ref<'pending' | 'submitting' | 'error'>('pending')
const formError = ref('')

// Form data
const formData = ref({
    academic_title: '',
    first_name: '',
    last_name: '',
    job_title: '',
    company: '',
    description: '',
    website_url: '',
    linkedin_url: '',
    twitter_url: '',
    bluesky_url: '',
    github_url: '',
    instagram_url: '',
    youtube_url: '',
    mastodon_url: '',
})

// Image handling
const profileImageInput = ref<HTMLInputElement | null>(null)
const actionImageInput = ref<HTMLInputElement | null>(null)
const profileImagePreview = ref<string | null>(null)
const actionImagePreview = ref<string | null>(null)
const profileImageFile = ref<File | null>(null)
const actionImageFile = ref<File | null>(null)

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Speaker Portal',
        noIndex: true,
    })
)

// Validate token on mount
onMounted(async () => {
    const token = route.query.token as string

    if (!token) {
        loading.value = false
        error.value = 'No access token provided. Please use the link from your invitation email.'
        return
    }

    try {
        const response = await fetch(`/api/speaker-portal/validate?token=${encodeURIComponent(token)}`)
        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.message || 'Invalid or expired token')
        }

        speaker.value = data.speaker
        deadline.value = data.speaker.portal_submission_deadline

        // Pre-fill form with existing data
        formData.value = {
            academic_title: data.speaker.academic_title || '',
            first_name: data.speaker.first_name || '',
            last_name: data.speaker.last_name || '',
            job_title: data.speaker.occupation?.split(' at ')[0] || '',
            company: data.speaker.occupation?.split(' at ')[1] || '',
            description: data.speaker.description || '',
            website_url: data.speaker.website_url || '',
            linkedin_url: data.speaker.linkedin_url || '',
            twitter_url: data.speaker.twitter_url || '',
            bluesky_url: data.speaker.bluesky_url || '',
            github_url: data.speaker.github_url || '',
            instagram_url: data.speaker.instagram_url || '',
            youtube_url: data.speaker.youtube_url || '',
            mastodon_url: data.speaker.mastodon_url || '',
        }
    } catch (err: any) {
        error.value = err.message
    } finally {
        loading.value = false
    }
})

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

function handleProfileImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files[0]) {
        // Revoke previous object URL to prevent memory leak
        if (profileImagePreview.value) {
            URL.revokeObjectURL(profileImagePreview.value)
        }
        profileImageFile.value = input.files[0]
        profileImagePreview.value = URL.createObjectURL(input.files[0])
    }
}

function handleActionImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files[0]) {
        // Revoke previous object URL to prevent memory leak
        if (actionImagePreview.value) {
            URL.revokeObjectURL(actionImagePreview.value)
        }
        actionImageFile.value = input.files[0]
        actionImagePreview.value = URL.createObjectURL(input.files[0])
    }
}

// Clean up object URLs on component unmount
onBeforeUnmount(() => {
    if (profileImagePreview.value) {
        URL.revokeObjectURL(profileImagePreview.value)
    }
    if (actionImagePreview.value) {
        URL.revokeObjectURL(actionImagePreview.value)
    }
})

async function submitForm(event: Event) {
    const formElement = event.target as HTMLFormElement
    if (formElement.reportValidity && !formElement.reportValidity()) {
        formError.value = 'Bitte fülle alle Pflichtfelder aus.'
        formState.value = 'error'
        return
    }

    // Validate images
    if (!profileImageFile.value && !speaker.value?.profile_image) {
        formError.value = 'Bitte lade ein Profilbild hoch.'
        formState.value = 'error'
        return
    }

    if (!actionImageFile.value && !speaker.value?.event_image) {
        formError.value = 'Bitte lade ein Action Shot hoch.'
        formState.value = 'error'
        return
    }

    formState.value = 'submitting'
    formError.value = ''

    try {
        const token = route.query.token as string
        const submitData = new FormData()

        submitData.append('token', token)
        submitData.append('data', JSON.stringify({
            ...formData.value,
            occupation: `${formData.value.job_title} at ${formData.value.company}`,
        }))

        if (profileImageFile.value) {
            submitData.append('profile_image', profileImageFile.value)
        }
        if (actionImageFile.value) {
            submitData.append('event_image', actionImageFile.value)
        }

        const response = await fetch('/api/speaker-portal/submit', {
            method: 'POST',
            body: submitData,
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.message || 'Submission failed')
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
