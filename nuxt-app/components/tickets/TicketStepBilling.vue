<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import TicketPricingSummary from './TicketPricingSummary.vue'

const emit = defineEmits(['validityChange'])
const store = useTicketCheckoutStore()

// Validate email format
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

// Check if form is valid
const isFormValid = computed(() => {
    // Purchaser info is always required
    const purchaserValid =
        store.purchaser.firstName.trim() !== '' &&
        store.purchaser.lastName.trim() !== '' &&
        isValidEmail(store.purchaser.email)

    if (!purchaserValid) return false

    // If company purchase, validate company info
    if (store.purchaseType === 'company' && store.company) {
        const companyValid =
            store.company.name.trim() !== '' &&
            store.company.address.line1.trim() !== '' &&
            store.company.address.city.trim() !== '' &&
            store.company.address.postalCode.trim() !== '' &&
            store.company.address.country.trim() !== ''

        // If billing email is provided, it must be valid
        if (store.company.billingEmail && !isValidEmail(store.company.billingEmail)) {
            return false
        }

        return companyValid
    }

    return true
})

watch(isFormValid, (valid) => {
    emit('validityChange', valid)
})

onMounted(() => {
    // Auto-populate purchaser with first attendee's data if purchaser is empty
    const firstAttendee = store.attendees[0]
    const purchaserEmpty =
        store.purchaser.firstName.trim() === '' &&
        store.purchaser.lastName.trim() === '' &&
        store.purchaser.email.trim() === ''

    if (purchaserEmpty && firstAttendee) {
        store.copyFirstAttendeeToPurchaser()
    }

    emit('validityChange', isFormValid.value)
})

function updatePurchaser(field: 'firstName' | 'lastName' | 'email', value: string) {
    store.updatePurchaser({ [field]: value })
}

function updateCompanyField(field: string, value: string) {
    if (!store.company) return

    if (field.startsWith('address.')) {
        const addressField = field.replace('address.', '') as keyof typeof store.company.address
        store.updateCompany({
            address: {
                ...store.company.address,
                [addressField]: value,
            },
        })
    } else {
        store.updateCompany({ [field]: value })
    }
}

function updatePersonalAddressField(field: keyof NonNullable<typeof store.personalAddress>, value: string) {
    if (!store.personalAddress) return
    store.updatePersonalAddress({ [field]: value })
}

</script>

