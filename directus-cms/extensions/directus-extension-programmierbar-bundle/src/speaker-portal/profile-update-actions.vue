<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { computed, ref, watch } from 'vue'
import { SPEAKER_PROFILE_UPDATE_VERSION_KEY } from '../../../../../shared-code/index.js'
import { isExistingItemKey } from '../shared/itemKey.js'
import { findRequestBlockers, formatDateDe, type GuardedVersion } from './util/requestGuards.js'

const props = defineProps<{ collection: string; primaryKey: string }>()

const api = useApi()

const loading = ref(true)
const loadFailed = ref(false)
const busy = ref(false)
const dialogOpen = ref(false)
/** Why this request needs an explicit "send anyway"; set before opening or by a 409 from the endpoint. */
const warning = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const email = ref<string | null>(null)
const requestedAt = ref<string | null>(null)
const status = ref<string | null>(null)
const tokenExpires = ref<string | null>(null)
const hasToken = ref(false)
/** The speaker's `profile-update` Content Versions; a new request deletes them. */
const versions = ref<GuardedVersion[]>([])

// False on the "create item" page — and while Directus is still loading the
// item record, during which it passes '+' instead of the real primary key.
const isExistingItem = computed(() => isExistingItemKey(props.primaryKey))

const hasEmail = computed(() => Boolean(email.value?.trim()))
const lastRequestLabel = computed(() => (requestedAt.value ? formatDateDe(new Date(requestedAt.value)) : null))

let loadStateRunId = 0

async function loadState(): Promise<void> {
    const runId = ++loadStateRunId
    loading.value = true
    loadFailed.value = false
    try {
        const [response, versionsResponse] = await Promise.all([
            api.get(`/items/speakers/${encodeURIComponent(props.primaryKey)}`, {
                params: {
                    fields: [
                        'email',
                        'portal_update_requested_at',
                        'portal_submission_status',
                        'portal_token',
                        'portal_token_expires',
                    ],
                },
            }),
            api.get('/versions', {
                params: {
                    filter: JSON.stringify({
                        collection: { _eq: 'speakers' },
                        item: { _eq: String(props.primaryKey) },
                        key: { _eq: SPEAKER_PROFILE_UPDATE_VERSION_KEY },
                    }),
                    fields: ['name', 'delta'],
                    limit: -1,
                },
            }),
        ])
        if (runId !== loadStateRunId) return // a newer load superseded this one
        const speaker = response.data.data ?? {}
        email.value = speaker.email ?? null
        requestedAt.value = speaker.portal_update_requested_at ?? null
        status.value = speaker.portal_submission_status ?? null
        tokenExpires.value = speaker.portal_token_expires ?? null
        hasToken.value = Boolean(speaker.portal_token)
        versions.value = versionsResponse.data.data ?? []
    } catch {
        if (runId !== loadStateRunId) return
        loadFailed.value = true
    } finally {
        if (runId === loadStateRunId) loading.value = false
    }
}

function openDialog(): void {
    successMessage.value = null
    errorMessage.value = null
    // Same rules as the endpoint, so "send anyway" is offered before the first click.
    const blockers = findRequestBlockers(
        {
            portal_update_requested_at: requestedAt.value,
            portal_submission_status: status.value,
            portal_token: hasToken.value ? 'set' : null,
            portal_token_expires: tokenExpires.value,
        },
        new Date(),
        versions.value
    )
    warning.value = blockers.length > 0 ? blockers.map((blocker) => blocker.message).join(' ') : null
    dialogOpen.value = true
}

function closeDialog(): void {
    dialogOpen.value = false
    warning.value = null
}

async function sendRequest(force: boolean): Promise<void> {
    busy.value = true
    successMessage.value = null
    errorMessage.value = null

    try {
        // useApi() sends the current Directus session, so the endpoint's
        // server-side admin check runs against the logged-in user.
        await api.post(
            `/speaker-portal/${encodeURIComponent(props.primaryKey)}/request-update`,
            force ? { force: true } : {}
        )
        successMessage.value =
            'Die Anfrage wurde versendet. Änderungen der Speaker:in landen in der Content Version „Profil-Update“ und werden erst nach deiner Prüfung übernommen.'
        closeDialog()
        await loadState()
    } catch (error: any) {
        const data = error?.response?.data
        if (error?.response?.status === 409 && data?.code) {
            // Cooldown, open invitation or unreviewed version: keep the dialog open and offer "send anyway".
            warning.value = data.error
            return
        }
        errorMessage.value = data?.error || 'Die Anfrage ist fehlgeschlagen.'
        closeDialog()
        await loadState()
    } finally {
        busy.value = false
    }
}

// The item detail page mounts interfaces with primary key '+' while the item
// record is still loading and swaps in the real key afterwards, so react to the
// key instead of fetching once on mount (see invoice-actions).
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
            Status der Profil-Update-Anfrage konnte nicht geladen werden — die Aktion ist nicht verfügbar.
        </v-notice>

        <template v-else-if="!loading">
            <div class="actions">
                <v-button v-if="hasEmail" :disabled="busy" @click="openDialog">
                    <v-icon name="forward_to_inbox" left />
                    Profil-Update anfragen
                </v-button>
                <!-- A disabled button gets no mouse events, so the tooltip sits on a wrapper. -->
                <span v-else v-tooltip="'Keine E-Mail-Adresse hinterlegt — bitte zuerst eine eintragen und speichern.'">
                    <v-button disabled>
                        <v-icon name="forward_to_inbox" left />
                        Profil-Update anfragen
                    </v-button>
                </span>
                <span class="meta">
                    <template v-if="lastRequestLabel">Zuletzt angefragt am {{ lastRequestLabel }}</template>
                    <template v-else>Noch nie angefragt</template>
                    <template v-if="status === 'update_requested'"> · Antwort ausstehend</template>
                </span>
            </div>
        </template>

        <v-notice v-if="successMessage" type="success" class="result-notice">
            {{ successMessage }}
        </v-notice>
        <v-notice v-if="errorMessage" type="danger" class="result-notice">
            {{ errorMessage }}
        </v-notice>

        <v-dialog :model-value="dialogOpen" @esc="closeDialog">
            <v-card>
                <v-card-title>Profil-Update anfragen?</v-card-title>
                <v-card-text>
                    <p>
                        {{ email }} bekommt eine E-Mail mit einer Übersicht des aktuellen Profils, dem Link zum
                        öffentlichen Profil und einem neuen, zeitlich begrenzten Link ins Speaker Portal. Ein noch
                        offener Portal-Link wird dadurch ungültig.
                    </p>
                    <p class="dialog-paragraph">
                        Was die Speaker:in dort ändert, wird NICHT direkt übernommen, sondern als Content Version
                        „Profil-Update“ gespeichert, die du prüfen und übernehmen kannst. Eine frühere Version
                        „Profil-Update“ wird dabei gelöscht.
                    </p>
                    <v-notice v-if="warning" type="warning" class="dialog-paragraph">
                        {{ warning }} Trotzdem senden?
                    </v-notice>
                </v-card-text>
                <v-card-actions>
                    <v-button secondary :disabled="busy" @click="closeDialog">Abbrechen</v-button>
                    <v-button :loading="busy" :kind="warning ? 'warning' : undefined" @click="sendRequest(!!warning)">
                        {{ warning ? 'Trotzdem senden' : 'Anfrage senden' }}
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
    align-items: center;
    gap: 12px;
}

.meta {
    color: var(--theme--foreground-subdued);
}

.result-notice {
    margin-top: 8px;
}

.dialog-paragraph {
    margin-top: 12px;
}
</style>
