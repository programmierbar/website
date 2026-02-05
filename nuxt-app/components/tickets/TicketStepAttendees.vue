<script setup lang="ts">
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import { computed, onMounted, watch } from 'vue'
import TicketPricingSummary from './TicketPricingSummary.vue'

const emit = defineEmits(['validityChange'])
const store = useTicketCheckoutStore()

// Validate email format
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

// Check if all attendees have valid info
const isFormValid = computed(() => {
    return store.attendees.every(
        (attendee) =>
            attendee.firstName.trim() !== '' && attendee.lastName.trim() !== '' && isValidEmail(attendee.email)
    )
})

watch(isFormValid, (valid) => {
    emit('validityChange', valid)
})

onMounted(() => {
    emit('validityChange', isFormValid.value)
})

function updateAttendee(index: number, field: 'firstName' | 'lastName' | 'email', value: string) {
    store.updateAttendee(index, { [field]: value })
}

function copyPurchaserInfo(index: number) {
    store.updateAttendee(index, {
        firstName: store.purchaser.firstName,
        lastName: store.purchaser.lastName,
        email: store.purchaser.email,
    })
}
</script>

<template>
    <div class="ticket-step-attendees">
        <h2 class="mb-2 text-3xl font-bold text-white md:text-4xl">Teilnehmerdaten</h2>
        <p class="text-gray-300 mb-8 text-lg">
            Bitte gib die Daten für {{ store.ticketCount === 1 ? 'den Teilnehmer' : 'alle Teilnehmer' }} ein.
        </p>

        <!-- Attendee forms -->
        <div class="space-y-8">
            <div
                v-for="(attendee, index) in store.attendees"
                :key="index"
                class="rounded-lg border border-gray-700 bg-gray-800/50 p-6"
            >
                <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white">
                        Ticket {{ index + 1 }}
                        <span v-if="store.ticketCount > 1" class="text-gray-400"> / {{ store.ticketCount }} </span>
                    </h3>
                    <button
                        v-if="store.purchaser.firstName && index > 0"
                        type="button"
                        class="text-sm text-lime hover:underline"
                        @click="copyPurchaserInfo(index)"
                    >
                        Käuferdaten übernehmen
                    </button>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="text-gray-400 mb-2 block text-sm font-bold">
                            Vorname <span class="text-lime">*</span>
                        </label>
                        <input
                            :value="attendee.firstName"
                            type="text"
                            placeholder="Max"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updateAttendee(index, 'firstName', ($event.target as HTMLInputElement).value)"
                        />
                    </div>

                    <div>
                        <label class="text-gray-400 mb-2 block text-sm font-bold">
                            Nachname <span class="text-lime">*</span>
                        </label>
                        <input
                            :value="attendee.lastName"
                            type="text"
                            placeholder="Mustermann"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updateAttendee(index, 'lastName', ($event.target as HTMLInputElement).value)"
                        />
                    </div>

                    <div class="md:col-span-2">
                        <label class="text-gray-400 mb-2 block text-sm font-bold">
                            E-Mail <span class="text-lime">*</span>
                        </label>
                        <input
                            :value="attendee.email"
                            type="email"
                            placeholder="max@beispiel.de"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updateAttendee(index, 'email', ($event.target as HTMLInputElement).value)"
                        />
                        <p class="mt-1 text-xs text-[#848a98]">Das Ticket wird an diese E-Mail-Adresse gesendet.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pricing summary -->
        <div class="mt-8">
            <TicketPricingSummary />
        </div>
    </div>
</template>
