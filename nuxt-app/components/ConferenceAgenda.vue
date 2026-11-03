<template>
    <div class="agenda-root">
        <!-- Desktop: one grid per day, one column per track -->
        <div class="hidden gap-16 md:grid">
            <section v-for="day in days" :key="day.isoDay">
                <h2 class="mb-2 text-lg font-bold">{{ fmtDay(day.isoDay) }}</h2>

                <div class="agenda-grid grid gap-x-2" :style="gridStyle(day)">
                    <!-- Track headers stay visible while scrolling through the day -->
                    <div
                        class="sticky top-0 z-10 bg-black pb-3 pt-2"
                        :style="{ gridColumn: `2 / ${tracks.length + 2}`, gridRow: '1' }"
                    >
                        <div class="grid gap-x-2" :style="{ gridTemplateColumns: `repeat(${tracks.length}, 1fr)` }">
                            <div
                                v-for="t in tracks"
                                :key="t"
                                class="border-b-1 border-b-white px-2 py-1 text-center font-bold"
                            >
                                {{ t }}
                            </div>
                        </div>
                    </div>

                    <template v-for="(row, rowIdx) in day.rows" :key="rowIdx">
                        <!-- Pause between two slots -->
                        <div
                            v-if="row.kind === 'pause'"
                            class="agenda-pause flex items-center gap-3 px-1 text-xs text-shade-400"
                            :style="{ gridColumn: `2 / ${tracks.length + 2}`, gridRow: String(rowIdx + 2) }"
                        >
                            Pause · {{ fmtDuration(row.minutes) }}
                        </div>

                        <template v-else>
                            <div
                                class="self-start pr-2 pt-3 text-lg font-bold tabular-nums text-lime"
                                :style="{ gridColumn: '1', gridRow: String(rowIdx + 2) }"
                            >
                                {{ fmtTime(row.start) }}
                            </div>
                            <ConferenceAgendaCard
                                v-for="(a, idx) in row.items"
                                :key="idx"
                                class="my-2"
                                :style="itemPlacement(a, rowIdx)"
                                v-bind="cardProps(a)"
                                @select="handleTalkClick(a._object)"
                            />
                        </template>
                    </template>
                </div>
            </section>
        </div>

        <!-- Mobile: one list per day, filterable by track -->
        <div class="md:hidden">
            <div v-if="tracks.length > 1" class="mb-6 flex rounded-md bg-gray-800 p-1" role="group" aria-label="Bühne">
                <button
                    v-for="option in ['', ...tracks]"
                    :key="option"
                    type="button"
                    class="flex-1 rounded-md py-2 text-sm"
                    :class="trackFilter === option ? 'bg-gray-600 font-bold text-white' : 'text-shade-300'"
                    :aria-pressed="trackFilter === option"
                    @click="trackFilter = option"
                >
                    {{ option || 'Alle' }}
                </button>
            </div>

            <!-- Each day is its own container, so its sticky date scrolls out when the next day arrives.
                 top-18 keeps it below the fixed logo and menu button. -->
            <section v-for="day in days" :key="day.isoDay" class="mb-10">
                <h2 class="sticky top-18 z-10 mb-4 border-b-1 border-shade-800 bg-black pb-2 pt-3 font-bold">
                    {{ fmtDay(day.isoDay) }}
                </h2>
                <div class="grid gap-5">
                    <template v-for="(row, rowIdx) in day.rows" :key="rowIdx">
                        <div v-if="row.kind === 'slot' && visibleItems(row.items).length" class="grid gap-2">
                            <div class="font-bold tabular-nums text-lime">{{ fmtTime(row.start) }}</div>
                            <ConferenceAgendaCard
                                v-for="(a, idx) in visibleItems(row.items)"
                                :key="idx"
                                v-bind="cardProps(a)"
                                :track="tracks.length > 1 && !isNoTrack(a) ? a.track.trim() : undefined"
                                @select="handleTalkClick(a._object)"
                            />
                        </div>
                    </template>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { parseCmsDate } from '~/helpers'
import { buildSpeakerNamesForTalk } from '~/helpers/buildSpeakerNamesForTalk'
import type { TalkItem } from '~/types'
import { computed, ref } from 'vue'

type Agenda = {
    start: string // ISO string, e.g. "2025-10-29T09:15:00"
    end: string // ISO string
    title: string
    subtitle: string
    track: string // may be "" or whitespace for "no track"
    _object: undefined | TalkItem
}

const props = defineProps<{ agenda: Agenda[] }>()

const trackFilter = ref('')

