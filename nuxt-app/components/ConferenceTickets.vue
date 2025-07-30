<template>
  <client-only>
    <template #default>
    <div class='flex flex-row flex-wrap space justify-around mt-8'>
      <div v-for="(ticket) in tickets" :key="ticket.price">
        <ConferenceTicketLime :ticket="ticket" class='h-64' v-if='ticket.style === "lime"'/>
        <ConferenceTicketBlue :ticket="ticket" class='h-64' v-if='ticket.style === "blue"'/>
        <ConferenceTicketRed :ticket="ticket" class='h-64' v-if='ticket.style === "red"'/>
      </div>
    </div>
    </template>
  </client-only>
</template>


<script setup lang="ts">
import ConferenceTicketLime from '~/components/ConferenceTicketLime.vue';

type Ticket = {
  price: string,
  title: string,
  subtitle: string,
  style: string,
}

const props = defineProps<{
  tickets: Ticket[],
  ticketsOnSale: Boolean,
  ticketsUrl: string | null
}>();

</script>

<style lang="postcss" scoped>
</style>
