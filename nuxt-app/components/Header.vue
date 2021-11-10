<template>
  <header :class="menuIsOpen && 'menu-is-open'">
    <!-- Logo -->
    <NuxtLink
      class="
        fixed
        z-40
        top-5
        left-0
        py-3
        lg:pt-5
        pr-4
        lg:pr-5 lg:pb-4
        pl-6
        lg:pl-8
        bg-opacity-75
        backdrop-filter backdrop-blur
        transition-colors
        duration-300
      "
      :class="menuIsOpen ? 'bg-gray-900' : 'bg-black'"
      to="/"
      data-cursor-hover
    >
      <img
        class="h-7 lg:hidden"
        :src="require('~/assets/images/brand-icon.svg')"
        alt="programier.bar Icon"
      />
      <img
        class="h-8 hidden lg:block"
        :src="require('~/assets/images/brand-logo.svg')"
        alt="programier.bar Logo"
      />
    </NuxtLink>

    <!-- Search form -->
    <form
      class="
        fixed
        z-40
        top-7
        right-18
        lg:right-24
        flex
        bg-opacity-75
        backdrop-filter backdrop-blur
        transition-all
        duration-300
      "
      :class="[
        searchIsOpen ? 'w-36 xs:w-60 md:w-80' : 'w-10 lg:w-14',
        menuIsOpen ? 'bg-gray-900' : 'bg-black',
      ]"
      @submit.prevent="handleSearch"
    >
      <input
        ref="searchInputElement"
        class="
          w-full
          bg-transparent
          border-b-2 border-white
          rounded-none
          outline-none
          text-lg
          lg:text-2xl
          text-blue text-center
          font-light
        "
        :class="!searchIsOpen && 'invisible transition-all delay-300'"
        type="seach"
        spellcheck="false"
      />
      <button
        class="
          w-6
          lg:w-8
          h-7
          lg:h-9
          text-white
          flex-shrink-0
          box-content
          py-1.5
          lg:py-2.5
          px-2
          lg:px-3
          rounded-none
        "
        :type="searchIsOpen ? 'submit' : 'button'"
        data-cursor-hover
        @click.stop.prevent="handleSearch"
        v-html="require('~/assets/icons/search.svg?raw')"
      />
    </form>

    <!-- Burger icon -->
    <button
      class="
        group
        w-6
        lg:w-8
        h-8
        lg:h-10
        fixed
        z-40
        top-7
        right-4
        lg:right-5
        box-content
        py-1
        lg:py-2
        px-2
        lg:px-3
        rounded-none
        bg-opacity-75
        backdrop-filter backdrop-blur
        transition-colors
        duration-300
      "
      :class="menuIsOpen ? 'bg-gray-900 rotate-180' : 'bg-black'"
      type="button"
      data-cursor-hover
      @click="handleBurgerClick"
    >
      <div class="relative flex items-center justify-center">
        <div
          class="
            w-full
            h-1
            lg:h-1.5
            absolute
            right-0
            bg-white
            transition-transform
          "
          :class="
            menuIsOpen || searchIsOpen
              ? 'translate-y-0 -rotate-45'
              : '-translate-y-1.5 lg:-translate-y-2'
          "
        />
        <div
          class="
            w-full
            h-1
            lg:h-1.5
            absolute
            right-0
            bg-white
            transition-transform
          "
          :class="
            menuIsOpen || searchIsOpen
              ? 'translate-y-0 translate-x-0 scale-x-100 rotate-45'
              : 'translate-y-1.5 lg:translate-y-2 translate-x-3/20 md:group-hover:translate-x-0 scale-x-70 md:group-hover:scale-x-100'
          "
        />
      </div>
    </button>

    <!-- Navigation -->
    <nav
      class="
        w-full
        h-full
        fixed
        z-30
        top-0
        right-0
        bg-gray-900
        transition
        duration-300
        origin-right
      "
      :class="!menuIsOpen && 'invisible opacity-0 translate-x-20 scale-x-90'"
      :style="
        !menuIsOpen
          ? 'transition: visibility 0s .3s, opacity .3s, transform .3s'
          : undefined
      "
    >
      <div
        class="
          absolute
          lg:static
          top-24
          right-6
          flex flex-col
          items-end
          space-y-16
          lg:space-y-0
        "
      >
        <!-- Main menu -->
        <ul
          class="
            lg:absolute lg:top-36 lg:right-48
            flex flex-col
            lg:items-end
            space-y-4
            lg:space-y-0
          "
        >
          <li
            v-for="mainMenuItem in mainMenuItems"
            :key="mainMenuItem.href"
            class="text-right"
          >
            <NuxtLink
              class="
                block
                hover:text-lime
                text-7.5xl-screen
                lg:text-8.5xl-screen
                font-bold
                transition-transform
                hover:scale-x-105
                origin-right
              "
              :class="
                $nuxt.$route.path === mainMenuItem.href
                  ? 'text-lime'
                  : 'text-white'
              "
              data-cursor-hover
              :to="mainMenuItem.href"
            >
              {{ mainMenuItem.label }}
            </NuxtLink>
          </li>
        </ul>

        <!-- Social networks -->
        <SocialNetworks class="h-8 lg:absolute lg:bottom-8 lg:right-48" />
      </div>

      <!-- Sub menu -->
      <ul
        class="
          absolute
          bottom-6
          lg:bottom-8
          left-6
          lg:left-8
          flex
          space-x-6
          lg:space-x-8
        "
      >
        <li v-for="subMenuItem in subMenuItems" :key="subMenuItem.href">
          <NuxtLink
            class="
              text-white
              hover:text-lime hover:underline
              text-sm
              lg:text-xl
            "
            data-cursor-hover
            :to="subMenuItem.href"
          >
            {{ subMenuItem.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  nextTick,
  ref,
  useRoute,
  useRouter,
  watch,
} from '@nuxtjs/composition-api';
import { useEventListener, useDocument } from '../composables';
import SocialNetworks from './SocialNetworks.vue';

export default defineComponent({
  components: {
    SocialNetworks,
  },
  setup() {
    // Add route und router
    const route = useRoute();
    const router = useRouter();

    // Create menu and search is open reference
    const menuIsOpen = ref(false);
    const searchIsOpen = ref(false);

    // Create search input element reference
    const searchInputElement = ref<HTMLInputElement>();

    // Close menu after each route change
    router.afterEach(() => {
      setTimeout(() => {
        menuIsOpen.value = false;
      }, 50);
    });

    // Disable scrolling while menu is open
    watch(menuIsOpen, () => {
      document.body.style.overflow = menuIsOpen.value ? 'hidden' : '';
    });

    /**
     * It sets the initial value of the search
     * input element and opens the search form.
     */
    const setInitialSearch = () => {
      if (route.value.path === '/suche' && searchInputElement.value) {
        searchInputElement.value.value =
          (route.value.query.search as string) || '';
        searchIsOpen.value = true;
        nextTick(() => searchInputElement.value?.focus());
      }
    };

    // Set initial search state when component is mounted or path changes
    onMounted(setInitialSearch);
    router.afterEach(setInitialSearch);

    // Close and reset search if path does not change to /suche
    router.afterEach((to) => {
      if (to.path !== '/suche' && searchIsOpen.value) {
        searchIsOpen.value = false;
        if (searchInputElement.value?.value) {
          searchInputElement.value.value = '';
        }
      }
    });

    /**
     * It handles clicking on the burger button.
     */
    const handleBurgerClick = () => {
      if (searchIsOpen.value) {
        searchIsOpen.value = false;
        if (menuIsOpen.value) {
          menuIsOpen.value = false;
        }
      } else {
        menuIsOpen.value = !menuIsOpen.value;
      }
    };

    /**
     * It handles the search by open it or forwarding
     * or replacing the location.
     */
    const handleSearch = (event: Event) => {
      if (searchIsOpen.value) {
        const location = {
          path: '/suche',
          query: { search: searchInputElement.value?.value || '' },
        };
        if (event.type !== 'input' && location.query.search) {
          router.push(location);
        } else {
          router.replace(location);
        }
        if (menuIsOpen.value) {
          menuIsOpen.value = false;
        }
      } else {
        searchIsOpen.value = true;
        nextTick(() => searchInputElement.value?.focus());
      }
    };

    // Add input event listener to search input element
    useEventListener(searchInputElement, 'input', handleSearch);

    /**
     * It handles key down events.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // Get keys from event
      const { metaKey, shiftKey } = event;
      const key = event.key.toLowerCase();

      // Open search if closed and meta key and
      // "k" or shift key and "/" is pressed
      if (
        !searchIsOpen.value &&
        ((metaKey && key === 'k') || (shiftKey && key === '/'))
      ) {
        event.preventDefault();
        searchIsOpen.value = true;
        nextTick(() => searchInputElement.value?.focus());

        // Otherwise close it if search is open and
        // escape or meta key and "k" is pressed
      } else if (
        searchIsOpen.value &&
        (key === 'escape' || (metaKey && key === 'k'))
      ) {
        searchIsOpen.value = false;
      }
    };

    // Add key down event listener
    useEventListener(useDocument(), 'keydown', handleKeyDown);

    return {
      menuIsOpen,
      searchIsOpen,
      searchInputElement,
      handleBurgerClick,
      handleSearch,
      mainMenuItems: [
        { label: 'Home', href: '/' },
        { label: 'Podcast', href: '/podcast' },
        { label: 'Meetup', href: '/meetup' },
        { label: 'Hall of Fame', href: '/hall-of-fame' },
        { label: 'Pick of the Day', href: '/pick-of-the-day' },
        { label: 'Über uns', href: '/ueber-uns' },
      ],
      subMenuItems: [
        { label: 'Kontakt', href: '/kontakt' },
        { label: 'Impressum', href: '/impressum' },
        { label: 'Datenschutz', href: '/datenschutz' },
      ],
    };
  },
});
</script>
