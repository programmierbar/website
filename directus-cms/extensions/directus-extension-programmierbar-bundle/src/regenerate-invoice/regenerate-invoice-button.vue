<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { computed, ref } from 'vue'

const props = defineProps<{ collection: string; primaryKey: string }>()

const api = useApi()

const confirmOpen = ref(false)
const busy = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

// On the "create item" page there is no order yet to regenerate an invoice for.
const isExistingItem = computed(() => props.primaryKey && props.primaryKey !== '+')

async function regenerate(): Promise<void> {
    busy.value = true
    successMessage.value = null
    errorMessage.value = null

    try {
        // useApi() sends the current Directus session, so the endpoint's
        // server-side admin check runs against the logged-in user.
        const response = await api.post(`/regenerate-invoice/${encodeURIComponent(props.primaryKey)}`)
        successMessage.value = `Invoice ${response.data.invoice_number} regenerated. Reload the page to see the new file.`
        confirmOpen.value = false
    } catch (error: any) {
        errorMessage.value = error?.response?.data?.error || 'Failed to regenerate invoice'
        confirmOpen.value = false
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <div v-if="isExistingItem">
        <v-button :disabled="busy" @click="confirmOpen = true">
            <v-icon name="receipt_long" left />
            Regenerate invoice
        </v-button>

        <v-notice v-if="successMessage" type="success" class="result-notice">
            {{ successMessage }}
        </v-notice>
        <v-notice v-if="errorMessage" type="danger" class="result-notice">
            {{ errorMessage }}
        </v-notice>

        <v-dialog v-model="confirmOpen" @esc="confirmOpen = false">
            <v-card>
                <v-card-title>Regenerate this invoice?</v-card-title>
                <v-card-text>
                    The invoice PDF is re-rendered from the order's current billing fields, keeping the existing
                    invoice number and the original invoice date. The old file stays in the file library, and no
                    emails are sent.
                </v-card-text>
                <v-card-actions>
                    <v-button secondary :disabled="busy" @click="confirmOpen = false">Cancel</v-button>
                    <v-button :loading="busy" @click="regenerate">Regenerate</v-button>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.result-notice {
    margin-top: 8px;
}
</style>
