<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    heading: string
    modelValue: string
    required?: boolean
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
    <div class="free-text-field-with-headline">
        <div class="mb-2 text-base font-bold text-white">
            {{ heading }}
            <span v-if="required" class="mandatory-star text-base font-bold text-lime">*</span>
        </div>

        <InputField v-model="inputValue" type="text" />
    </div>
</template>
