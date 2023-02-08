<template>
  <div v-if="aboutPage && podcastCrewMembers && behindTheScenesMembers">
    <section class="relative overflow-hidden md:overflow-unset">
      <!-- Page cover -->
      <PageCoverImage :cover-image="aboutPage.cover_image" />
      <div
        class="container px-6 md:pl-48 lg:pr-8 3xl:px-8 mt-16 md:mt-28 lg:mt-32"
      >
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <!-- Page intro -->
        <SectionHeading
          class="md:pt-2/5-screen lg:pt-1/2-screen mt-8 md:mt-0"
          element="h1"
        >
          {{ aboutPage.podcast_crew_heading }}
        </SectionHeading>
        <InnerHtml
          class="text-lg md:text-2xl lg:text-3xl text-white md:font-bold leading-normal md:leading-normal lg:leading-normal space-y-8 mt-8 md:mt-16"
          :html="aboutPage.intro_text"
        />

        <!-- Podcast crew members -->
        <ul class="flex justify-between flex-wrap">
          <li
            v-for="(member, index) in podcastCrewMembers"
            :key="member.id"
            class="md:w-2/5 mt-20"
            :class="index % 2 === 0 ? 'md:mt-32' : 'md:mt-60'"
          >
            <MemberCard :member="member" :color="memberColors[index % 3]" />
          </li>
        </ul>
      </div>
    </section>

    <!-- Behind the scenes members -->
    <section class="relative mb-20 md:mb-40 lg:mb-60">
      <div class="container px-6 md:pl-48 lg:pr-8 3xl:px-8">
        <SectionHeading class="md:pt-32 mt-20 md:mt-0" element="h2">
          {{ aboutPage.behind_the_scenes_heading }}
        </SectionHeading>
        <ul class="flex justify-between flex-wrap">
          <li
            v-for="(member, index) in behindTheScenesMembers"
            :key="member.id"
            class="md:w-2/5"
            :class="[
              index > 0 ? 'mt-20' : 'mt-12',
              index % 2 === 0 ? 'md:mt-32' : 'md:mt-72',
            ]"
          >
            <MemberCard :member="member" :color="memberColors[index % 3]" />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import {
  Breadcrumbs,
  InnerHtml,
  MemberCard,
  PageCoverImage,
  SectionHeading,
} from '../components';
import { useAsyncData, useLoadingScreen, usePageMeta } from '../composables';
import { directus } from '../services';
import { AboutPage, MemberItem } from '../types';

export default defineComponent({
  components: {
    Breadcrumbs,
    InnerHtml,
    MemberCard,
    PageCoverImage,
    SectionHeading,
  },
  setup() {
    // Query about page and members
    const pageData = useAsyncData(async () => {
      const [aboutPage, podcastCrewMembers, behindTheScenesMembers] =
        await Promise.all([
          // About page
          directus
            .singleton('about_page')
            .read({ fields: '*.*' }) as Promise<AboutPage>,

          // Podcast crew members
          (
            await directus.items('members').readMany({
              fields: [
                'id',
                'first_name',
                'last_name',
                'task_area',
                'occupation',
                'description',
                'normal_image.*',
                'action_image.*',
              ],
              filter: {
                task_area: 'podcast_crew',
              },
            })
          ).data as Pick<
            MemberItem,
            | 'id'
            | 'first_name'
            | 'last_name'
            | 'task_area'
            | 'occupation'
            | 'description'
            | 'normal_image'
            | 'action_image'
          >[],

          // Behind the Scenes members
          (
            await directus.items('members').readMany({
              fields: [
                'id',
                'first_name',
                'last_name',
                'task_area',
                'occupation',
                'description',
                'normal_image.*',
                'action_image.*',
              ],
              filter: {
                task_area: 'behind_the_scenes',
              },
            })
          ).data as Pick<
            MemberItem,
            | 'id'
            | 'first_name'
            | 'last_name'
            | 'task_area'
            | 'occupation'
            | 'description'
            | 'normal_image'
            | 'action_image'
          >[],
        ]);
      return { aboutPage, podcastCrewMembers, behindTheScenesMembers };
    });

    // Extract about page and members
    const aboutPage = computed(() => pageData.value?.aboutPage);
    const podcastCrewMembers = computed(
      () => pageData.value?.podcastCrewMembers
    );
    const behindTheScenesMembers = computed(
      () => pageData.value?.behindTheScenesMembers
    );

    // Set loading screen
    useLoadingScreen(aboutPage, podcastCrewMembers, behindTheScenesMembers);

    // Set page meta data
    usePageMeta(aboutPage);

    return {
      aboutPage,
      podcastCrewMembers,
      behindTheScenesMembers,
      breadcrumbs: [{ label: 'Über uns' }],
      memberColors: ['pink', 'blue', 'lime'] as const,
    };
  },
  head: {},
});
</script>
