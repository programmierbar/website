<template>
  <div v-for="agendaItem of preparedAgenda" :key="agendaItem.title + agendaItem.subtitle">
    <p class='text-sm font-light italic mt-8'>
      <span v-if='agendaItem.start'>{{ agendaItem.start }}&nbsp;</span>
      <span v-if='agendaItem.end'>- {{ agendaItem.end }}&nbsp;</span>
      <span v-if='(agendaItem.start || agendaItem.end) && agendaItem.subtitle'>// </span>
      <span v-if='agendaItem.subtitle'>{{ agendaItem.subtitle }}</span>
    </p>
    <p class='mt-1 text-xl'>{{ agendaItem.title }}</p>
    <hr class='mt-1 border-white' />
  </div>
</template>

<script setup lang="ts">
import { computed, type ComputedRef } from 'vue'

type Agenda = {
  start: string,
  end: string,
  title: string,
  subtitle: string,
}

const props = defineProps<{
  agenda: Agenda[]
}>();

const preparedAgenda: ComputedRef<Agenda[]> = computed(() => {
  return props.agenda.map((agendaItem) => {
    return {
      title: agendaItem.title,
      subtitle: agendaItem.subtitle,
      start: agendaItem.start ? new Date(agendaItem.start).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }) : '',
      end: agendaItem.end ? new Date(agendaItem.end).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }) : '',
    }
  })
})

</script>

<style lang="postcss" scoped>
</style>
