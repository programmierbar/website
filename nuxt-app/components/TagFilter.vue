<template>
  <div class="sticky z-20 top-24 lg:top-32 3xl:top-9">
    <div class="h-8 md:h-9 lg:h-11 relative">
      <div class="w-full absolute top-0 left-0">
        <div
          class="w-full min-h-8 md:min-h-9 lg:min-h-11 relative overflow-hidden"
        >
          <!-- Background box -->
          <div
            class="
              absolute
              top-0
              right-0
              bg-black
              border-2
              md:border-3
              lg:border-4
              border-lime
              rounded-2xl
              md:rounded-3xl
              transition-all
              duration-200
              xl:duration-300
            "
            :class="
              filterIsOpen
                ? 'w-full h-full'
                : 'w-20 md:w-24 lg:w-28 h-8 md:h-9 lg:h-11'
            "
          >
            <!-- Open or close button -->
            <button
              class="
                h-full
                max-h-8
                md:max-h-9
                lg:max-h-11
                absolute
                z-20
                left-0
                bottom-0
                flex
                items-center
                bg-black bg-opacity-40
                text-lime
                px-2.5
                md:px-3
                lg:px-3.5
                rounded-full
                transition-all
                duration-200
                xl:duration-300
              "
              :class="filterIsOpen ? 'translate-x-2 -translate-y-2' : 'w-full'"
              data-cursor-hover
              @click="toggleFilter"
            >
              <div
                class="
                  h-4
                  md:h-5
                  lg:h-6
                  transition-transform
                  duration-200
                  xl:duration-300
                "
                :class="filterIsOpen && 'rotate-90'"
                v-html="require('../assets/icons/angle-left.svg?raw')"
              />
              <div
                class="
                  text-sm
                  md:text-base
                  lg:text-xl
                  font-bold
                  pt-px
                  md:pt-0.5
                  lg:pt-1
                  translate-x-2
                  transition-opacity
                  duration-200
                  xl:duration-300
                "
                :class="filterIsOpen && 'w-0 opacity-0'"
              >
                Filter
              </div>
            </button>
          </div>

          <!-- Tag list -->
          <TagList
            class="
              max-h-1/2-screen
              relative
              z-10
              p-5
              md:p-6
              lg:p-7
              pb-12
              md:pb-14
              lg:pb-16
              my-0.5
              md:my-0.75
              lg:my-1
              overflow-y-auto
              origin-top-right
              transition-all
              duration-200
              xl:duration-300
            "
            :class="!filterIsOpen && 'opacity-0 scale-0'"
            :tags="tags"
            :on-click="toggleTag"
            variant="tag_filter"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref } from '@nuxtjs/composition-api';
import { StrapiTag } from 'shared-code';
import TagList from './TagList.vue';

interface Tag extends StrapiTag {
  isActive?: boolean;
}

export default defineComponent({
  components: {
    TagList,
  },
  props: {
    tags: {
      type: Array as PropType<Tag[]>,
      required: true,
    },
    toggleTag: {
      type: Function as PropType<(_: any, index: number) => void>,
      required: true,
    },
  },
  setup() {
    // Create filter is open reference
    const filterIsOpen = ref(false);

    /**
     * It opens or closes the filter.
     */
    const toggleFilter = () => {
      filterIsOpen.value = !filterIsOpen.value;
    };

    return {
      filterIsOpen,
      toggleFilter,
    };
  },
});
</script>
