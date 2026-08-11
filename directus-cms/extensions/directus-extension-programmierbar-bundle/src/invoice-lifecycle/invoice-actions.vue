<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{ collection: string; primaryKey: string }>()

const api = useApi()

type ActionKey = 'regenerate' | 'correction' | 'cancellation'

interface InvoiceDocumentRow {
    id: string
    type: 'original' | 'correction' | 'cancellation'
    invoice_number: string
    sent_at: string | null
    related_invoice: string | null
}

const loading = ref(true)
const loadFailed = ref(false)
const busy = ref(false)
const confirmAction = ref<ActionKey | null>(null)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const orderInvoiceNumber = ref<string | null>(null)
const documents = ref<InvoiceDocumentRow[]>([])

// On the "create item" page there is no order yet.
const isExistingItem = computed(() => props.primaryKey && props.primaryKey !== '+')

const currentDocument = computed<InvoiceDocumentRow | null>(() => {
    for (let i = documents.value.length - 1; i >= 0; i--) {
        const doc = documents.value[i]
        if (doc && (doc.type === 'original' || doc.type === 'correction')) {
            return doc
        }
    }
    return null
})

const isCancelled = computed(() => {
    const current = currentDocument.value
    if (!current) return false
    return documents.value.some((doc) => doc.type === 'cancellation' && doc.related_invoice === current.id)
})

// Orders that got their invoice before the ticket_invoices collection existed have
// no document rows yet; all pre-existing invoices were emailed, so they count as issued.
const isIssued = computed(() => {
    const current = currentDocument.value
    if (current) return current.sent_at !== null
    return orderInvoiceNumber.value !== null
})

const hasInvoice = computed(() => orderInvoiceNumber.value !== null || currentDocument.value !== null)

const showRegenerate = computed(() => hasInvoice.value && !isIssued.value && !isCancelled.value)
const showPostIssuanceActions = computed(() => hasInvoice.value && isIssued.value && !isCancelled.value)

const ACTION_TEXT: Record<ActionKey, { button: string; title: string; body: string; confirm: string }> = {
    regenerate: {
        button: 'Rechnung neu generieren',
        title: 'Rechnung neu generieren?',
        body:
            'Das Rechnungs-PDF wird aus den aktuellen Rechnungsdaten der Bestellung neu erzeugt. ' +
            'Rechnungsnummer und Rechnungsdatum bleiben unverändert. Möglich ist das nur, solange die ' +
            'Rechnung noch nicht versendet wurde. Es wird keine E-Mail verschickt.',
        confirm: 'Neu generieren',
    },
    correction: {
        button: 'Rechnungsberichtigung erstellen',
        title: 'Rechnungsberichtigung erstellen?',
        body:
            'Es wird ein neues Dokument mit eigener Rechnungsnummer und heutigem Datum aus den aktuellen ' +
            'Rechnungsdaten erstellt, das ausdrücklich auf die ursprüngliche Rechnung verweist. Die ' +
            'ursprüngliche Rechnung bleibt unverändert erhalten. Es wird keine E-Mail verschickt — die ' +
            'Berichtigung muss manuell an den Kunden gesendet werden.',
        confirm: 'Berichtigung erstellen',
    },
    cancellation: {
        button: 'Stornorechnung erstellen',
        title: 'Stornorechnung erstellen?',
        body:
            'Es wird eine Stornorechnung mit eigener Rechnungsnummer und negativen Beträgen erstellt, die ' +
            'die aktuelle Rechnung ausdrücklich referenziert. Die ursprüngliche Rechnung bleibt erhalten. ' +
            'Stripe, Tickets und der Bestellstatus werden nicht verändert, und es wird keine E-Mail verschickt.',
        confirm: 'Stornorechnung erstellen',
    },
}

