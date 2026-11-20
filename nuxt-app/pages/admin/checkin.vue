<template>
    <div class="relative min-h-screen bg-black">
        <div class="mx-auto max-w-lg px-6 pb-20 pt-12">
            <!-- Header with stats -->
            <div class="mb-8 text-center">
                <h1 class="text-3xl font-bold text-white">Check-in</h1>
                <p v-if="conference" class="mt-2 text-lg text-white/60">{{ conference.title }}</p>
            </div>

            <!-- Stats bar -->
            <div v-if="counts" class="mb-8 flex items-center justify-center gap-8">
                <div class="text-center">
                    <div class="text-4xl font-bold text-lime">{{ counts.checkedIn }}</div>
                    <div class="text-sm text-white/60">Eingecheckt</div>
                </div>
                <div class="text-3xl text-white/20">/</div>
                <div class="text-center">
                    <div class="text-4xl font-bold text-white">{{ counts.totalSold }}</div>
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
                <NuxtLink to="/login" class="mt-4 inline-block text-lime hover:text-blue"> Zum Login </NuxtLink>
            </div>

            <div v-else-if="accessDenied" class="mt-16 text-center">
                <p class="text-xl text-pink">Keine Berechtigung.</p>
                <p class="mt-2 text-white/60">Dein Directus-Konto darf keine Tickets einchecken.</p>
            </div>

            <!-- Scanner -->
            <template v-else>
                <!-- Success animation -->
                <Transition name="checkin-success">
                    <div
                        v-if="scanResult"
                        class="mb-8 cursor-pointer rounded-2xl p-8 text-center"
                        :class="scanResult.alreadyCheckedIn ? 'bg-yellow-900/40' : 'bg-lime/10'"
                        @click="dismissResult"
                    >
                        <div
                            class="text-5xl font-bold"
                            :class="scanResult.alreadyCheckedIn ? 'text-yellow-400' : 'text-lime'"
                        >
                            {{ scanResult.firstName }}
                        </div>
                        <div class="mt-2 text-lg text-white/80">{{ scanResult.lastName }}</div>
                        <div v-if="scanResult.alreadyCheckedIn" class="text-yellow-400 mt-4">Bereits eingecheckt</div>
                        <div v-else class="mt-4 text-lime">Willkommen!</div>
                        <CheckinTshirt v-if="scanResult.tshirt" :tshirt="scanResult.tshirt" />
                        <button type="button" class="mt-6 rounded bg-white/10 px-6 py-2 font-bold text-white">
                            Fertig
                        </button>
                    </div>
                </Transition>

                <!-- Error message -->
                <div v-if="scanError" class="mb-8 rounded-2xl bg-pink/10 p-6 text-center">
                    <div class="text-xl font-bold text-pink">{{ scanError }}</div>
                </div>

                <!-- QR Scanner -->
                <div class="overflow-hidden rounded-2xl">
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
import {
    canCheckInTickets,
    CheckinError,
    checkInTicket,
    loadCheckinConference,
    loadCheckinCounts,
} from '~/helpers/ticketCheckin'
import type { CheckinConference, CheckinCounts, CheckinResult } from '~/types/directus'

useHead({
    title: 'Check-in',
    meta: [{ name: 'robots', content: 'noindex' }],
})

const directus = useDirectus()
// Same Directus session as the login check below, so a page that shows the scanner can check in.
const request = directus.getSessionRequest()

// Auth state
const authChecked = ref(false)
const isAuthenticated = ref(false)
const accessDenied = ref(false)

// Scanner state
const scanResult = ref<CheckinResult | null>(null)
const scanError = ref<string | null>(null)
const scanning = ref(false)
const manualCode = ref('')

// Stats
const conference = ref<CheckinConference | null>(null)
// Optional: if the counts can't be loaded, check-in still works.
const counts = ref<CheckinCounts | null>(null)

let scanner: any = null
let scanCooldown = false
// The card stays up until the next scan, so the code it shows stays in front of the camera
// while the shirt is handed out; that code is ignored instead of being checked in again.
let displayedTicketCode: string | null = null
// Each failed scan clears its error after a few seconds; a newer scan cancels the pending reset so
// an older timer can't wipe the newer error or its duplicate-scan guard.
let errorResetTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
    try {
        const user = await directus.getCurrentUser()
        isAuthenticated.value = !!user
    } catch {
        isAuthenticated.value = false
    }
    authChecked.value = true

    if (!isAuthenticated.value) return

    try {
        if (!(await canCheckInTickets(request))) {
            accessDenied.value = true
            return
        }
    } catch (err) {
        if (err instanceof CheckinError && err.reason === 'auth') {
            await handleAuthFailure()
            return
        }
        // Can't tell; a missing permission then shows as an error on the first scan.
    }

    try {
        conference.value = await loadCheckinConference(request)
    } catch (err) {
        if (err instanceof CheckinError && err.reason === 'auth') {
            await handleAuthFailure()
            return
        }
        // Each scan loads the conference again until this works.
        scanError.value = err instanceof CheckinError ? err.message : 'Konferenz konnte nicht geladen werden'
    }

    void refreshCounts()
    await initScanner()
})

onBeforeUnmount(() => {
    stopScanner()
    if (errorResetTimer) clearTimeout(errorResetTimer)
})

function stopScanner() {
    if (scanner) {
        scanner.stop().catch(() => {})
        scanner = null
    }
}

async function refreshCounts() {
    if (!conference.value) return
    try {
        counts.value = await loadCheckinCounts(request, conference.value.id)
    } catch {
        // Counts are optional
    }
}

// The session expired (and could not be refreshed) or the account may not check tickets in.
async function handleAuthFailure() {
    stopScanner()
    const user = await directus.getCurrentUser()
    if (user) {
        accessDenied.value = true
    } else {
        isAuthenticated.value = false
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
    if (scanning.value || scanCooldown) return

    const ticketCode = extractTicketCode(decodedText)
    if (!ticketCode || ticketCode === displayedTicketCode) return

    scanCooldown = true
    await performCheckin(ticketCode)
    setTimeout(() => {
        scanCooldown = false
    }, 1500)
}

function dismissResult() {
    scanResult.value = null
    displayedTicketCode = null
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
    if (errorResetTimer) {
        clearTimeout(errorResetTimer)
        errorResetTimer = null
    }
    dismissResult()

    try {
        conference.value ??= await loadCheckinConference(request)
        const result = await checkInTicket(request, conference.value.id, ticketCode)

        scanResult.value = result
        displayedTicketCode = ticketCode

        // Not awaited: the next scan shouldn't wait for (or fail with) the counter
        void refreshCounts()
    } catch (err: any) {
        if (err instanceof CheckinError && err.reason === 'auth') {
            await handleAuthFailure()
            return
        }
        scanError.value =
            err instanceof CheckinError
                ? err.message
                : err?.errors?.[0]?.message || err?.message || 'Unbekannter Fehler'

        displayedTicketCode = ticketCode
        errorResetTimer = setTimeout(() => {
            errorResetTimer = null
            scanError.value = null
            if (!scanResult.value) displayedTicketCode = null
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
