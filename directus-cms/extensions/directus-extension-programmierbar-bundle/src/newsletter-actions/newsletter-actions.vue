<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { computed, ref, watch } from 'vue'
import { isExistingItemKey } from '../shared/itemKey.js'
import { confirmText, describeTestSendResult, type TestSendResultView } from './test-send-state.js'

const props = defineProps<{ collection: string; primaryKey: string }>()

const api = useApi()

const busy = ref(false)
const confirmOpen = ref(false)
const recipient = ref<string | null>(null)
const result = ref<TestSendResultView | null>(null)
const errorMessage = ref<string | null>(null)

// False on the "create item" page — and while Directus is still loading the item
// record, during which it passes '+' instead of the real primary key.
const isExistingItem = computed(() => isExistingItemKey(props.primaryKey))

let loadRunId = 0

/** Show the recipient in the confirm dialog. The server reads it again itself. */
async function loadRecipient(): Promise<void> {
    const runId = ++loadRunId
    try {
        const response = await api.get('/users/me', { params: { fields: ['email'] } })
        if (runId === loadRunId) recipient.value = response.data.data?.email ?? null
    } catch {
        if (runId === loadRunId) recipient.value = null
    }
}

async function runTestSend(): Promise<void> {
    busy.value = true
    result.value = null
    errorMessage.value = null

    try {
        // useApi() sends the current Directus session, so the endpoint knows the
        // logged-in user and mails only them.
        const response = await api.post(`/newsletter-send/${encodeURIComponent(props.primaryKey)}/test`)
        result.value = describeTestSendResult(response.data)
    } catch (error: any) {
        errorMessage.value = error?.response?.data?.error || 'Testversand fehlgeschlagen'
    } finally {
        busy.value = false
        confirmOpen.value = false
    }
}

// The item page mounts interfaces with primary key '+' while the record is still
// loading and swaps in the real key afterwards (see invoice-actions).
watch(
    () => props.primaryKey,
    (primaryKey) => {
        if (isExistingItemKey(primaryKey)) {
            void loadRecipient()
        }
    },
    { immediate: true }
)
</script>

<template>
    <div>
        <v-notice v-if="!isExistingItem" type="info">
            Testversand ist erst möglich, wenn die Ausgabe gespeichert ist.
        </v-notice>

        <template v-else>
            <v-button :disabled="busy" @click="confirmOpen = true">
                <v-icon name="forward_to_inbox" left />
                Testversand an mich
            </v-button>

            <v-notice v-if="result" type="success" class="result-notice">
                {{ result.message }}
            </v-notice>
            <v-notice v-if="result && result.notes.length > 0" type="warning" class="result-notice">
                <ul class="notes">
                    <li v-for="note in result.notes" :key="note">{{ note }}</li>
                </ul>
            </v-notice>
            <v-notice v-if="errorMessage" type="danger" class="result-notice">
                {{ errorMessage }}
            </v-notice>

            <v-dialog :model-value="confirmOpen" @esc="confirmOpen = false">
                <v-card>
                    <v-card-title>Testversand an mich?</v-card-title>
                    <v-card-text>{{ confirmText(recipient) }}</v-card-text>
                    <v-card-actions>
                        <v-button secondary :disabled="busy" @click="confirmOpen = false">Abbrechen</v-button>
                        <v-button :loading="busy" @click="runTestSend()">Testversand senden</v-button>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </template>
    </div>
</template>

<style scoped>
.result-notice {
    margin-top: 8px;
}

.notes {
    margin: 0;
    padding-left: 20px;
}
</style>
