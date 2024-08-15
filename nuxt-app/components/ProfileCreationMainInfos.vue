<script setup lang="ts">
import ProfilePicture from '~/components/ProfilePicture.vue'
import { useProfileCreationStore } from '~/composables/useProfileCreationStore'
import { computed, ref, watch } from 'vue'

defineProps<{
    heading: string
    introText: string
}>()

const emit = defineEmits(['validityChange'])
const store = useProfileCreationStore()
const { mainInfos } = storeToRefs(store)

const firstName = ref(mainInfos.value.firstName ?? '')
const lastName = ref(mainInfos.value.lastName ?? '')

const isFormValid = computed(() => {
    return firstName.value.trim() !== '' && lastName.value.trim() !== ''
})

watch(isFormValid, (valid) => {
    emit('validityChange', valid)
})

function updateFirstName(value: string) {
    store.updateMainInfos({ ...mainInfos.value, firstName: value })
}

function updateLastName(value: string) {
    store.updateMainInfos({ ...mainInfos.value, lastName: value })
}

function updatePicture(file: File, previewUrl: string) {
  store.updateProfilePicture(file, previewUrl)
}

</script>

<template>
    <div class="profile-creation-intro">
        <div class="flex-col items-center justify-center md:flex">
            <div class="mb-2 mt-5 text-3xl font-semibold italic leading-[3rem] text-white md:text-4xl">
                {{ heading }}
            </div>
        </div>

        <div class="intro-text mb-2 mt-5 text-base font-light text-white md:text-4xl" v-html="introText"></div>
        <div class="flex w-full flex-col items-center justify-center my-10">
          <ProfilePicture class="h-24 w-24 md:h-64 md:w-64"
                          :editable='true'
                          :handler='updatePicture'
          />
        </div>
        <div class="flex w-full flex-col items-center justify-center">
            <InputFieldWithHeadline
                v-model="firstName"
                class="input-field"
                heading="Name"
                required
                @update:model-value="updateFirstName"
            />
            <InputFieldWithHeadline
                v-model="lastName"
                class="input-field"
                heading="Nachname"
                required
                @update:model-value="updateLastName"
            />
        </div>
    </div>
</template>

<style scoped lang="postcss">
.input-field {
    @apply mb-8 w-80 text-base font-bold text-white md:w-120;
}
</style>
