<template>
  <div class="agenda-root">
    <section v-for="day in days" :key="day.isoDay" class="day">
      <h2 class="day-title">{{ fmtDay(day.isoDay) }}</h2>

      <div class="grid" :style="gridStyle(day)">
        <!-- Corner -->
        <div class="corner"></div>

        <!-- Track headers -->
        <div
          v-for="(t, i) in tracks"
          :key="t"
          class="track-header"
          :style="{ gridColumn: String(i + 2), gridRow: '1' }"
        >
          {{ t }}
        </div>

        <!-- Time labels: only at session starts (rows == starts) -->
        <div
          v-for="t in day.startLines"
          :key="t"
          class="time-label"
          :style="{ gridColumn: '1', gridRow: String(2 + (day.indexMap.get(t) ?? 0)) }"
        >
          {{ fmtTime(t) }}
        </div>

        <!-- Sessions -->
        <article
          v-for="(a, idx) in day.items"
          :key="idx"
          class="talk"
          :class="{ 'talk--full': isNoTrack(a) }"
          :style="itemStyle(a, day)"
          :title="`${fmtTime(a.start)}–${fmtTime(a.end)}`"
          @click='handleTalkClick(a._object)'
          :data-cursor-hover="a._object ? true : null"
        >
          <header class="talk-title">
            {{ a._object?.title ?? a.title }}
          </header>
          <div class="talk-subtitle">{{ buildSubtitle(a) }}</div>
          <div class="talk-time">{{ fmtTime(a.start) }}<span v-if='a.end'> – {{ fmtTime(a.end) }}</span></div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TalkItem } from '~/types';
import { buildSpeakerNamesForTalk } from '~/helpers/buildSpeakerNamesForTalk';

type Agenda = {
  start: string;   // ISO string, e.g. "2025-10-29T09:15:00"
  end: string;     // ISO string
  title: string;
  subtitle: string;
  track: string;   // may be "" or whitespace for "no track"
  _object: undefined | TalkItem
};

const props = defineProps<{ agenda: Agenda[] }>();

const buildSubtitle = function(agenda: Agenda): string | undefined {
  if (!agenda._object?.speakers.length) {
    return agenda.subtitle;
  }
  return buildSpeakerNamesForTalk(agenda._object);
}

