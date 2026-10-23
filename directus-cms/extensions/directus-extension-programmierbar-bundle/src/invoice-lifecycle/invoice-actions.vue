<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { computed, ref, watch } from 'vue'
import {
    deriveInvoiceActionsState,
    describeActionResult,
    isExistingItemKey,
    type InvoiceActionKey,
    type InvoiceDocumentRow,
} from './invoice-actions-state.js'

const props = defineProps<{ collection: string; primaryKey: string }>()

const api = useApi()

type ActionKey = InvoiceActionKey

const loading = ref(true)
const loadFailed = ref(false)
const busy = ref(false)
const confirmAction = ref<ActionKey | null>(null)
const resultMessage = ref<{ type: 'success' | 'warning'; text: string } | null>(null)
const errorMessage = ref<string | null>(null)

const orderInvoiceNumber = ref<string | null>(null)
const documents = ref<InvoiceDocumentRow[]>([])

// False on the "create item" page — and while Directus is still loading the
// item record, during which it passes '+' instead of the real primary key.
const isExistingItem = computed(() => isExistingItemKey(props.primaryKey))

const state = computed(() => deriveInvoiceActionsState(orderInvoiceNumber.value, documents.value))

const isCancelled = computed(() => state.value.isCancelled)
const showRegenerate = computed(() => state.value.showRegenerate)
const showPostIssuanceActions = computed(() => state.value.showPostIssuanceActions)

const ACTION_TEXT: Record<ActionKey, { button: string; title: string; body: string; confirm: string }> = {
    regenerate: {
        button: 'Rechnung neu generieren',
        title: 'Rechnung neu generieren?',
        body:
            'Das Rechnungs-PDF wird aus den aktuellen Rechnungsdaten der Bestellung neu erzeugt. ' +
            'Rechnungsnummer und Rechnungsdatum bleiben unverändert. Möglich ist das nur, solange die ' +
            'Rechnung noch nicht versendet wurde. An den Kunden wird keine E-Mail verschickt — bitte ' +
            'manuell senden und danach sent_at setzen; die Buchhaltung erhält die neue Fassung als Ersatz ' +
            'der vorherigen.',
        confirm: 'Neu generieren',
    },
    correction: {
        button: 'Rechnungsberichtigung erstellen',
        title: 'Rechnungsberichtigung erstellen?',
        body:
            'Es wird ein neues Dokument mit eigener Rechnungsnummer und heutigem Datum aus den aktuellen ' +
            'Rechnungsdaten erstellt, das ausdrücklich auf die ursprüngliche Rechnung verweist. Die ' +
            'ursprüngliche Rechnung bleibt unverändert erhalten. Die Berichtigung geht automatisch per ' +
            'E-Mail an Kunde (Käufer, CC Rechnungs-E-Mail) und Buchhaltung.',
        confirm: 'Berichtigung erstellen',
    },
    cancellation: {
        button: 'Stornorechnung erstellen',
        title: 'Stornorechnung erstellen?',
        body:
            'Es wird eine Stornorechnung mit eigener Rechnungsnummer und negativen Beträgen erstellt, die ' +
            'die aktuelle Rechnung ausdrücklich referenziert. Die ursprüngliche Rechnung bleibt erhalten. ' +
            'Stripe, Tickets und der Bestellstatus werden nicht verändert. Die Stornorechnung geht ' +
            'automatisch per E-Mail an Kunde (Käufer, CC Rechnungs-E-Mail) und Buchhaltung.',
        confirm: 'Stornorechnung erstellen',
    },
}

let loadStateRunId = 0

async function loadState(): Promise<void> {
    const runId = ++loadStateRunId
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
        if (runId !== loadStateRunId) return // a newer load superseded this one
        orderInvoiceNumber.value = orderResponse.data.data?.invoice_number ?? null
        documents.value = documentsResponse.data.data ?? []
        if (orderResponse.data.data?.is_internal === true) {
            // Internal orders have no invoice; hide all actions.
            orderInvoiceNumber.value = null
            documents.value = []
        }
    } catch {
        if (runId !== loadStateRunId) return
        loadFailed.value = true
    } finally {
        if (runId === loadStateRunId) loading.value = false
    }
}

async function runAction(action: ActionKey): Promise<void> {
    busy.value = true
    resultMessage.value = null
    errorMessage.value = null

    try {
        // useApi() sends the current Directus session, so the endpoint's
        // server-side admin check runs against the logged-in user.
        const response = await api.post(`/invoice-lifecycle/${encodeURIComponent(props.primaryKey)}/${action}`)
        resultMessage.value = describeActionResult(action, response.data)
        confirmAction.value = null
        await loadState()
    } catch (error: any) {
        errorMessage.value = error?.response?.data?.error || 'Aktion fehlgeschlagen'
        confirmAction.value = null
    } finally {
        busy.value = false
    }
}

// The item detail page mounts interfaces with primary key '+' while the item
// record is still loading and swaps in the real key afterwards, so a one-shot
// onMounted fetch would run too early and never see the key (the actions then
// stayed invisible). Reacting to the key covers mount AND the later swap.
watch(
    () => props.primaryKey,
    (primaryKey) => {
        if (isExistingItemKey(primaryKey)) {
            void loadState()
        } else {
            loading.value = false
        }
    },
    { immediate: true }
)
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

            <v-notice v-else type="info">
                Für diese Bestellung gibt es keine Rechnung (z.&nbsp;B. interne oder noch nicht bezahlte Bestellung) —
                es sind keine Rechnungs-Aktionen verfügbar.
            </v-notice>
        </template>

        <v-notice v-if="resultMessage" :type="resultMessage.type" class="result-notice">
            {{ resultMessage.text }}
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
