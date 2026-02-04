<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTicketCheckoutStore } from '~/composables/useTicketCheckoutStore'
import Pagination from '~/components/Pagination.vue'
import TicketStepQuantity from './TicketStepQuantity.vue'
import TicketStepAttendees from './TicketStepAttendees.vue'
import TicketStepBilling from './TicketStepBilling.vue'
import TicketStepReview from './TicketStepReview.vue'

const props = defineProps<{
    conferenceId: string
    conferenceSlug: string
    conferenceTitle: string
    ticketSettings?: {
        early_bird_price_cents: number
        regular_price_cents: number
        discounted_price_cents: number
        early_bird_deadline: string
        discount_code: string | null
    } | null
}>()

const store = useTicketCheckoutStore()

// Initialize store with conference data and pre-fetched settings
onMounted(() => {
    store.initConference(props.conferenceId, props.conferenceSlug, props.conferenceTitle, props.ticketSettings)
})

// Define the checkout steps
const checkoutSteps = computed(() => [
    {
        component: TicketStepQuantity,
        props: {
            conferenceTitle: props.conferenceTitle,
        },
    },
    {
        component: TicketStepAttendees,
        props: {},
    },
    {
        component: TicketStepBilling,
        props: {},
    },
    {
        component: TicketStepReview,
        props: {},
    },
])

function onLastPageReached() {
    // This is handled by the TicketStepReview component's payment button
    // The Pagination component's "Weiter" button becomes "Bezahlen" on the last step
}
</script>

<template>
    <div class="ticket-purchase-flow mx-auto max-w-2xl px-4 py-8">
        <Pagination :components="checkoutSteps" :show-back-button="true" @last-page-reached="onLastPageReached" />
    </div>
</template>
