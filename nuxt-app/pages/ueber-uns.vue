<template>
  <div v-if="aboutPage && members">
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
        <p
          class="
            text-lg
            md:text-2xl
            lg:text-3xl
            text-white
            md:font-bold
            leading-normal
            md:leading-normal
            lg:leading-normal
            mt-8
            md:mt-16
          "
        >
          {{ aboutPage.intro_text }}
        </p>

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
import { computed, defineComponent } from '@nuxtjs/composition-api';
import {
  Breadcrumbs,
  MemberCard,
  PageCoverImage,
  SectionHeading,
} from '../components';
import { useStrapi, useLoadingScreen, usePageMeta } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    MemberCard,
    PageCoverImage,
    SectionHeading,
  },
  setup() {
    // Query Strapi about page and members
    const aboutPage = useStrapi('about-page');
    const members = useStrapi('members');

    // Set loading screen
    useLoadingScreen(aboutPage, members);

    // Set page meta data
    usePageMeta(aboutPage);

    // Create podcast crew memeber list
    const podcastCrewMembers = computed(() =>
      members.value
        ?.filter((member) => member.task_area === 'podcast_crew')
        .sort((a, b) =>
          (a.position || Infinity) < (b.position || Infinity) ? -1 : 1
        )
    );

    // Create behind the scenes memeber list
    const behindTheScenesMembers = computed(() =>
      members.value
        ?.filter((member) => member.task_area === 'behind_the_scenes')
        .sort((a, b) =>
          (a.position || Infinity) < (b.position || Infinity) ? -1 : 1
        )
    );

    return {
      aboutPage,
      members,
      podcastCrewMembers,
      behindTheScenesMembers,
      breadcrumbs: [{ label: 'Über uns' }],
      memberColors: ['pink', 'blue', 'lime'] as const,
    };
  },
  head: {},
});
</script>
