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
                    <a :href="`mailto:${SPEAKER_PORTAL_CONTACT_EMAIL}`" class="text-lime hover:text-blue">
                        {{ SPEAKER_PORTAL_CONTACT_EMAIL }}
                    </a>
                </p>
            </div>

            <!-- Success State -->
            <div v-else-if="submitted" class="mt-16">
                <SectionHeading element="h1">Vielen Dank!</SectionHeading>
                <p class="mt-8 text-xl text-white">
                    Deine Informationen wurden erfolgreich übermittelt. Wir melden uns bei dir, sobald wir alles geprüft
                    haben.
                </p>
            </div>

            <!-- Form -->
            <div v-else-if="speaker">
                <SectionHeading class="mt-8 md:mt-0" element="h1">Speaker Portal</SectionHeading>

                <p class="mt-8 text-lg text-white md:text-xl">
                    Hallo {{ speaker.first_name }}! Bitte fülle die folgenden Informationen aus, damit wir dich optimal
                    auf unserer Website präsentieren können.
                </p>

                <p v-if="deadline" class="mt-4 text-base text-lime">Bitte bis {{ formatDate(deadline) }} ausfüllen.</p>

                <form class="mt-12 space-y-8" :class="formState" novalidate @submit.prevent="submitForm">
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
                            <p class="mb-2 text-sm text-white/60">
                                Bitte schreibe die Bio in der dritten Person Singular, nicht in der Ich-Form (z. B.
                                „Erika Mustermann arbeitet remote als Head of Engineering bei der Beispiel GmbH …“).
                            </p>
                            <textarea
                                v-model="formData.description"
                                class="form-textarea"
                                rows="5"
                                placeholder="z. B. „Erika Mustermann arbeitet remote als Head of Engineering bei der Beispiel GmbH und beschäftigt sich vor allem mit …“"
                                required
                                maxlength="2000"
                            />
                            <p class="mt-1 text-sm text-white/60">
                                {{ formData.description?.length || 0 }} / 2000 Zeichen
                            </p>
                        </div>
                    </div>

                    <!-- Social Links Section -->
                    <div class="bg-gray-900 p-6 md:p-8 lg:p-12">
                        <h2 class="mb-6 text-xl font-bold text-lime md:text-2xl">Social Media & Links</h2>
                        <p class="mb-6 text-white/60">
                            Alle Felder sind optional. LinkedIn empfehlen wir besonders, da wir dich dort taggen können.
                        </p>

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
                            :disabled="formState === 'submitting' || preparingImages > 0"
                        >
                            {{
                                formState === 'submitting'
                                    ? 'Wird gesendet...'
                                    : preparingImages > 0
                                      ? 'Bild wird vorbereitet...'
                                      : 'Absenden'
                            }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { getMetaInfo } from '~/helpers'
import { downscaleImage, fitImagesIntoBudget, MAX_IMAGE_UPLOAD_BYTES } from '~/helpers/downscaleImage'
import { formatOccupation, parseOccupation } from '~/helpers/speakerOccupation'
import {
    getSpeakerPortalErrorMessage,
    getSpeakerPortalUserMessage,
    requestSpeakerPortal,
    SPEAKER_PORTAL_CONTACT_EMAIL,
    SpeakerPortalError,
} from '~/helpers/speakerPortalRequest'
import { onBeforeUnmount, onMounted, ref } from 'vue'

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
const preparingImages = ref(0)

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
        error.value = 'Dein Link enthält keinen Zugangscode. Bitte nutze den Link aus deiner Einladungs-E-Mail.'
        return
    }

    try {
        const data = await requestSpeakerPortal<{ speaker: any }>(
            `/api/speaker-portal/validate?token=${encodeURIComponent(token)}`
        )

        speaker.value = data.speaker
        deadline.value = data.speaker.portal_submission_deadline

        // Pre-fill form with existing data
        const occupation = parseOccupation(data.speaker.occupation)
        formData.value = {
            academic_title: data.speaker.academic_title || '',
            first_name: data.speaker.first_name || '',
            last_name: data.speaker.last_name || '',
            job_title: occupation.jobTitle,
            company: occupation.company,
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
    } catch (err) {
        error.value = getSpeakerPortalUserMessage(err)
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

const MIN_IMAGE_SIZE = 800

function validateImageDimensions(file: File): Promise<{ valid: boolean; width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({
                valid: img.width >= MIN_IMAGE_SIZE && img.height >= MIN_IMAGE_SIZE,
                width: img.width,
                height: img.height,
            })
        }

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({ valid: false, width: 0, height: 0 })
        }

        img.src = objectUrl
    })
}