const buildSubtitle = function (agenda: Agenda): string | undefined {
    if (!agenda._object?.speakers.length) {
        return agenda.subtitle
    }
    return buildSpeakerNamesForTalk(agenda._object)
}

const handleTalkClick = function (talk: TalkItem | undefined | null) {
    if (!talk) return
    const el = document.getElementById(`talk-${talk.id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** ===== Utils ===== */
const toDate = (s: string) => parseCmsDate(s)
const toMinutes = (s: string) => toDate(s).getTime() / 60000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const fmtTime = (s: string) => {
    const d = toDate(s)

    if (isNaN(d.getTime())) {
        return ''
    }

    return d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
}

const fmtDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} Min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} Std ${m} Min` : `${h} Std`
}

const durationOf = (a: Agenda): string | undefined => {
    const minutes = Math.round(toMinutes(a.end) - toMinutes(a.start))
    return Number.isFinite(minutes) && minutes > 0 ? fmtDuration(minutes) : undefined
}

const fmtDay = (isoDay: string) =>
    parseCmsDate(isoDay).toLocaleDateString('de-DE', {
        timeZone: 'Europe/Berlin',
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })

/** ===== Columns (tracks) ===== */
const tracks = computed(() =>
    [...new Set(props.agenda.map((a) => (a.track ?? '').trim()).filter((t) => t.length > 0))].sort()
)

function isNoTrack(a: Agenda) {
    return !a.track || a.track.trim().length === 0
}

function visibleItems(items: Agenda[]) {
    return items.filter((a) => !trackFilter.value || isNoTrack(a) || a.track.trim() === trackFilter.value)
}

function cardProps(a: Agenda) {
    return {
        title: a._object?.title ?? a.title,
        subtitle: buildSubtitle(a),
        start: fmtTime(a.start),
        end: fmtTime(a.end),
        duration: durationOf(a),
        isService: isNoTrack(a) && !a._object,
        clickable: Boolean(a._object),
    }
}

/** ===== Day model ===== */
type Row = { kind: 'slot'; start: string; items: Agenda[] } | { kind: 'pause'; minutes: number }

type DayBlock = {
    isoDay: string
    // One row per distinct start time, with a pause row wherever nothing runs between two slots
    rows: Row[]
}

const days = computed<DayBlock[]>(() => {
    const byDay = new Map<string, Agenda[]>()
    for (const a of props.agenda) {
        const k = dayKey(toDate(a.start))
        if (!byDay.has(k)) byDay.set(k, [])
        byDay.get(k)!.push(a)
    }

    const result: DayBlock[] = []

    for (const [isoDay, items] of [...byDay.entries()].sort()) {
        if (!items.length) continue

        const byStart = new Map<string, Agenda[]>()
        for (const a of [...items].sort((x, y) => toMinutes(x.start) - toMinutes(y.start))) {
            if (!byStart.has(a.start)) byStart.set(a.start, [])
            byStart.get(a.start)!.push(a)
        }

        const rows: Row[] = []
        let latestEnd: number | undefined
        for (const [start, slotItems] of byStart) {
            const gap = latestEnd === undefined ? 0 : Math.round(toMinutes(start) - latestEnd)
            if (gap > 0) rows.push({ kind: 'pause', minutes: gap })
            rows.push({ kind: 'slot', start, items: slotItems })

            const ends = slotItems.map((a) => toMinutes(a.end)).filter((m) => Number.isFinite(m))
            latestEnd = Math.max(latestEnd ?? -Infinity, toMinutes(start), ...ends)
        }

        result.push({ isoDay, rows })
    }

    return result
})

/** ===== Grid helpers ===== */
function gridStyle(day: DayBlock) {
    return {
        gridTemplateColumns: ['var(--time-col-width)', ...tracks.value.map(() => 'minmax(0, 1fr)')].join(' '),
        gridTemplateRows: `auto repeat(${day.rows.length}, auto)`,
    } as const
}

function itemPlacement(a: Agenda, rowIdx: number) {
    const row = String(rowIdx + 2) // +1 for the header row, +1 because the grid is 1-based
    if (isNoTrack(a)) {
        return { gridColumn: `2 / ${tracks.value.length + 2}`, gridRow: row } as const
    }
    const col = tracks.value.findIndex((t) => t === a.track.trim()) + 2
    return { gridColumn: `${col} / span 1`, gridRow: row } as const
}
</script>

<style scoped>
.agenda-root {
    --time-col-width: 6rem;
}

.agenda-grid > * {
    min-width: 0;
}

.agenda-pause::before,
.agenda-pause::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgb(255 255 255 / 0.08);
}
</style>
