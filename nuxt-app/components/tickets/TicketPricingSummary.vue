<script setup lang="ts">
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'

defineProps<{
    /**
     * Whether to show VAT breakdown and gross total.
     * false (default): Show net prices with "zzgl. MwSt." note
     * true: Show net prices, VAT line, and gross total
     */
    showVat?: boolean
}>()

const store = useTicketCheckoutStore()
</script>

<template>
    <div class="pricing-summary rounded-lg bg-gray-900 p-6">
        <h3 class="mb-4 text-lg font-bold text-white">Zusammenfassung</h3>

        <div class="space-y-2 text-sm">
            <div class="flex justify-between text-gray-300">
                <span>{{ store.ticketCount }}x Ticket</span>
                <span>{{ store.formatPrice(store.unitPriceCents) }}</span>
            </div>

            <div v-if="store.isEarlyBird" class="flex items-center gap-2 text-lime">
                <span class="rounded bg-lime/20 px-2 py-0.5 text-xs font-bold">Early Bird</span>
            </div>

            <div v-if="store.discountValid && !store.isEarlyBird" class="flex justify-between text-lime">
                <span>Rabatt ({{ store.discountCode }})</span>
                <span>-{{ store.formatPrice(store.discountAmountCents) }}</span>
            </div>

            <!-- Net-only view (Steps 1-2) -->
            <template v-if="!showVat">
                <hr class="my-3 border-gray-700" />

                <div class="flex justify-between text-lg font-bold text-white">
                    <span>Zwischensumme</span>
                    <span>{{ store.formatPrice(store.totalCents) }}</span>
                </div>

                <p class="mt-2 text-xs text-[#848a98]">Alle Preise netto zzgl. 19% MwSt.</p>
            </template>

            <!-- VAT breakdown view (Steps 3-4) -->
            <template v-else>
                <hr class="my-3 border-gray-700" />

                <div class="flex justify-between text-gray-300">
                    <span>Zwischensumme (netto)</span>
                    <span>{{ store.formatPrice(store.totalCents) }}</span>
                </div>

                <div class="flex justify-between text-gray-300">
                    <span>zzgl. 19% MwSt.</span>
                    <span>{{ store.formatPrice(store.vatAmountCents) }}</span>
                </div>

                <hr class="my-3 border-gray-700" />

                <div class="flex justify-between text-lg font-bold text-white">
                    <span>Gesamtbetrag</span>
                    <span>{{ store.formatPrice(store.totalWithVatCents) }}</span>
                </div>

                <p class="mt-2 text-xs text-[#848a98]">Bruttopreis inkl. 19% MwSt.</p>
            </template>
        </div>
    </div>
</template>
