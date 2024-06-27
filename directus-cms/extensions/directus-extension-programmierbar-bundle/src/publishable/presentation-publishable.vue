<script setup lang="ts">
import { useApi } from '@directus/extensions-sdk'
import { onMounted, ref, watch } from 'vue'
import {isPublishable} from '../shared/isPublishable';

const props = defineProps<{ collection: string; primaryKey: string }>()

const itemData = ref(null)
const fieldData = ref(null)
const publishable = ref<Boolean|null>(null)
const messages = ref([])

const api = useApi()

function logToUi(message: string): void {
    messages.value.push(message);
}

watch(() => props.primaryKey, async function(newValue, oldValue) {
    logToUi('Prop changed from ' +  oldValue + ' to ' + newValue);

    if (newValue === '+') {
        return
    }

    const itemResponse = await api.get(`/items/${props.collection}/${props.primaryKey}`)
    itemData.value = itemResponse.data.data

    logToUi('Loaded item data')
    logToUi(JSON.stringify(itemData.value))
});

watch([() => itemData.value, () => fieldData.value], async function(newValue, oldValue) {
    logToUi('item and field data changed');

    if (itemData.value && fieldData.value) {
        logToUi('item and field data filled, refreshing state');
        publishable.value = isPublishable(itemData.value, fieldData.value, logToUi);
    }
});

onMounted(async () => {
    const fieldResponse = await api.get(`/fields/${props.collection}`)
    fieldData.value = fieldResponse.data.data

    logToUi('Loaded field data')
    logToUi(JSON.stringify(fieldData.value))
})
</script>

<template>
    <!--p>Messages:</p>
    <p v-for="message in messages">
        {{ JSON.stringify(message) }}
    </p-->
    <div v-if="publishable === true">
        <v-icon name="check_circle" left />
        Can be published.
    </div>
    <div v-else-if="publishable === false">
        <v-icon name="unpublished" left />
        Can not be published.
    </div>
    <div v-else-if="publishable === null">
        <v-progress-circular indeterminate />
        Publishable state not yet determined...
    </div>
    <div v-else>
        <v-icon name="warning" left />
        Unknown publishable state. This should not happen and indicates an error.
    </div>
</template>
