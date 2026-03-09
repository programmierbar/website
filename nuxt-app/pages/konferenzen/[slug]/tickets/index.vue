<script setup lang="ts">
import TicketPurchaseFlow from '~/components/tickets/TicketPurchaseFlow.vue'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import { computed, onMounted, ref } from 'vue'

const route = useRoute()
const directus = useDirectus()

// Check for cancelled state from Stripe redirect
const wasCancelled = ref(false)
onMounted(() => {
    if (route.query.cancelled === 'true') {
        wasCancelled.value = true
    }
})

// Query conference data and ticket settings
const { data: pageData, error } = useAsyncData(route.fullPath, async () => {
    const [conference, ticketSettings] = await Promise.all([
        directus.getConferenceBySlug(route.params.slug as string),
        directus.getTicketSettings(),
    ])

    if (!conference) {
        throw createError({
            statusCode: 404,
            message: 'Konferenz nicht gefunden',
        })
    }

    return { conference, ticketSettings }
})

const conference = computed(() => pageData.value?.conference)
const ticketSettings = computed(() => pageData.value?.ticketSettings)

// Check if ticketing is enabled
const ticketingAvailable = computed(() => {
    return conference.value?.ticketing_enabled === true
})

// Set page meta data
useHead(() =>
    conference.value
        ? getMetaInfo({
              type: 'website',
              path: route.path,
              title: `Tickets - ${conference.value.title}`,
              description: `Tickets für die ${conference.value.title} kaufen`,
              image: conference.value.cover_image,
          })
        : {}
)

// Breadcrumbs
const breadcrumbs = computed(() => [
    { label: 'Konferenz', href: '/konferenzen' },
    { label: conference.value?.title || '', href: `/konferenzen/${route.params.slug}` },
    { label: 'Tickets' },
])
</script>

<template>
    <div class="min-h-screen bg-black text-white">
        <div class="container mx-auto mt-16 px-6 md:mt-28 md:pl-48 lg:mt-32 lg:pr-8 3xl:px-8">
            <!-- Breadcrumbs -->
            <Breadcrumbs v-if="conference" :breadcrumbs="breadcrumbs" class="mb-8" />

            <!-- Cancelled message -->
            <div
                v-if="wasCancelled"
                class="border-yellow-500/50 bg-yellow-500/10 text-yellow-200 mb-8 rounded-lg border p-4"
            >
                <p class="font-medium">Zahlung abgebrochen</p>
                <p class="text-yellow-200/80 mt-1 text-sm">
                    Die Zahlung wurde abgebrochen. Du kannst es erneut versuchen.
                </p>
            </div>

            <!-- Error state -->
            <div v-if="error" class="text-center">
                <h1 class="text-3xl font-bold">Fehler</h1>
                <p class="text-gray-400 mt-4">{{ error.message }}</p>
                <NuxtLink to="/konferenzen" class="mt-8 inline-block rounded-lg bg-lime px-6 py-3 font-bold text-black">
                    Zurück zu Konferenzen
                </NuxtLink>
            </div>

            <!-- Ticketing not available -->
            <div v-else-if="conference && !ticketingAvailable" class="text-center">
                <h1 class="text-3xl font-bold">Ticketverkauf nicht verfügbar</h1>
                <p class="text-gray-400 mt-4">Der Ticketverkauf für diese Konferenz ist derzeit nicht aktiv.</p>
                <NuxtLink
                    :to="`/konferenzen/${route.params.slug}`"
                    class="mt-8 inline-block rounded-lg bg-lime px-6 py-3 font-bold text-black"
                >
                    Zurück zur Konferenz
                </NuxtLink>
            </div>

            <!-- Checkout flow -->
            <TicketPurchaseFlow
                v-else-if="conference"
                :conference-id="conference.id"
                :conference-slug="conference.slug"
                :conference-title="conference.title"
                :ticket-settings="ticketSettings"
            />

            <!-- Loading state -->
            <div v-else class="text-center">
                <p class="text-gray-400">Laden...</p>
            </div>
        </div>
    </div>
</template>
