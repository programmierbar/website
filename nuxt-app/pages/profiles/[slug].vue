<template>
  <div v-if='profile'>
    <article class='text-white mb-10 glowing-background'>
      <div class='container px-6 pt-32 md:pl-48 md:pt-40 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8'>
        <ProfileHeader :profile="profile" />
        <hr class='my-6'/>
        <ProfileSection title='Über mich' :html='profile.description' />
        <ProfileSection title='Rolle' :content='profile.job_role || "-"' />
        <ProfileSection title='Arbeitgeber / Institution' :content='profile.job_employer || "-"' />
        <ProfileSection title='Ich in drei Emojis'>
          <div class='flex flex-row gap-4'>
            <div v-for='emoji in profile.emojis_prepared' :key='emoji.id' class='text-6xl'>
              {{ emoji.display_emoji }}
            </div>
          </div>
        </ProfileSection>
        <ProfileSection title='Meine Interessen'>
          <div class='flex flex-row gap-6'>
            <span v-for='interestedTag in profile.interested_tags_prepared' :key='interestedTag.id'
                  class='border-2 border-white rounded-xl text-2xl py-4 px-6'>
              {{ interestedTag.name }}
            </span>
          </div>
        </ProfileSection>
        <div class='py-52'><!-- Space for future edit buttons --></div>
      </div>
    </article>
  </div>
</template>

<script setup lang='ts'>
import { useLoadingScreen } from '~/composables';
import { useDirectus } from '~/composables/useDirectus';
import { getMetaInfo } from '~/helpers';
import type { DirectusProfileItem } from '~/types';
import { computed, type ComputedRef } from 'vue';
import { generateProfile } from '~/helpers/jsonLdGenerator';

// Add route and router
const route = useRoute();
const directus = useDirectus();

const { data: pageData } = useAsyncData(route.fullPath, async () => {
  const [profile] = await Promise.all([
    await directus.getProfileBySlug(route.params.slug as string),
  ]);

  if (!profile) {
    console.info('No profile found with slug.', route.params.slug as string);
  }

  return { profile };
});

const profile: ComputedRef<DirectusProfileItem | undefined> = computed(() => pageData.value?.profile);

// Set loading screen
useLoadingScreen(profile);

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
    : {},
);

useJsonld(generateProfile(profile.value));

// Create breadcrumb list
const breadcrumbs = computed(() => [
  { label: 'Profiles', href: '/profiles' },
  { label: `${profile?.value?.first_name} ${profile?.value?.last_name}` },
]);
</script>

<style lang='css' scoped>
.glowing-background {
  background-image: url('~/assets/images/background-glow-tr.svg'), url('~/assets/images/background-glow-bl.svg');
  background-position: right top, left bottom;
  background-repeat: no-repeat;
}
</style>
