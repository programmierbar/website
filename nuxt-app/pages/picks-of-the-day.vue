<template>
  <div v-if="picksOfTheDay" class="relative">
    <div
      class="
        container
        px-6
        md:pl-48
        lg:pr-8
        3xl:px-8
        pt-32
        md:pt-40
        lg:pt-56
        2xl:pt-64
        pb-20
        md:pb-32
        lg:pb-52
      "
    >
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <!-- Page intro -->
      <SectionHeading class="mt-8 md:mt-0" tag="h1">
        Picks Of The Day
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
        Die neusten Features, coole Tools, hilfreiche Websiten und vieles mehr.
        Genau darum geht es bei unseren Picks Of The Day. Am Ende jeder Deep
        Dive Folge versuchen wir für euch unsere besten Helfer aufzulisten,
        damit sie vielleicht auch euch irgndwann das Leben leichter machen.
      </p>

      <!-- Picks of the day -->
      <div class="mt-20 md:mt-32 lg:mt-40">
        <ul
          class="
            flex flex-wrap
            items-center
            justify-between
            -my-8
            md:-my-12
            lg:-my-24
          "
        >
          <li
            v-for="(pickOfTheDay, index) of picksOfTheDay"
            :key="pickOfTheDay.id"
            class="group w-full h-full lg:w-1/2 my-8 md:my-12 lg:my-24"
            :class="[
              (index + 3) % 4 < 2 ? 'lg:scale-70' : 'lg:scale-110',
              index % 2 ? 'lg:origin-right' : 'lg:origin-left',
            ]"
          >
            <PickOfTheDayCard
              :pick-of-the-day="pickOfTheDay"
              :variant="(index + 3) % 4 < 2 ? 'small' : 'large'"
            />
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from '@nuxtjs/composition-api';
import { Breadcrumbs, PickOfTheDayCard, SectionHeading } from '../components';
import { useStrapi } from '../composables';

export default defineComponent({
  components: {
    Breadcrumbs,
    PickOfTheDayCard,
    SectionHeading,
  },
  setup() {
    // Query Strapi hall of fame page and speakers
    const picksOfTheDay = useStrapi('picks-of-the-day', ref(`?_limit=-1`));

    return {
      picksOfTheDay,
      breadcrumbs: [{ label: 'Picks of the Day' }],
    };
  },
});
</script>
