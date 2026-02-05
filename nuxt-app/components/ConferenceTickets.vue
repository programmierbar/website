<template>
    <client-only>
        <template #default>
            <div class="space mt-8 flex flex-row flex-wrap justify-around">
                <div v-for="ticket in tickets" :key="ticket.price">
                    <ConferenceTicketLime v-if="ticket.style === 'lime'" :ticket="ticket" class="h-64" />
                    <ConferenceTicketBlue v-if="ticket.style === 'blue'" :ticket="ticket" class="h-64" />
                    <ConferenceTicketRed v-if="ticket.style === 'red'" :ticket="ticket" class="h-64" />
                </div>
            </div>
        </template>
    </client-only>
</template>

<script setup lang="ts">
import ConferenceTicketLime from '~/components/ConferenceTicketLime.vue'

type Ticket = {
    price: string
    title: string
    subtitle: string
    style: string
}

const props = defineProps<{
    tickets: Ticket[]
    ticketsOnSale: Boolean
    ticketsUrl: string | null
}>()
</script>

<style lang="postcss" scoped></style>
