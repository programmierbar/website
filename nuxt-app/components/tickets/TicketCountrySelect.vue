<script setup lang="ts">
import { BILLING_COUNTRIES } from 'shared-code'

// Billing country as an ISO 3166-1 alpha-2 code (e.g. "DE"), as stored on the order.
defineProps<{ modelValue: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
    <div>
        <label class="text-gray-400 mb-2 block text-sm font-bold">
            Land <span v-if="required" class="text-lime">*</span>
        </label>
        <select
            aria-label="Land"
            :value="modelValue"
            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-lime focus:outline-none"
            @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        >
            <option value="" disabled>Bitte Land auswählen</option>
            <option v-for="country in BILLING_COUNTRIES" :key="country.code" :value="country.code">
                {{ country.name }}
            </option>
        </select>
    </div>
</template>
