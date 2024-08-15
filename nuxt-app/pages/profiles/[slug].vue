<template>
    <div v-if="profile">
      <article class='text-white mb-10'>
        <div class="container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
          <div class='flex mb-6 items-center'>
            <div class='h-24 w-24 md:h-64 md:w-64'>
              <ProfilePicture :image='profile.profile_image' />
            </div>
            <div class='h-full flex flex-col pl-6'>
              <h1>
                {{ profile.first_name }} {{ profile.last_name }}
              </h1>
              <p>
                🎂 dabei seit  <NuxtTime :datetime="profile.date_created_prepared" month="long" day="numeric" year='numeric' />
              </p>
            </div>
          </div>
          <hr class='my-6'/>
          <h2 class='mb-4 mt-8'>Über mich</h2>
          <InnerHtml
            :html="profile.description"
          />
          <h2 class='mb-4 mt-8'>Rolle</h2>
          <p>{{ profile.job_role || '-' }}</p>
          <h2 class='mb-4 mt-8'>Arbeitgeber / Institution</h2>
          <p>{{ profile.job_employer || '-' }}</p>
          <h2 class='mb-4 mt-8'>Ich in drei Emojis</h2>
          <div class='my-4'>
            <span v-for='emoji in profile.emojis_prepared' :key="emoji.id" class='p-3 mr-2'>
              {{ emoji.display_emoji }}
            </span>
          </div>
          <h2 class='mb-4 mt-8'>Meine Interessen</h2>
          <div class='my-4'>
            <span v-for='interestedTag in profile.interested_tags_prepared' :key="interestedTag.id" class='border-2 border-white rounded-xl p-3 mr-2'>
              {{ interestedTag.name }}
            </span>
          </div>
        </div>
      </article>
    </div>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import type { DirectusProfileItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import { generateProfile } from '~/helpers/jsonLdGenerator';

// Add route and router
const route = useRoute()
const directus = useDirectus()

const { data: pageData } = useAsyncData(route.fullPath, async () => {
    const [profile] = await Promise.all([
        await directus.getProfileBySlug(route.params.slug as string),
    ])

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
