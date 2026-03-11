<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { VAT_RATE_PERCENT } from '~/config'
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import TicketPricingSummary from './TicketPricingSummary.vue'

defineProps<{
    conferenceTitle: string
}>()

const emit = defineEmits(['validityChange'])
const store = useTicketCheckoutStore()

// Format the early bird deadline from settings
const formattedEarlyBirdDeadline = computed(() => {
    if (!store.pricingSettings?.earlyBirdDeadline) {
        return ''
    }
    const date = new Date(store.pricingSettings.earlyBirdDeadline)
    return date.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    })
})

// This step is valid when pricing is loaded and at least 1 ticket is selected
const isFormValid = computed(() => store.ticketCount >= 1 && store.pricingLoaded && !store.hasPricingError)

watch(isFormValid, (valid) => {
    emit('validityChange', valid)
})

onMounted(() => {
    emit('validityChange', isFormValid.value)
})

function decrementTickets() {
    if (store.ticketCount > 1) {
        store.setTicketCount(store.ticketCount - 1)
    }
}

function incrementTickets() {
    if (store.ticketCount < 10) {
        store.setTicketCount(store.ticketCount + 1)
    }
}

</script>

<template>
    <div class="ticket-step-quantity">
        <h2 class="mb-2 text-3xl font-bold text-white md:text-4xl">Tickets kaufen</h2>
        <p class="mb-8 text-lg text-gray-300">{{ conferenceTitle }}</p>

        <!-- Ticket count selector -->
        <div class="mb-8">
            <label class="mb-3 block text-sm font-bold uppercase tracking-wider text-gray-400">
                Anzahl Tickets
            </label>
            <div class="flex items-center gap-4">
                <button
                    type="button"
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-2xl font-bold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="store.ticketCount <= 1"
                    @click="decrementTickets"
                >
                    -
                </button>

                <span class="w-12 text-center text-3xl font-bold text-white">
                    {{ store.ticketCount }}
                </span>

                <button
                    type="button"
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-2xl font-bold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="store.ticketCount >= 10"
                    @click="incrementTickets"
                >
                    +
                </button>
            </div>
            <p class="mt-2 text-sm text-[#848a98]">Max. 10 Tickets pro Bestellung</p>
        </div>

        <!-- Error state when pricing failed to load -->
        <div v-if="store.hasPricingError" class="mb-8 rounded-lg bg-red-500/10 border border-red-500/50 p-4">
            <p class="text-red-400 font-medium">{{ store.error }}</p>
        </div>

        <!-- Pricing info -->
        <div v-else class="mb-8 rounded-lg bg-gray-800/50 p-4">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-white">
                        <span v-if="store.isEarlyBird" class="font-bold text-lime">Early Bird Preis</span>
                        <span v-else>Regulärer Preis</span>
                    </p>
                    <p v-if="store.isEarlyBird && formattedEarlyBirdDeadline" class="text-sm text-gray-400">
                        Gültig bis {{ formattedEarlyBirdDeadline }}
                    </p>
                </div>
                <p class="text-2xl font-bold text-white">
                    {{ store.formatPrice(store.unitPriceCents) }}
                </p>
            </div>
            <p class="mt-2 text-xs text-[#848a98]">zzgl. {{ VAT_RATE_PERCENT }}% MwSt.</p>
        </div>

        <!-- Pricing summary -->
        <TicketPricingSummary />
    </div>
</template>
