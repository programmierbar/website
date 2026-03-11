<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'

const route = useRoute()
const directus = useDirectus()
const store = useTicketCheckoutStore()

// Polling state
const orderReady = ref(false)
const ticketCount = ref(0)
const profileUrl = ref<string | null>(null)
const pollingDone = ref(false)
let pollInterval: ReturnType<typeof setInterval> | null = null

// Clear the checkout store on success (client-side only)
onMounted(() => {
    store.resetBySlug(route.params.slug as string)

    // Start polling for ticket creation
    const sessionId = route.query.session_id as string
    const orderId = route.query.order_id as string
    if (sessionId || orderId) {
        startPolling(sessionId, orderId)
    } else {
        pollingDone.value = true
    }
})

onBeforeUnmount(() => {
    if (pollInterval) {
        clearInterval(pollInterval)
    }
})

async function checkOrderStatus(sessionId?: string, orderId?: string) {
    try {
        const params = sessionId
            ? `session_id=${encodeURIComponent(sessionId)}`
            : `order_id=${encodeURIComponent(orderId!)}`
        const response = await fetch(`/api/tickets/order-status?${params}`)
        if (!response.ok) return

        const data = await response.json()
        if (data.ready) {
            orderReady.value = true
            ticketCount.value = data.ticketCount
            profileUrl.value = data.profileUrl || null
            pollingDone.value = true

            if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
            }
        }
    } catch {
        // Silently retry on next interval
    }
}

function startPolling(sessionId?: string, orderId?: string) {
    // Immediately check once
    checkOrderStatus(sessionId, orderId)

    let attempts = 0
    const maxAttempts = 15 // 30 seconds at 2s intervals

    pollInterval = setInterval(() => {
        attempts++
        if (attempts >= maxAttempts) {
            pollingDone.value = true
            if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
            }
            return
        }
        checkOrderStatus(sessionId, orderId)
    }, 2000)
}

const isSingleTicket = computed(() => ticketCount.value === 1)

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
                        <svg
                            class="h-12 w-12 text-lime"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>

                <h1 class="text-4xl font-bold md:text-5xl">Vielen Dank!</h1>

                <p class="mt-6 text-xl text-gray-300">
                    Deine Bestellung war erfolgreich.
                </p>

                <!-- Loading state while polling -->
                <div v-if="!pollingDone" class="mt-8 rounded-lg bg-gray-800/50 p-6">
                    <p class="text-gray-300">Deine Tickets werden vorbereitet...</p>
                </div>

                <!-- Single ticket: show button to complete ticket -->
                <div v-else-if="orderReady && isSingleTicket && profileUrl" class="mt-8 rounded-lg bg-gray-800/50 p-6 text-left">
                    <h2 class="mb-4 text-lg font-bold text-lime">Nächster Schritt</h2>
                    <p class="text-gray-300">
                        Bitte vervollständige deine Angaben, damit wir dir dein Ticket mit QR-Code zusenden können.
                    </p>
                    <div class="mt-6 text-center">
                        <NuxtLink
                            :to="profileUrl"
                            class="inline-block rounded-lg bg-lime px-8 py-4 font-bold text-black transition hover:bg-lime/90"
                        >
                            Ticket vervollständigen
                        </NuxtLink>
                    </div>
                </div>

                <!-- Multi ticket: show info about emails -->
                <div v-else-if="orderReady && !isSingleTicket" class="mt-8 rounded-lg bg-gray-800/50 p-6 text-left">
                    <h2 class="mb-4 text-lg font-bold text-lime">Was passiert jetzt?</h2>
                    <ul class="space-y-3 text-gray-300">
                        <li class="flex items-start gap-3">
                            <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime">1</span>
                            <span>Du erhältst in Kürze eine Bestätigungs-E-Mail.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime">2</span>
                            <span>Alle Teilnehmer erhalten eine E-Mail mit einem Link zur Vervollständigung ihrer Angaben.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime">3</span>
                            <span>Sobald die Angaben vervollständigt sind, wird das Ticket mit QR-Code per E-Mail versendet.</span>
                        </li>
                    </ul>
                </div>

                <!-- Fallback: polling timed out or no session_id -->
                <div v-else class="mt-8 rounded-lg bg-gray-800/50 p-6 text-left">
                    <h2 class="mb-4 text-lg font-bold text-lime">Was passiert jetzt?</h2>
                    <ul class="space-y-3 text-gray-300">
                        <li class="flex items-start gap-3">
                            <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime">1</span>
                            <span>Alle Teilnehmer erhalten eine E-Mail mit einem Link zur Vervollständigung ihrer Angaben.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/20 text-xs text-lime">2</span>
                            <span>Sobald die Angaben vervollständigt sind, wird das Ticket mit QR-Code per E-Mail versendet.</span>
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