async function loadState(): Promise<void> {
    loading.value = true
    loadFailed.value = false
    try {
        const [orderResponse, documentsResponse] = await Promise.all([
            api.get(`/items/ticket_orders/${encodeURIComponent(props.primaryKey)}`, {
                params: { fields: ['id', 'invoice_number', 'is_internal'] },
            }),
            api.get('/items/ticket_invoices', {
                params: {
                    filter: { order: { _eq: props.primaryKey } },
                    fields: ['id', 'type', 'invoice_number', 'sent_at', 'related_invoice'],
                    sort: ['date_created'],
                    limit: -1,
                },
            }),
        ])
        orderInvoiceNumber.value = orderResponse.data.data?.invoice_number ?? null
        documents.value = documentsResponse.data.data ?? []
        if (orderResponse.data.data?.is_internal === true) {
            // Internal orders have no invoice; hide all actions.
            orderInvoiceNumber.value = null
            documents.value = []
        }
    } catch {
        loadFailed.value = true
    } finally {
        loading.value = false
    }
}

async function runAction(action: ActionKey): Promise<void> {
    busy.value = true
    successMessage.value = null
    errorMessage.value = null

    try {
        // useApi() sends the current Directus session, so the endpoint's
        // server-side admin check runs against the logged-in user.
        const response = await api.post(`/invoice-lifecycle/${encodeURIComponent(props.primaryKey)}/${action}`)
        const nr = response.data.invoice_number
        successMessage.value =
            action === 'regenerate'
                ? `Rechnung ${nr} wurde neu generiert. Seite neu laden, um die neue Datei zu sehen.`
                : action === 'correction'
                  ? `Rechnungsberichtigung ${nr} wurde erstellt (berichtigt ${response.data.corrects}). Sie wurde NICHT automatisch versendet.`
                  : `Stornorechnung ${nr} wurde erstellt (storniert ${response.data.cancels}). Sie wurde NICHT automatisch versendet.`
        confirmAction.value = null
        await loadState()
    } catch (error: any) {
        errorMessage.value = error?.response?.data?.error || 'Aktion fehlgeschlagen'
        confirmAction.value = null
    } finally {
        busy.value = false
    }
}

onMounted(() => {
    if (isExistingItem.value) {
        void loadState()
    } else {
        loading.value = false
    }
})
</script>

<template>
    <div v-if="isExistingItem">
        <v-notice v-if="loadFailed" type="warning">
            Rechnungsstatus konnte nicht geladen werden — Aktionen sind nicht verfügbar.
        </v-notice>

        <template v-else-if="!loading">
            <div v-if="showRegenerate || showPostIssuanceActions" class="actions">
                <v-button v-if="showRegenerate" :disabled="busy" @click="confirmAction = 'regenerate'">
                    <v-icon name="refresh" left />
                    {{ ACTION_TEXT.regenerate.button }}
                </v-button>

                <template v-if="showPostIssuanceActions">
                    <v-button :disabled="busy" @click="confirmAction = 'correction'">
                        <v-icon name="edit_document" left />
                        {{ ACTION_TEXT.correction.button }}
                    </v-button>
                    <v-button :disabled="busy" secondary @click="confirmAction = 'cancellation'">
                        <v-icon name="cancel" left />
                        {{ ACTION_TEXT.cancellation.button }}
                    </v-button>
                </template>
            </div>

            <v-notice v-else-if="isCancelled" type="info">
                Die Rechnung dieser Bestellung wurde storniert — es sind keine weiteren Aktionen möglich.
            </v-notice>
        </template>

        <v-notice v-if="successMessage" type="success" class="result-notice">
            {{ successMessage }}
        </v-notice>
        <v-notice v-if="errorMessage" type="danger" class="result-notice">
            {{ errorMessage }}
        </v-notice>

        <v-dialog :model-value="confirmAction !== null" @esc="confirmAction = null">
            <v-card v-if="confirmAction">
                <v-card-title>{{ ACTION_TEXT[confirmAction].title }}</v-card-title>
                <v-card-text>{{ ACTION_TEXT[confirmAction].body }}</v-card-text>
                <v-card-actions>
                    <v-button secondary :disabled="busy" @click="confirmAction = null">Abbrechen</v-button>
                    <v-button :loading="busy" @click="runAction(confirmAction)">
                        {{ ACTION_TEXT[confirmAction].confirm }}
                    </v-button>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.result-notice {
    margin-top: 8px;
}
</style>
