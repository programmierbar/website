<template>
    <div ref="container" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Cloudflare Turnstile challenge. Only rendered when the site key is configured
 * (see `server/utils/formProtection.ts`); emits the token the server verifies.
 */
const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ token: [value: string | null] }>()

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const container = ref<HTMLElement | null>(null)
let widgetId: string | undefined

function loadScript(): Promise<any> {
    const w = window as any
    if (w.turnstile) return Promise.resolve(w.turnstile)

    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
        const script = existing ?? document.createElement('script')
        script.addEventListener('load', () => resolve(w.turnstile))
        script.addEventListener('error', reject)
        if (!existing) {
            script.src = SCRIPT_URL
            script.async = true
            document.head.appendChild(script)
        }
    })
}

onMounted(async () => {
    const turnstile = await loadScript().catch(() => null)
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
