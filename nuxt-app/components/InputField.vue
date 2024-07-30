<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    modelValue: string
    type: string
    placeholder?: string
    style?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>()

const inputValue = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
})
</script>

<template>
    <input v-model="inputValue" class="input-field" :type="type" :placeholder="placeholder" :style="style" />
</template>

<style scoped lang="postcss">
.input-field {
    @apply h-12 w-full max-w-120 rounded-lg pl-5 text-white;
    background-color: #3a3d3f;
}

.input-field::placeholder {
    color: white;
    font-style: italic;
}
</style>
