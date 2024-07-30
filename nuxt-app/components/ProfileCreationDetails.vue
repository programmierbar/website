<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
    heading: string
    mainText: string
}>()

const store = useProfileCreationStore()
const { details } = storeToRefs(store)

const role = ref(details.value.role ?? '')
const company = ref(details.value.company ?? '')
const location = ref(details.value.location ?? '')
const aboutMe = ref(details.value.aboutMe ?? '')

function updateRole(value: string) {
    store.updateDetails({ ...details.value, role: value })
}

function updateCompany(value: string) {
    store.updateDetails({ ...details.value, company: value })
}

function updateLocation(value: string) {
    store.updateDetails({ ...details.value, location: value })
}

function updateAboutMe(value: string) {
    store.updateDetails({ ...details.value, aboutMe: value })
}
</script>

<template>
    <div class="profile-creation-intro">
        <div class="flex-col items-center justify-center md:flex">
            <div class="mb-2 mt-5 text-3xl font-semibold italic leading-[3rem] text-white md:text-4xl">
                {{ heading }}
            </div>
        </div>

        <div class="intro-text mt-5 text-base font-light text-white md:text-4xl">{{ mainText }}</div>
        <div class="mt-12 flex w-full flex-col items-center justify-center">
            <InputFieldWithHeadline
                v-model="role"
                class="input-field"
                heading="Rolle"
                @update:model-value="updateRole"
            />
            <InputFieldWithHeadline
                v-model="company"
                class="input-field"
                heading="Firma"
                @update:model-value="updateCompany"
            />
            <InputFieldWithHeadline
                v-model="location"
                class="input-field"
                heading="Standort"
                @update:model-value="updateLocation"
            />
            <InputFieldWithHeadline
                v-model="aboutMe"
                class="input-field"
                heading="Über mich"
                @update:model-value="updateAboutMe"
            />
        </div>
    </div>
</template>

<style scoped lang="postcss">
.input-field {
    @apply mb-8 w-80 text-base font-bold text-white md:w-120;
}
</style>