const handleTalkClick = function(talk: TalkItem | undefined | null) {
  if (!talk) return;
  const el = document.getElementById(`talk-${talk.id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center'});
}

/** ===== Config ===== */
// You already set this to false. We keep it so you can flip later if you want durations.
const USE_DURATION_HEIGHTS = false;  // equal-height rows
// New: when true, the grid compacts to one row per distinct start time (no gaps possible)
const COMPACT_BY_STARTS = true;
const TIME_COL_WIDTH = 'var(--time-col-width, 8rem)';

/** ===== Utils ===== */
const toDate = (s: string) => new Date(s);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const fmtTime = (s: string) => {
  const d = toDate(s);

  if (d.toString() === 'Invalid Date') {
    return '';
  }

  return d.toLocaleTimeString(['DE'], { hour: '2-digit', minute: '2-digit' });
}

const fmtDay = (isoDay: string) =>
  new Date(isoDay).toLocaleDateString(['DE'], {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

function uniqSorted<T>(arr: T[], key?: (x: T) => any): T[] {
  const set = new Map<any, T>();
  for (const x of arr) set.set(key ? key(x) : (x as any), x);
  const out = [...set.values()];
  out.sort((a, b) => {
    const ka = key ? key(a) : (a as any);
    const kb = key ? key(b) : (b as any);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return out;
}

/** ===== Columns (tracks) ===== */
const tracks = computed(() =>
  uniqSorted(
    props.agenda
      .map(a => (a.track ?? '').trim())
      .filter(t => t.length > 0)
  )
);

function isNoTrack(a: Agenda) {
  return !a.track || a.track.trim().length === 0;
}
function colForTrack(track: string) {
  const idx = tracks.value.findIndex(t => t === track.trim());
  return String(idx + 2); // +1 for the time-column, +1 because the grid is 1-based
}

/** ===== Day model ===== */
type DayBlock = {
  isoDay: string;
  items: Agenda[];

  // When COMPACT_BY_STARTS=true, these are the ONLY boundaries we use for rows.
  startLines: string[];           // sorted unique session starts of the day
  indexMap: Map<string, number>;  // start time -> row index (0-based within content)

  // Back-compat if you flip COMPACT_BY_STARTS off later:
  lines: string[];                // full boundaries (starts + ends)
  rowHeightsMin: number[];        // per-interval minutes (unused when equal-height)
};

const days = computed<DayBlock[]>(() => {
  // Group items by day
  const byDay = new Map<string, Agenda[]>();
  for (const a of props.agenda) {
    const k = dayKey(toDate(a.start));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }

  const result: DayBlock[] = [];

  for (const [isoDay, items] of [...byDay.entries()].sort()) {
    if (!items.length) continue;

    // === Compact rows: one row per distinct start time
    const startLines = uniqSorted(items.map(i => i.start), t => t);
    const indexMap = new Map<string, number>();
    startLines.forEach((t, i) => indexMap.set(t, i));

    // === Keep full boundaries in case you later use duration-based mode
    const lines = uniqSorted(items.flatMap(i => [i.start, i.end]), t => t);
    const rowHeightsMin: number[] = [];
    for (let i = 0; i < lines.length - 1; i++) {
      // minutes between boundaries (unused when equal-height)
      rowHeightsMin.push(
        Math.max(1, Math.round((toDate(lines[i+1]).getTime() - toDate(lines[i]).getTime()) / 60000))
      );
    }

    result.push({ isoDay, items, startLines, indexMap, lines, rowHeightsMin });
  }

  return result;
});

/** ===== Grid helpers ===== */
function gridStyle(day: DayBlock) {
  const cols = [`${TIME_COL_WIDTH}`, ...tracks.value.map(() => '1fr')].join(' ');

  if (COMPACT_BY_STARTS) {
    // Rows: 1 header + one row per distinct start time
    return {
      display: 'grid',
      gridTemplateColumns: cols,
      gridTemplateRows: `auto repeat(${day.startLines.length}, 1fr)`,
      gap: '6px'
    } as const;
  }

  // Fallback: duration-based layout (kept for completeness)
  if (USE_DURATION_HEIGHTS) {
    // proportional heights
    const MINUTES_PER_UNIT = 2;
    const unit = `${MINUTES_PER_UNIT}px`;
    const content = day.rowHeightsMin.map(min => `calc(${min} * ${unit})`).join(' ');
    return {
      display: 'grid',
      gridTemplateColumns: cols,
      gridTemplateRows: `auto ${content}`,
      gap: '6px'
    } as const;
  } else {
    // equal-height intervals across full boundaries
    return {
      display: 'grid',
      gridTemplateColumns: cols,
      gridTemplateRows: `auto repeat(${Math.max(0, day.lines.length - 1)}, 1fr)`,
      gap: '6px'
    } as const;
  }
}

function itemStyle(a: Agenda, day: DayBlock) {
  if (COMPACT_BY_STARTS) {
    // Place the item in the row corresponding to its START time (one row high)
    const rowIdx = day.indexMap.get(a.start) ?? 0;
    const rs = 2 + rowIdx;       // +1 for header, +1 because 0-based index
    const re = rs + 1;           // exactly one row tall
    if (isNoTrack(a)) {
      const endExclusive = tracks.value.length + 2;
      return { gridColumn: `2 / ${endExclusive}`, gridRow: `${rs} / ${re}` } as const;
    }
    return { gridColumn: `${colForTrack(a.track!)}/span 1`, gridRow: `${rs} / ${re}` } as const;
  }

  // Fallback (duration-based placement)
  const startIdx = day.lines.indexOf(a.start);
  const endIdx = day.lines.indexOf(a.end);
  const rs = 2 + (startIdx >= 0 ? startIdx : 0);
  const re = 2 + (endIdx   >= 0 ? endIdx   : rs);
  if (isNoTrack(a)) {
    const endExclusive = tracks.value.length + 2;
    return { gridColumn: `2 / ${endExclusive}`, gridRow: `${rs} / ${re}` } as const;
  }
  return { gridColumn: `${colForTrack(a.track!)}/span 1`, gridRow: `${rs} / ${re}` } as const;
}
</script>

<style scoped>
.agenda-root {
  display: grid;
  gap: 2rem;
}

:root, .agenda-root {
  --time-col-width: 8rem;
}

@media (max-width: 600px) {
  .agenda-root {
    --time-col-width: 3.5rem;
  }
}

.day-title {
  margin: 0 0 .5rem 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.corner {
  grid-column: 1;
  grid-row: 1;
}

.track-header {
  position: sticky; top: 0; z-index: 2;
  font-weight: 700; padding: .25rem .5rem;
  border-bottom: 1px solid #eee; text-align: center;
}

.time-label {
  position: sticky;
  left: 0;
  z-index: 1;
  font-variant-numeric: tabular-nums;
  padding: .25rem .5rem;
  align-self: start;
}

.talk {
  background: rgba(255,255,255,.1);
  border-radius: .25rem;
  padding: .5rem .6rem;
  display: flex; flex-direction: column; gap: .25rem;
  box-shadow: 0 1px 0 rgba(0,0,0,.04);
  position: relative;
}

.talk--full {
  text-align: center;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.talk-title {
  font-weight: 700;
  line-height: 1.2;
}
.talk-subtitle {
  color: #6b7280;
  font-size: .9rem;
}
.talk-time {
  color: #9ca3af;
  font-size: .8rem;
  text-align: right;

  position: absolute;
  padding: 0 .5rem .6rem;

  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
}

.grid > * {
  min-width: 0;
}
</style>
