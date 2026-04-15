<template>
    <div class="relative min-h-screen bg-black">
        <div class="mx-auto max-w-lg px-6 pb-20 pt-12">
            <!-- Header with stats -->
            <div class="mb-8 text-center">
                <h1 class="text-3xl font-bold text-white">Check-in</h1>
                <p v-if="stats" class="mt-2 text-lg text-white/60">{{ stats.conference.title }}</p>
            </div>

            <!-- Stats bar -->
            <div v-if="stats" class="mb-8 flex items-center justify-center gap-8">
                <div class="text-center">
                    <div class="text-4xl font-bold text-lime">{{ stats.checkedIn }}</div>
                    <div class="text-sm text-white/60">Eingecheckt</div>
                </div>
                <div class="text-3xl text-white/20">/</div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-white">{{ stats.totalSold }}</div>
                    <div class="text-sm text-white/60">Tickets verkauft</div>
                </div>
            </div>

            <!-- Auth check -->
            <div v-if="!authChecked" class="mt-16 text-center">
                <p class="text-xl text-white">Zugang wird überprüft...</p>
            </div>

            <div v-else-if="!isAuthenticated" class="mt-16 text-center">
                <p class="text-xl text-pink">Nicht eingeloggt.</p>
                <p class="mt-2 text-white/60">Bitte zuerst im Directus einloggen.</p>
                <NuxtLink to="/login" class="mt-4 inline-block text-lime hover:text-blue">
                    Zum Login
                </NuxtLink>
            </div>

            <!-- Scanner -->
            <template v-else>
                <!-- Success animation -->
                <Transition name="checkin-success">
                    <div
                        v-if="scanResult"
                        class="mb-8 rounded-2xl p-8 text-center"
                        :class="scanResult.alreadyCheckedIn ? 'bg-yellow-900/40' : 'bg-lime/10'"
                    >
                        <div
                            class="text-5xl font-bold"
                            :class="scanResult.alreadyCheckedIn ? 'text-yellow-400' : 'text-lime'"
                        >
                            {{ scanResult.firstName }}
                        </div>
                        <div class="mt-2 text-lg text-white/80">{{ scanResult.lastName }}</div>
                        <div v-if="scanResult.alreadyCheckedIn" class="mt-4 text-yellow-400">
                            Bereits eingecheckt
                        </div>
                        <div v-else class="mt-4 text-lime">
                            Willkommen!
                        </div>
                    </div>
                </Transition>

                <!-- Error message -->
                <div v-if="scanError" class="mb-8 rounded-2xl bg-pink/10 p-6 text-center">
                    <div class="text-xl font-bold text-pink">{{ scanError }}</div>
                </div>

                <!-- QR Scanner -->
                <div v-show="!scanResult" class="overflow-hidden rounded-2xl">
                    <div id="qr-reader" />
                </div>

                <!-- Manual input fallback -->
                <div class="mt-6">
                    <form @submit.prevent="handleManualInput" class="flex gap-3">
                        <input
                            v-model="manualCode"
                            type="text"
                            placeholder="Ticket-Code manuell eingeben..."
                            class="form-input flex-1"
                        />
                        <button
                            type="submit"
                            class="whitespace-nowrap rounded bg-lime px-4 py-2 font-bold text-black"
                            :disabled="scanning"
                        >
                            Check-in
                        </button>
                    </form>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'

useHead({
    title: 'Check-in',
    meta: [{ name: 'robots', content: 'noindex' }],
})

const directus = useDirectus()

// Auth state
const authChecked = ref(false)
const isAuthenticated = ref(false)

// Scanner state
const scanResult = ref<{
    firstName: string
    lastName: string
    alreadyCheckedIn: boolean
} | null>(null)
const scanError = ref<string | null>(null)
const scanning = ref(false)
const manualCode = ref('')

// Stats
const stats = ref<{
    conference: { id: string; title: string; slug: string }
    totalSold: number
    checkedIn: number
} | null>(null)

let scanner: any = null
let scanCooldown = false

onMounted(async () => {
    await refreshStats()

    try {
        const user = await directus.getCurrentUser()
        isAuthenticated.value = !!user
    } catch {
        isAuthenticated.value = false
    }
    authChecked.value = true

    if (isAuthenticated.value) {
        await initScanner()
    }
})

onBeforeUnmount(() => {
    if (scanner) {
        scanner.stop().catch(() => {})
    }
})

async function refreshStats() {
    try {
        stats.value = await $fetch('/api/checkin/stats') as any
    } catch {
        // Stats not critical
    }
}

async function initScanner() {
    const { Html5Qrcode } = await import('html5-qrcode')

    scanner = new Html5Qrcode('qr-reader')

    await scanner.start(
        { facingMode: 'environment' },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {} // Ignore scan failures (no QR in frame)
    )
}

function extractTicketCode(text: string): string | null {
    // Match URL pattern: programmier.bar/ticket/TKT-XXXXX
    const urlMatch = text.match(/\/ticket\/([A-Z0-9-]+)/i)
    if (urlMatch) return urlMatch[1]

    // If it's already just a ticket code
    if (/^TKT-[A-Z0-9]+$/i.test(text)) return text

    return null
}

async function onScanSuccess(decodedText: string) {
    if (scanning.value || scanResult.value || scanCooldown) return

    const ticketCode = extractTicketCode(decodedText)
    if (!ticketCode) return

    scanCooldown = true
    await performCheckin(ticketCode)
}

async function handleManualInput() {
    if (!manualCode.value.trim()) return

    const ticketCode = extractTicketCode(manualCode.value.trim()) || manualCode.value.trim()
    await performCheckin(ticketCode)
    manualCode.value = ''
}

async function performCheckin(ticketCode: string) {
    if (scanning.value) return
    scanning.value = true
    scanError.value = null
    scanResult.value = null

    try {
        const result = await ($fetch as any)('/api/checkin/scan', {
            method: 'POST',
            body: { ticketCode },
        })

        scanResult.value = result

        // Refresh stats
        await refreshStats()

        // Auto-reset after 4 seconds
        setTimeout(() => {
            scanResult.value = null
            scanCooldown = false
        }, 4000)
    } catch (err: any) {
        const message = err?.data?.message || err?.message || 'Unbekannter Fehler'
        if (message.includes('not found')) {
            scanError.value = 'Ticket nicht gefunden'
        } else if (message.includes('cancelled')) {
            scanError.value = 'Ticket wurde storniert'
        } else {
            scanError.value = message
        }

        setTimeout(() => {
            scanError.value = null
            scanCooldown = false
        }, 4000)
    } finally {
        scanning.value = false
    }
}
</script>

<style scoped>
.checkin-success-enter-active {
    animation: checkin-pop 0.4s ease-out;
}

.checkin-success-leave-active {
    transition: opacity 0.3s ease-out;
}

.checkin-success-leave-to {
    opacity: 0;
}

@keyframes checkin-pop {
    0% {
        opacity: 0;
        transform: scale(0.8);
    }
    60% {
        transform: scale(1.05);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}

:deep(#qr-reader) {
    border: none !important;
}

:deep(#qr-reader video) {
    border-radius: 1rem;
}

:deep(#qr-reader__scan_region) {
    min-height: 300px;
}

:deep(#qr-reader__dashboard) {
    display: none !important;
}
</style>
