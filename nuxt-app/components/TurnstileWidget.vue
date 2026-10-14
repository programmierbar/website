<template>
    <div ref="container" />
</template>

<script setup lang="ts">
import { loadTurnstileScript } from '~/helpers/loadTurnstileScript'
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Cloudflare Turnstile challenge. Only rendered when the site key is configured
 * (see `server/utils/formProtection.ts`); emits the token the server verifies.
 */
const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ token: [value: string | null] }>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | undefined

onMounted(async () => {
    const turnstile = await loadTurnstileScript().catch(() => null)
    if (!turnstile || !container.value) {
        emit('token', null)
        return
    }
    widgetId = turnstile.render(container.value, {
        sitekey: props.siteKey,
        theme: 'dark',
        language: 'de',
        callback: (token: string) => emit('token', token),
        'expired-callback': () => emit('token', null),
        'error-callback': () => emit('token', null),
    })
})

onBeforeUnmount(() => {
    const turnstile = (window as any).turnstile
    if (turnstile && widgetId !== undefined) turnstile.remove(widgetId)
})
</script>
