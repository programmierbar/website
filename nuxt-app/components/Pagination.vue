<script setup lang="ts">
import AngleRightIcon from '~/assets/icons/angle-right.svg'
import { computed, ref } from 'vue'

const props = defineProps<{
    components: {
        component: any
        props: Record<string, any>
    }[]
}>()

const emit = defineEmits(['lastPageReached'])

const currentPage = ref(0)
const componentValidStates = ref(props.components.map((_, index) => index === props.components.length - 1))

const currentComponent = computed(() => props.components[currentPage.value].component)
const currentComponentProps = computed(() => ({
    ...props.components[currentPage.value].props,
    onValidityChange: (valid: boolean) => {
        componentValidStates.value[currentPage.value] = valid
    },
}))

const isNextButtonDisabled = computed(() => {
    return !componentValidStates.value[currentPage.value]
})

async function setPage(page: number) {
    if (page < currentPage.value) {
        currentPage.value = page
    } else if (page > currentPage.value) {
        const allPreviousPagesValid = componentValidStates.value.slice(0, page).every((state) => state === true)
        if (allPreviousPagesValid) {
            currentPage.value = page
        }
    }
}

async function nextPage() {
    if (currentPage.value === props.components.length - 1) {
        emit('lastPageReached')
        return
    }

    if (!isNextButtonDisabled.value) {
        currentPage.value++
    }
}

function isDotClickable(index: number) {
    if (index <= currentPage.value) return true
    return componentValidStates.value.slice(0, index).every((state) => state)
}

function onTransitionComplete() {
    window.scrollTo(0, 0)
}
</script>

<template>
    <div class="pagination">
        <Transition name="fade" mode="out-in" @after-leave="onTransitionComplete">
            <component :is="currentComponent" v-bind="currentComponentProps" :key="currentPage" />
        </Transition>

        <div class="pagination-controls mt-5 flex flex-col items-center justify-between">
            <div class="pagination-dots flex flex-row gap-x-3">
                <span
                    v-for="(_, index) in components"
                    :key="index"
                    class="dot h-2.5 w-2.5 cursor-pointer rounded-full"
                    :class="{
                        active: currentPage >= index,
                        'cursor-not-allowed opacity-50': !isDotClickable(index),
                    }"
                    @click="isDotClickable(index) && setPage(index)"
                ></span>
            </div>
            <div
                class="mt-4 flex flex-row items-center justify-center"
                :class="{ 'opacity-30': isNextButtonDisabled }"
                @click="nextPage"
            >
                <button class="font-bold uppercase tracking-widest text-white" :disabled="isNextButtonDisabled">
                    Weiter
                </button>
                <AngleRightIcon class="ml-2 h-6 text-white" />
            </div>
        </div>
    </div>
</template>

<style lang="postcss" scoped>
.dot {
    background-color: #3a3d3f;
    transition:
        background-color 0.3s ease,
        opacity 0.3s ease;
}

.dot.active {
    background-color: #cfff00;
    animation: dotActivation 0.5s ease-out;
}

@keyframes dotActivation {
    0% {
        transform: scale(0.2);
    }
    50% {
        transform: scale(1.5);
    }
    100% {
        transform: scale(1);
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