<template>
    <div class="ticket-step-billing">
        <h2 class="mb-2 text-3xl font-bold text-white md:text-4xl">Rechnungsdaten</h2>
        <p class="mb-8 text-lg text-gray-300">Wer bezahlt die Tickets?</p>

        <!-- Purchase type toggle -->
        <div class="mb-8">
            <div class="flex gap-4">
                <button
                    type="button"
                    class="flex-1 rounded-lg border-2 px-6 py-4 text-center font-bold transition"
                    :class="
                        store.purchaseType === 'personal'
                            ? 'border-lime bg-lime/10 text-lime'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    "
                    @click="store.setPurchaseType('personal')"
                >
                    Privat
                </button>
                <button
                    type="button"
                    class="flex-1 rounded-lg border-2 px-6 py-4 text-center font-bold transition"
                    :class="
                        store.purchaseType === 'company'
                            ? 'border-lime bg-lime/10 text-lime'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    "
                    @click="store.setPurchaseType('company')"
                >
                    Firma
                </button>
            </div>
        </div>

        <!-- Purchaser info -->
        <div class="mb-8 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
            <h3 class="mb-4 text-lg font-bold text-white">Käufer</h3>

            <div class="grid gap-4 md:grid-cols-2">
                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Vorname <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.purchaser.firstName"
                        type="text"
                        placeholder="Max"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updatePurchaser('firstName', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Nachname <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.purchaser.lastName"
                        type="text"
                        placeholder="Mustermann"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updatePurchaser('lastName', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div class="md:col-span-2">
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        E-Mail <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.purchaser.email"
                        type="email"
                        placeholder="max@beispiel.de"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updatePurchaser('email', ($event.target as HTMLInputElement).value)"
                    />
                    <p class="mt-1 text-xs text-[#848a98]">
                        Bestellbestätigung wird an diese Adresse gesendet.
                    </p>
                </div>
            </div>
        </div>

        <!-- Optional billing address for personal purchases -->
        <div v-if="store.purchaseType === 'personal'" class="mb-8">
            <button
                type="button"
                class="flex items-center gap-2 text-gray-400 hover:text-white transition"
                @click="store.setShowPersonalAddress(!store.showPersonalAddress)"
            >
                <span
                    class="flex h-5 w-5 items-center justify-center rounded border transition"
                    :class="
                        store.showPersonalAddress
                            ? 'border-lime bg-lime text-black'
                            : 'border-gray-600'
                    "
                >
                    <svg
                        v-if="store.showPersonalAddress"
                        class="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                </span>
                <span>Rechnungsadresse hinzufügen (optional)</span>
            </button>

            <!-- Personal address form -->
            <div
                v-if="store.showPersonalAddress && store.personalAddress"
                class="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-6"
            >
                <h3 class="mb-4 text-lg font-bold text-white">Rechnungsadresse</h3>

                <div class="grid gap-4">
                    <div>
                        <label class="mb-2 block text-sm font-bold text-gray-400">
                            Straße und Hausnummer
                        </label>
                        <input
                            :value="store.personalAddress.line1 || ''"
                            type="text"
                            placeholder="Musterstraße 123"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updatePersonalAddressField('line1', ($event.target as HTMLInputElement).value)"
                        />
                    </div>

                    <div>
                        <label class="mb-2 block text-sm font-bold text-gray-400">
                            Adresszusatz
                        </label>
                        <input
                            :value="store.personalAddress.line2 || ''"
                            type="text"
                            placeholder="z.B. Apartment 4, 2. Stock"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updatePersonalAddressField('line2', ($event.target as HTMLInputElement).value)"
                        />
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="mb-2 block text-sm font-bold text-gray-400">
                                PLZ
                            </label>
                            <input
                                :value="store.personalAddress.postalCode || ''"
                                type="text"
                                placeholder="12345"
                                class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                                @input="updatePersonalAddressField('postalCode', ($event.target as HTMLInputElement).value)"
                            />
                        </div>

                        <div>
                            <label class="mb-2 block text-sm font-bold text-gray-400">
                                Stadt
                            </label>
                            <input
                                :value="store.personalAddress.city || ''"
                                type="text"
                                placeholder="Berlin"
                                class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                                @input="updatePersonalAddressField('city', ($event.target as HTMLInputElement).value)"
                            />
                        </div>
                    </div>

                    <div>
                        <label class="mb-2 block text-sm font-bold text-gray-400">
                            Land
                        </label>
                        <input
                            :value="store.personalAddress.country || ''"
                            type="text"
                            placeholder="Deutschland"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updatePersonalAddressField('country', ($event.target as HTMLInputElement).value)"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Company billing info (conditional) -->
        <div v-if="store.purchaseType === 'company' && store.company" class="mb-8 rounded-lg border border-gray-700 bg-gray-800/50 p-6">
            <h3 class="mb-4 text-lg font-bold text-white">Firmenadresse</h3>

            <div class="grid gap-4">
                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Firmenname <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.company.name"
                        type="text"
                        placeholder="Beispiel GmbH"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updateCompanyField('name', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Straße und Hausnummer <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.company.address.line1"
                        type="text"
                        placeholder="Musterstraße 123"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updateCompanyField('address.line1', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Adresszusatz
                    </label>
                    <input
                        :value="store.company.address.line2 || ''"
                        type="text"
                        placeholder="z.B. Gebäude B, 3. Stock"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updateCompanyField('address.line2', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label class="mb-2 block text-sm font-bold text-gray-400">
                            PLZ <span class="text-lime">*</span>
                        </label>
                        <input
                            :value="store.company.address.postalCode"
                            type="text"
                            placeholder="12345"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updateCompanyField('address.postalCode', ($event.target as HTMLInputElement).value)"
                        />
                    </div>

                    <div>
                        <label class="mb-2 block text-sm font-bold text-gray-400">
                            Stadt <span class="text-lime">*</span>
                        </label>
                        <input
                            :value="store.company.address.city"
                            type="text"
                            placeholder="Berlin"
                            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                            @input="updateCompanyField('address.city', ($event.target as HTMLInputElement).value)"
                        />
                    </div>
                </div>

                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Land <span class="text-lime">*</span>
                    </label>
                    <input
                        :value="store.company.address.country"
                        type="text"
                        placeholder="Deutschland"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updateCompanyField('address.country', ($event.target as HTMLInputElement).value)"
                    />
                </div>

                <div>
                    <label class="mb-2 block text-sm font-bold text-gray-400">
                        Rechnungs-E-Mail (optional)
                    </label>
                    <input
                        :value="store.company.billingEmail || ''"
                        type="email"
                        placeholder="buchhaltung@beispiel.de"
                        class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-lime focus:outline-none"
                        @input="updateCompanyField('billingEmail', ($event.target as HTMLInputElement).value)"
                    />
                    <p class="mt-1 text-xs text-[#848a98]">
                        Falls abweichend von der Käufer-E-Mail
                    </p>
                </div>
            </div>
        </div>

        <!-- Pricing summary -->
        <TicketPricingSummary :show-vat="true" />
    </div>
</template>
