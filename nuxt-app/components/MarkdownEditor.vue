<template>
    <div>
        <!-- CodeMirror mounts here once it has loaded; until then (and during SSR, or if loading fails)
             the plain textarea below does the job, so the field is never missing. -->
        <div
            v-show="ready"
            ref="container"
            class="markdown-editor rounded border-2 bg-gray-600 text-base text-white transition-colors focus-within:border-lime"
            :class="invalid ? 'border-pink' : 'border-gray-600'"
        />
        <textarea
            v-if="!ready"
            :id="id"
            ref="fallback"
            :value="modelValue"
            class="w-full rounded border-2 bg-gray-600 px-4 py-3 text-base text-white transition-colors focus:border-lime focus:outline-none"
            :class="invalid ? 'border-pink' : 'border-gray-600'"
            :rows="rows"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :required="required"
            :aria-labelledby="labelledby"
            :aria-describedby="describedby"
            @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
    </div>
</template>

<script setup lang="ts">
import type { EditorView } from '@codemirror/view'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
    defineProps<{
        modelValue: string
        /** Given to the fallback textarea, so a `<label for>` works before the editor has loaded. */
        id?: string
        labelledby?: string
        describedby?: string
        placeholder?: string
        maxlength?: number
        rows?: number
        required?: boolean
        invalid?: boolean
    }>(),
    {
        id: undefined,
        labelledby: undefined,
        describedby: undefined,
        placeholder: undefined,
        maxlength: undefined,
        rows: 5,
        required: false,
        invalid: false,
    }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const container = ref<HTMLDivElement | null>(null)
const fallback = ref<HTMLTextAreaElement | null>(null)
const ready = ref(false)
let view: EditorView | null = null
let unmounted = false

onMounted(async () => {
    try {
        // Dynamic, so CodeMirror is its own chunk and only loads where this component is used.
        const { createMarkdownEditor } = await import('~/helpers/markdownEditor')

        if (unmounted || !container.value) {
            return
        }

        // CodeMirror turns spellchecking off by default, which suits code but not a bio.
        const attributes: Record<string, string> = {
            spellcheck: 'true',
            autocorrect: 'on',
            autocapitalize: 'sentences',
        }
        if (props.labelledby) attributes['aria-labelledby'] = props.labelledby
        if (props.describedby) attributes['aria-describedby'] = props.describedby
        if (props.required) attributes['aria-required'] = 'true'

        // Someone already typing in the textarea keeps their focus and cursor in the editor.
        const textarea = fallback.value
        const hadFocus = !!textarea && document.activeElement === textarea
        const backward = textarea?.selectionDirection === 'backward'
        const selection =
            textarea && hadFocus
                ? {
                      anchor: backward ? textarea.selectionEnd : textarea.selectionStart,
                      head: backward ? textarea.selectionStart : textarea.selectionEnd,
                  }
                : undefined

        view = createMarkdownEditor(container.value, {
            doc: props.modelValue,
            placeholder: props.placeholder,
            maxLength: props.maxlength,
            selection,
            contentAttributes: attributes,
            onChange: (value) => emit('update:modelValue', value),
        })
        // `rows` as a minimum height, like the textarea it replaces (1.5rem per line plus padding).
        container.value.style.setProperty('--markdown-editor-min-height', `${props.rows * 1.5 + 1.5}rem`)
        ready.value = true

        if (hadFocus) {
            // The container is still hidden by `v-show` until Vue has rendered `ready`, and a hidden
            // element cannot take focus. The component may also unmount meanwhile.
            await nextTick()
            if (!unmounted) {
                view?.focus()
            }
        }
    } catch (error) {
        // The textarea stays, so the speaker can still fill in the field.
        console.error('Markdown editor could not be loaded:', error)
    }
})

watch(
    () => props.modelValue,
    (value) => {
        if (view && value !== view.state.doc.toString()) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
        }
    }
)

onBeforeUnmount(() => {
    unmounted = true
    view?.destroy()
    view = null
})
</script>

<style lang="postcss">
/* Not scoped: CodeMirror creates this DOM itself. Three classes deep to win over its base theme. */
.markdown-editor .cm-editor.cm-focused {
    @apply outline-none;
}
.markdown-editor .cm-editor .cm-scroller {
    @apply font-[inherit] leading-6;
}
.markdown-editor .cm-editor .cm-content {
    @apply px-4 py-3;
    min-height: var(--markdown-editor-min-height, 9rem);
}
.markdown-editor .cm-editor .cm-line {
    @apply p-0;
}
.markdown-editor .cm-editor .cm-placeholder {
    @apply text-white/40;
}

/* Markdown highlighting, see helpers/markdownEditor.ts */
.markdown-editor .cm-md-mark {
    @apply text-lime;
}
.markdown-editor .cm-md-strong {
    @apply font-black;
}
.markdown-editor .cm-md-emphasis {
    @apply italic;
}
.markdown-editor .cm-md-link {
    @apply text-lime;
}
.markdown-editor .cm-md-url {
    @apply text-blue underline;
}
.markdown-editor .cm-md-code {
    @apply rounded bg-white/10 font-mono;
}
.markdown-editor .cm-md-heading {
    @apply font-bold;
}
.markdown-editor .cm-md-quote {
    @apply italic text-white/70;
}
.markdown-editor .cm-md-escape {
    @apply text-white/50;
}
</style>
