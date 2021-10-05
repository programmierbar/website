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
      "
      :class="menuIsOpen ? 'bg-gray-900' : 'bg-black'"
      to="/"
      data-cursor-hover
    >
      <div @click="closeMenu">
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
      </div>
    </NuxtLink>

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
        top-6
        lg:top-7
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
      "
      :class="menuIsOpen ? 'bg-gray-900 rotate-180' : 'bg-black'"
      data-cursor-hover
      @click="toogleMenu"
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
            menuIsOpen
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
            menuIsOpen
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
        transition-all
        duration-300
      "
      :class="
        menuIsOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
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
            @click="closeMenu"
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
        <li
          v-for="subMenuItem in subMenuItems"
          :key="subMenuItem.href"
          @click="closeMenu"
        >
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
import { defineComponent, ref, watch } from '@nuxtjs/composition-api';
import SocialNetworks from './SocialNetworks.vue';

export default defineComponent({
  components: {
    SocialNetworks,
  },
  setup() {
    // Create menu is open reference
    const menuIsOpen = ref(false);

    // Disable scrolling while menu is open
    watch(menuIsOpen, () => {
      document.body.style.overflow = menuIsOpen.value ? 'hidden' : '';
    });

    /**
     * It opens or closes the menu.
     */
    const toogleMenu = () => {
      menuIsOpen.value = !menuIsOpen.value;
    };

    /**
     * It closes the menu.
     */
    const closeMenu = () => {
      menuIsOpen.value = false;
    };

    return {
      menuIsOpen,
      toogleMenu,
      closeMenu,
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
