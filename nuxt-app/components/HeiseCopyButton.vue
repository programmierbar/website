<template>
    <button
        v-if="rich ? clipboard.isRichTextSupported : clipboard.isSupported"
        class="rounded-full border-3 border-lime px-4 py-1 text-xs font-black uppercase tracking-widest text-lime transition-colors hover:bg-lime hover:text-black md:text-sm"
        type="button"
        data-cursor-hover
        @click="copy"
    >
        {{ clipboard.copied ? 'Kopiert!' : clipboard.failed ? 'Kopieren fehlgeschlagen' : `${label} kopieren` }}
    </button>
</template>

<script setup lang="ts">
import { useClipboard } from '~/composables'

// `content` is read on click, so it can take what is on the page at that moment
const props = defineProps<{
    label: string
    rich?: boolean
    content: () => { html?: string; text: string } | null
}>()

const clipboard = useClipboard()

function copy() {
    const content = props.content()
    if (!content) {
        return
    }
    if (props.rich && content.html !== undefined) {
        clipboard.copyRichText(content.html, content.text)
    } else {
        clipboard.copy(content.text)
    }
}
</script>