/**
 * Checks the chosen image and shrinks it to an uploadable size. Returns the file to upload, or the
 * message to show if the image cannot be used. Leaves the page state alone: by the time this resolves
 * the speaker may already have picked another image.
 */
async function prepareImage(file: File, label: string): Promise<{ file: File } | { error: string }> {
    const { valid, width, height } = await validateImageDimensions(file)
    if (!valid) {
        return {
            error:
                width && height
                    ? `${label} muss mindestens ${MIN_IMAGE_SIZE}x${MIN_IMAGE_SIZE} Pixel groß sein. Dein Bild: ${width}x${height} Pixel.`
                    : `${label} konnte nicht gelesen werden. Bitte wähle ein JPG- oder PNG-Bild aus.`,
        }
    }

    let uploadFile = file
    try {
        uploadFile = await downscaleImage(file)
    } catch (err) {
        // Keep the original; the size check below decides whether it can still be sent.
        console.error(`Speaker portal: could not downscale ${label}:`, err)
    }

    if (uploadFile.size > MAX_IMAGE_UPLOAD_BYTES) {
        return {
            error: `${label} ist zu groß zum Hochladen. Bitte wähle ein Bild mit höchstens ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)} MB aus.`,
        }
    }

    return { file: uploadFile }
}

const imageSlots = {
    profile: { label: 'Das Profilbild', file: profileImageFile, preview: profileImagePreview, selection: 0 },
    action: { label: 'Der Action Shot', file: actionImageFile, preview: actionImagePreview, selection: 0 },
}

async function handleImageChange(event: Event, slot: (typeof imageSlots)[keyof typeof imageSlots]) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
        return
    }

    // Resizing a large photo takes a moment. Submitting is blocked meanwhile, and a result that
    // arrives after the speaker already picked another image is dropped.
    const selection = ++slot.selection
    preparingImages.value++
    let result: Awaited<ReturnType<typeof prepareImage>>
    try {
        result = await prepareImage(file, slot.label)
    } finally {
        preparingImages.value--
    }
    if (selection !== slot.selection) {
        return
    }

    if ('error' in result) {
        formError.value = result.error
        formState.value = 'error'
        input.value = '' // Reset input
        return
    }

    formError.value = ''
    formState.value = 'pending'
    // Revoke previous object URL to prevent memory leak
    if (slot.preview.value) {
        URL.revokeObjectURL(slot.preview.value)
    }
    slot.file.value = result.file
    slot.preview.value = URL.createObjectURL(result.file)
}

function handleProfileImageChange(event: Event) {
    return handleImageChange(event, imageSlots.profile)
}

function handleActionImageChange(event: Event) {
    return handleImageChange(event, imageSlots.action)
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
    // The button is disabled meanwhile, but Enter in a text field still submits.
    if (formState.value === 'submitting' || preparingImages.value > 0) {
        return
    }

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
        submitData.append(
            'data',
            JSON.stringify({
                ...formData.value,
                occupation: formatOccupation({ jobTitle: formData.value.job_title, company: formData.value.company }),
            })
        )

        const images = [
            { field: 'profile_image', file: profileImageFile.value },
            { field: 'event_image', file: actionImageFile.value },
        ].filter((image): image is { field: string; file: File } => image.file !== null)

        // Each image is at most 3 MB, but both together must still fit into one request.
        const fittedFiles = await fitImagesIntoBudget(images.map((image) => image.file))
        if (!fittedFiles) {
            throw new SpeakerPortalError(getSpeakerPortalErrorMessage(413, undefined))
        }
        images.forEach((image, index) => submitData.append(image.field, fittedFiles[index]!))

        await requestSpeakerPortal('/api/speaker-portal/submit', {
            method: 'POST',
            body: submitData,
        })

        submitted.value = true
        window.scrollTo(0, 0)
    } catch (err) {
        formError.value = getSpeakerPortalUserMessage(err)
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
