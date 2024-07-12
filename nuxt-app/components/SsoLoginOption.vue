<script setup lang="ts">
import GithubIcon from '~/assets/logos/github.svg'

const props = defineProps<{
    provider: string
}>()

const providerImage = computed(() => {
    switch (props.provider) {
        case 'github':
            return GithubIcon
        default:
            return ''
    }
})
</script>

<template>
    <div
        class="btn btn-primary relative flex items-center justify-center gap-x-4 rounded-full border-2 px-7 py-3.5 text-base font-light leading-8 text-white md:text-2xl"
    >
        <component :is="providerImage" class="absolute left-6 w-8 md:left-9" />
        <div class="flex-1 text-center">
            <slot />
        </div>
    </div>
</template>
