<template>
   <ClientOnly>
    <div v-if="profile" class='text-white'>
      <h2>Profile</h2>
      <dl>
        <dt>ID:</dt>
        <dd>{{ profile.id }}</dd>
        <dt>First Name:</dt>
        <dd>{{ profile.first_name }}</dd>
        <dt>Last Name:</dt>
        <dd>{{ profile.last_name }}</dd>
        <dt>Display Name:</dt>
        <dd>{{ profile.display_name }}</dd>
        <dt>Description:</dt>
        <dd><InnerHtml
            :html="profile.description"
          /></dd>
        <dt>Job Role:</dt>
        <dd>{{ profile.job_role }}</dd>
        <dt>Job Employer:</dt>
        <dd>{{ profile.job_employer }}</dd>
        <dt>Photo:</dt>
        <dd>
          <DirectusImage
            v-if="profile.profile_image"
            :image="profile.profile_image"
          /></dd>
      </dl>
    </div>
  <div v-if="!profile" class='text-white'>
    <h2>Profile Doesn't Exist</h2>
  </div>
    <p class='text-white'>{{profile}}</p>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useLoadingScreen } from '~/composables'
import { useDirectus } from '~/composables/useDirectus'
import { getMetaInfo } from '~/helpers'
import type { DirectusProfileItem } from '~/types';
import { computed, type ComputedRef } from 'vue'
import { generateProfile } from '~/helpers/jsonLdGenerator';
import DirectusImage from '~/components/DirectusImage.vue';

// Add route and router
const route = useRoute()
const directus = useDirectus()

const { data: pageData } = useAsyncData(route.fullPath, async () => {
    const [profile] = await Promise.all([
        await directus.getProfileById(route.params.slug as string),
    ])

  if (!profile) {
      console.info('No profile found with slug.', route.params.slug as string)
    }

    return { profile }
})

const profile: ComputedRef<DirectusProfileItem | undefined> = computed(() => pageData.value?.profile)

// Set loading screen
//useLoadingScreen(profile)

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
