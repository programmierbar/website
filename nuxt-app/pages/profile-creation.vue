<script setup lang="ts">
import Pagination from '~/components/Pagination.vue'
import ProfileCreationDetails from '~/components/ProfileCreationDetails.vue'
import ProfileCreationEmojis from '~/components/ProfileCreationEmojis.vue'
import ProfileCreationInterests from '~/components/ProfileCreationInterests.vue'
import ProfileCreationMainInfos from '~/components/ProfileCreationMainInfos.vue'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusProfileCreationPage } from '~/types'
import { computed, ref, type ComputedRef } from 'vue'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()
const route = useRoute()

const { data: pageData } = useAsyncData(async () => {
    const [profileCreationPage, tags] = await Promise.all([directus.getProfileCreationPage(), directus.getAllTopTags()])
    return { profileCreationPage, tags }
})

const profileCreationPage: ComputedRef<DirectusProfileCreationPage | undefined> = computed(
    () => pageData.value?.profileCreationPage
)
const tags = computed(() => pageData.value?.tags)

useLoadingScreen(profileCreationPage)

useHead(
    getMetaInfo({
        type: 'website',
        path: route.path,
        title: 'Profil erstellen',
        noIndex: true,
    })
)

const componentValidStates = ref({
    ProfileCreationMainInfos: false,
    ProfileCreationEmojis: false,
    ProfileCreationInterests: false,
    ProfileCreationDetails: true,
})

const paginationComponents = computed(() => {
    if (!profileCreationPage.value) return []

    return [
        {
            component: ProfileCreationMainInfos,
            props: {
                heading: profileCreationPage.value.heading,
                introText: profileCreationPage.value.intro_text,
                onValidityChange: (valid: boolean) => {
                    componentValidStates.value.ProfileCreationMainInfos = valid
                },
            },
        },
        {
            component: ProfileCreationEmojis,
            props: {
                heading: profileCreationPage.value.emoji_heading,
                mainText: profileCreationPage.value.emoji_text,
                onValidityChange: (valid: boolean) => {
                    componentValidStates.value.ProfileCreationEmojis = valid
                },
            },
        },
        {
            component: ProfileCreationInterests,
            props: {
                heading: profileCreationPage.value.interests_heading,
                mainText: profileCreationPage.value.interests_text,
                tags: tags.value,
                onValidityChange: (valid: boolean) => {
                    componentValidStates.value.ProfileCreationInterests = valid
                },
            },
        },
        {
            component: ProfileCreationDetails,
            props: {
                heading: profileCreationPage.value.heading,
                mainText: profileCreationPage.value.profile_change_text,
            },
        },
    ]
})

const shouldShowSuccessPage = ref(false)

function handleLastPageClick() {
    shouldShowSuccessPage.value = true
    window.scrollTo(0, 0)
}
</script>

<template>
    <div v-if="profileCreationPage" class="relative">
        <div class="container px-6 pb-20 pt-16 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <SectionHeading class="mt-8 hidden md:mt-0 md:block md:pt-2/5-screen lg:pt-1/2-screen" element="h1">
                Mein Profil
            </SectionHeading>

            <Pagination
                v-if="!shouldShowSuccessPage"
                :components="paginationComponents"
                @last-page-reached="handleLastPageClick"
            />
            <Transition name="fade" mode="out-in">
                <ProfileCreationDone v-if="shouldShowSuccessPage" :main-text="profileCreationPage.creation_done_text" />
            </Transition>
        </div>
    </div>
</template>

<style lang="postcss" scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
