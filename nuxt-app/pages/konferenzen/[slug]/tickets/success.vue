<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import { getMetaInfo } from '~/helpers'
import { computed, onMounted } from 'vue'

const route = useRoute()
const directus = useDirectus()
const store = useTicketCheckoutStore()

// Clear the checkout store on success (client-side only)
onMounted(() => {
    store.resetBySlug(route.params.slug as string)
})

// Query conference data
const { data: pageData } = useAsyncData(route.fullPath, async () => {
    const conference = await directus.getConferenceBySlug(route.params.slug as string)

    if (!conference) {
        throw createError({
            statusCode: 404,
            message: 'Konferenz nicht gefunden',
        })
    }

    return { conference }
})

const conference = computed(() => pageData.value?.conference)

// Set page meta data
useHead(() =>
    conference.value
        ? getMetaInfo({
              type: 'website',
              path: route.path,
              title: `Bestellung erfolgreich - ${conference.value.title}`,
              description: `Deine Tickets für die ${conference.value.title} wurden bestellt`,
              image: conference.value.cover_image,
          })
        : {}
)
</script>

<template>
    <div class="min-h-screen bg-black text-white">
        <div class="container mx-auto px-6 py-16 md:py-24">
            <div class="mx-auto max-w-2xl text-center">
                <!-- Success icon -->
                <div class="mb-8 flex justify-center">
                    <div class="flex h-24 w-24 items-center justify-center rounded-full bg-lime/20">
                        <svg class="h-12 w-12 text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <h1 class="text-4xl font-bold md:text-5xl">Vielen Dank!</h1>

                <p class="text-gray-300 mt-6 text-xl">Deine Bestellung war erfolgreich.</p>

                <div class="mt-8 rounded-lg bg-gray-800/50 p-6 text-left">
                    <h2 class="mb-4 text-lg font-bold text-lime">Was passiert jetzt?</h2>
                    <ul class="text-gray-300 space-y-3">
                        <li class="flex items-start gap-3">
                            <span
                                class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime"
                                >1</span
                            >
                            <span>Du erhältst in Kürze eine Bestätigungs-E-Mail mit deinen Tickets.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span
                                class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime"
                                >2</span
                            >
                            <span>Jedes Ticket enthält einen QR-Code, den du beim Check-in vorzeigen kannst.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span
                                class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime"
                                >3</span
                            >
                            <span
                                >Falls du mehrere Tickets gekauft hast, werden die anderen Teilnehmer ebenfalls per
                                E-Mail benachrichtigt.</span
                            >
                        </li>
                    </ul>
                </div>

                <p class="mt-8 text-sm text-[#848a98]">
                    Keine E-Mail erhalten? Prüfe deinen Spam-Ordner oder kontaktiere uns unter
                    <a href="mailto:podcast@programmier.bar" class="text-lime hover:underline">
                        podcast@programmier.bar
                    </a>
                </p>

                <div class="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
                    <NuxtLink
                        v-if="conference"
                        :to="`/konferenzen/${conference.slug}`"
                        class="rounded-lg bg-lime px-8 py-4 font-bold text-black transition hover:bg-lime/90"
                    >
                        Zurück zur Konferenz
                    </NuxtLink>
                    <NuxtLink
                        to="/"
                        class="rounded-lg border border-gray-700 px-8 py-4 font-bold text-white transition hover:border-gray-600"
                    >
                        Zur Startseite
                    </NuxtLink>
                </div>
            </div>
        </div>
    </div>
</template>
