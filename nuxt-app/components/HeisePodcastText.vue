<template>
    <section>
        <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-lime md:text-base">{{ label }}</h2>
            <button
                v-if="hasContent && clipboard.isRichTextSupported"
                class="rounded-full border-3 border-lime px-4 py-1 text-xs font-black uppercase tracking-widest text-lime transition-colors hover:bg-lime hover:text-black md:text-sm"
                type="button"
                data-cursor-hover
                @click="copy"
            >
                {{ clipboard.copied ? 'Kopiert!' : clipboard.failed ? 'Kopieren fehlgeschlagen' : `${label} kopieren` }}
            </button>
        </div>
        <InnerHtml
            v-if="hasContent"
            ref="content"
            class="mt-4 space-y-6 text-base font-light leading-normal text-white md:mt-6 md:text-xl lg:text-2xl"
            :html="html ?? ''"
        />
        <HeiseMissingValue v-else class="mt-4 md:mt-6">{{ label }} ist noch nicht hinterlegt.</HeiseMissingValue>
    </section>
</template>

<script setup lang="ts">
import { useClipboard } from '~/composables'
import { getPlainText } from '~/helpers/sanitize'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
    label: string
    html: string | null
}>()

// Markup with no text in it, such as `<p>&nbsp;</p>`, counts as missing
const hasContent = computed(() => getPlainText(props.html) !== '')

const clipboard = useClipboard()
const content = useTemplateRef<{ $el: HTMLElement }>('content')

// Copies what the page shows: the sanitised markup, and the rendered text with its paragraph breaks
function copy() {
    const element = content.value?.$el
    if (element) {
        clipboard.copyRichText(element.innerHTML, element.innerText)
    }
}
</script>
