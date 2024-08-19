<template>
    <div v-if="profile">
        <article class="glowing-background mb-10 text-white">
            <div class="container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-48 lg:pt-56 2xl:pt-64 3xl:px-8">
                <ProfileHeader class="hidden md:flex" :profile />
                <ProfileHeaderMobile class="md:hidden" :profile />
                <hr class="my-6" />
                <ProfileSection title="Über mich" :html="profile.description" />
                <ProfileSection class="hidden md:block" title="Rolle" :content="profile.job_role || '-'" />
                <ProfileSection
                    class="hidden md:block"
                    title="Arbeitgeber / Institution"
                    :content="profile.job_employer || '-'"
                />
                <ProfileSection class="hidden md:block" title="Ich in drei Emojis">
                    <div class="flex flex-row gap-4">
                        <div v-for="emoji in profile.emojis_prepared" :key="emoji.id" class="text-6xl">
                            {{ emoji.display_emoji }}
                        </div>
                    </div>
                </ProfileSection>
                <ProfileSection title="Meine Interessen">
                    <div class="flex flex-wrap gap-4">
                        <div
                            v-for="interestedTag in profile.interested_tags_prepared"
                            :key="interestedTag.id"
                            class="inline-flex items-center rounded-xl border-2 border-white px-6 py-4 text-base md:text-2xl"
                        >
                            <span> #{{ interestedTag.name }} </span>
                        </div>
                    </div>
                </ProfileSection>
                <div class="py-52"><!-- Space for future edit buttons --></div>
            </div>
        </article>
    </div>
</template>

<script setup lang="ts">
import ProfileHeader from '~/components/ProfileHeader.vue'
import ProfileHeaderMobile from '~/components/ProfileHeaderMobile.vue'
import ProfileSection from '~/components/ProfileSection.vue'
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import { generateProfile } from '~/helpers/jsonLdGenerator'
import type { DirectusProfileItem } from '~/types'
import { computed, type ComputedRef } from 'vue'

// Add route and router
const route = useRoute()
const directus = useDirectus()

const { data: pageData } = useAsyncData(route.fullPath, async () => {
    const [profile] = await Promise.all([await directus.getProfileBySlug(route.params.slug as string)])

    if (!profile) {
        console.info('No profile found with slug.', route.params.slug as string)
    }

    return { profile }
})

const profile: ComputedRef<DirectusProfileItem | undefined> = computed(() => pageData.value?.profile)

// Set loading screen
useLoadingScreen(profile)

// Set page meta data
useHead(() =>
    profile.value
        ? getMetaInfo({
              type: 'website',
              path: route.path,
              title: `${profile.value.first_name} ${profile.value.last_name}`,
              description: profile.value.description,
              image: profile.value.profile_image,
          })
        : {}
)

useJsonld(generateProfile(profile.value))

// Create breadcrumb list
const breadcrumbs = computed(() => [
    { label: 'Profiles', href: '/profiles' },
    { label: `${profile?.value?.first_name} ${profile?.value?.last_name}` },
])
</script>

<style lang="css" scoped>
.glowing-background {
    background-image: url('~/assets/images/background-glow-tr.svg'), url('~/assets/images/background-glow-bl.svg');
    background-position:
        right top,
        left bottom;
    background-repeat: no-repeat;
}
</style>
