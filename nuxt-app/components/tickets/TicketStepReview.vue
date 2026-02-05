<script setup lang="ts">
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import { computed, onMounted, ref, watch } from 'vue'
import TicketPricingSummary from './TicketPricingSummary.vue'

const emit = defineEmits(['validityChange'])
const store = useTicketCheckoutStore()

const termsAccepted = ref(false)
const paymentError = ref('')

const isFormValid = computed(() => termsAccepted.value)

watch(isFormValid, (valid) => {
    emit('validityChange', valid)
})

onMounted(() => {
    emit('validityChange', isFormValid.value)
})

async function proceedToPayment() {
    if (!termsAccepted.value) {
        paymentError.value = 'Bitte akzeptiere die AGB und Datenschutzbestimmungen.'
        return
    }

    paymentError.value = ''

    try {
        const checkoutUrl = await store.createCheckout()
        if (checkoutUrl) {
            // Redirect to Stripe Checkout
            window.location.href = checkoutUrl
        }
    } catch (e: any) {
        paymentError.value = store.error || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
    }
}
</script>

<template>
    <div class="ticket-step-review">
        <h2 class="mb-2 text-3xl font-bold text-white md:text-4xl">Bestellung prüfen</h2>
        <p class="text-gray-300 mb-8 text-lg">Bitte überprüfe deine Angaben vor der Zahlung.</p>

        <!-- Attendees summary -->
        <div class="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
            <h3 class="mb-4 text-lg font-bold text-white">Teilnehmer ({{ store.ticketCount }})</h3>
            <div class="space-y-3">
                <div
                    v-for="(attendee, index) in store.attendees"
                    :key="index"
                    class="flex items-center justify-between border-b border-gray-700 pb-3 last:border-0 last:pb-0"
                >
                    <div>
                        <p class="font-medium text-white">{{ attendee.firstName }} {{ attendee.lastName }}</p>
                        <p class="text-gray-400 text-sm">{{ attendee.email }}</p>
                    </div>
                    <span class="text-sm text-[#848a98]">Ticket {{ index + 1 }}</span>
                </div>
            </div>
        </div>

        <!-- Billing summary -->
        <div class="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
            <h3 class="mb-4 text-lg font-bold text-white">Rechnungsadresse</h3>

            <div class="text-gray-300 space-y-2">
                <p class="font-medium text-white">{{ store.purchaser.firstName }} {{ store.purchaser.lastName }}</p>
                <p>{{ store.purchaser.email }}</p>

                <!-- Company address -->
                <div
                    v-if="store.purchaseType === 'company' && store.company"
                    class="mt-4 border-t border-gray-700 pt-4"
                >
                    <p class="font-medium text-white">{{ store.company.name }}</p>
                    <p>{{ store.company.address.line1 }}</p>
                    <p v-if="store.company.address.line2">{{ store.company.address.line2 }}</p>
                    <p>{{ store.company.address.postalCode }} {{ store.company.address.city }}</p>
                    <p>{{ store.company.address.country }}</p>
                    <p v-if="store.company.billingEmail" class="mt-2 text-sm">
                        Rechnungs-E-Mail: {{ store.company.billingEmail }}
                    </p>
                </div>

                <!-- Personal address (optional) -->
                <div
                    v-if="store.purchaseType === 'personal' && store.showPersonalAddress && store.personalAddress"
                    class="mt-4 border-t border-gray-700 pt-4"
                >
                    <p v-if="store.personalAddress.line1">{{ store.personalAddress.line1 }}</p>
                    <p v-if="store.personalAddress.line2">{{ store.personalAddress.line2 }}</p>
                    <p v-if="store.personalAddress.postalCode || store.personalAddress.city">
                        {{ store.personalAddress.postalCode }} {{ store.personalAddress.city }}
                    </p>
                    <p v-if="store.personalAddress.country">{{ store.personalAddress.country }}</p>
                </div>
            </div>
        </div>

        <!-- Pricing summary -->
        <div class="mb-8">
            <TicketPricingSummary :show-vat="true" />
        </div>

        <!-- Terms checkbox -->
        <div class="mb-6">
            <label class="flex cursor-pointer items-start gap-3">
                <input
                    v-model="termsAccepted"
                    type="checkbox"
                    class="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-800 text-lime focus:ring-lime focus:ring-offset-0"
                />
                <span class="text-gray-300 text-sm">
                    Ich akzeptiere die
                    <a href="/agb" target="_blank" class="text-lime hover:underline">AGB</a>
                    und
                    <a href="/datenschutz" target="_blank" class="text-lime hover:underline">Datenschutzbestimmungen</a
                    >.
                    <span class="text-lime">*</span>
                </span>
            </label>
        </div>

        <!-- Error message -->
        <p v-if="paymentError" class="bg-red-500/10 text-red-400 mb-4 rounded-lg p-4">
            {{ paymentError }}
        </p>

        <!-- Pay button -->
        <button
            type="button"
            class="w-full rounded-lg bg-lime py-4 text-lg font-bold text-black transition hover:bg-lime/90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!termsAccepted || store.isLoading"
            @click="proceedToPayment"
        >
            <span v-if="store.isLoading">Wird verarbeitet...</span>
            <span v-else>Jetzt bezahlen - {{ store.formatPrice(store.totalWithVatCents) }}</span>
        </button>

        <p class="mt-4 text-center text-sm text-[#848a98]">
            Du wirst zur sicheren Zahlungsseite von Stripe weitergeleitet.
        </p>
    </div>
</template>
