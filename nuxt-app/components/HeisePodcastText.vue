<template>
    <section>
        <div class="flex flex-wrap items-center justify-between gap-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-lime md:text-base">{{ label }}</h2>
            <HeiseCopyButton v-if="hasContent" :label="label" rich :content="renderedContent" />
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
import { getPlainText } from '~/helpers/sanitize'
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
    label: string
    html: string | null
}>()

// Markup with no text in it, such as `<p>&nbsp;</p>`, counts as missing
const hasContent = computed(() => getPlainText(props.html) !== '')

const content = useTemplateRef<{ $el: HTMLElement }>('content')

// Copies what the page shows: the sanitised markup, and the rendered text with its paragraph breaks
function renderedContent() {
    const element = content.value?.$el
    return element ? { html: element.innerHTML, text: element.innerText } : null
}
</script>
