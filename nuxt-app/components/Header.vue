<template>
    <header :class="menuIsOpen && 'menu-is-open'">
        <!-- Logo -->
        <NuxtLink
            class="fixed left-0 top-5 z-60 bg-opacity-75 py-3 pl-6 pr-4 backdrop-blur backdrop-filter transition-colors duration-300 lg:pb-4 lg:pl-8 lg:pr-5 lg:pt-5"
            :class="menuIsOpen ? 'bg-gray-900' : 'bg-black'"
            to="/"
            data-cursor-hover
            @click="closeMenu"
        >
            <BrandIcon class="h-7 lg:hidden" alt="programmier.bar Icon" />
            <BrandLogo class="hidden h-8 lg:block" alt="programmier.bar Logo" />
        </NuxtLink>

        <!-- Search form -->
        <form
            class="fixed right-18 top-7 z-60 flex bg-opacity-75 backdrop-blur backdrop-filter transition-all duration-300 lg:right-24"
            :class="[searchIsOpen ? 'w-1/2 xs:w-60 md:w-80' : 'w-10 lg:w-14', menuIsOpen ? 'bg-gray-900' : 'bg-black']"
            @submit.prevent="handleSearch"
        >
            <input
                ref="searchInputElement"
                class="w-full appearance-none rounded-none border-b-2 border-white bg-transparent text-center text-lg font-light text-blue placeholder-blue-600 outline-none selection:bg-blue selection:text-black lg:text-2xl"
                :class="!searchIsOpen && 'invisible transition-all delay-300'"
                type="text"
                :placeholder="searchPlaceholder"
                spellcheck="false"
            />
            <button
                class="box-content h-7 w-6 flex-shrink-0 rounded-none px-2 py-1.5 text-white lg:h-9 lg:w-8 lg:px-3 lg:py-2.5"
                :type="searchIsOpen ? 'submit' : 'button'"
                data-cursor-hover
                @click.stop.prevent="handleSearch"
            >
                <SearchSVG class="h-full" />
            </button>
        </form>

        <!-- Burger icon -->
        <button
            class="group fixed right-4 top-7 z-60 box-content h-8 w-6 rounded-none bg-opacity-75 px-2 py-1 backdrop-blur backdrop-filter transition-colors duration-300 lg:right-5 lg:h-10 lg:w-8 lg:px-3 lg:py-2"
            :class="menuIsOpen ? 'rotate-180 bg-gray-900' : 'bg-black'"
            type="button"
            data-cursor-hover
            @click="handleBurgerClick"
        >
            <div class="relative flex items-center justify-center">
                <div
                    class="absolute right-0 h-1 w-full bg-white transition-transform lg:h-1.5"
                    :class="
                        menuIsOpen || searchIsOpen ? 'translate-y-0 -rotate-45' : '-translate-y-1.5 lg:-translate-y-2'
                    "
                />
                <div
                    class="absolute right-0 h-1 w-full bg-white transition-transform lg:h-1.5"
                    :class="
                        menuIsOpen || searchIsOpen
                            ? 'translate-x-0 translate-y-0 rotate-45 scale-x-100'
                            : 'translate-x-3/20 translate-y-1.5 scale-x-70 md:group-hover:translate-x-0 md:group-hover:scale-x-100 lg:translate-y-2'
                    "
                />
            </div>
        </button>

        <!-- Navigation -->
        <nav
            ref="menuElement"
            class="fixed right-0 top-0 z-50 max-h-screen min-h-screen w-screen origin-right overflow-y-auto overscroll-y-contain bg-gray-900 transition duration-300"
            :class="!menuIsOpen && 'invisible translate-x-20 scale-x-90 opacity-0'"
            :style="!menuIsOpen ? 'transition: visibility 0s .3s, opacity .3s, transform .3s' : undefined"
            tabindex="-1"
        >
            <div
                class="flex min-h-screen flex-col space-y-16 px-6 pb-8 pt-28 lg:pl-8 lg:pr-24 lg:pt-36 xl:pr-32 2xl:pr-48"
            >
                <!-- Main menu -->
                <ul class="flex flex-col space-y-4 lg:flex-grow lg:items-end lg:space-y-0">
                    <li
                        v-for="(mainMenuItem, index) in mainMenuItems"
                        :key="mainMenuItem.href"
                        class="main-menu-item text-right lg:flex"
                        :class="menuIsOpen && 'animate'"
                        :style="{
                            animationDuration: `${index * 20 + 300}ms`,
                            animationDelay: `${index * 50 + 200}ms`,
                        }"
                    >
                        <NuxtLink
                            class="block origin-right font-bold transition-transform hover:scale-x-105 hover:text-lime"
                            :class="route.path === mainMenuItem.href ? 'text-lime' : 'text-white'"
                            data-cursor-hover
                            :to="mainMenuItem.href"
                            @click="closeMenu"
                        >
                            {{ mainMenuItem.label }}
                        </NuxtLink>
                    </li>
                </ul>

                <div
                    class="flex flex-grow flex-col justify-between space-y-16 lg:flex-grow-0 lg:flex-row-reverse lg:items-end lg:space-y-0"
                >
                    <!-- Social networks -->
                    <SocialNetworks class="h-8 self-end" />

                    <!-- Sub menu -->
                    <ul class="flex items-end space-x-6 lg:space-x-8">
                        <li v-for="subMenuItem in subMenuItems" :key="subMenuItem.href">
                            <NuxtLink
                                class="flex text-sm text-white hover:text-lime hover:underline lg:text-xl"
                                style="line-height: 1"
                                data-cursor-hover
                                :to="subMenuItem.href"
                                @click="closeMenu"
                            >
                                {{ subMenuItem.label }}
                            </NuxtLink>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    </header>
</template>

<script setup lang="ts">
import SearchSVG from '~/assets/icons/search.svg'
import BrandIcon from '~/assets/images/brand-icon.svg'
import BrandLogo from '~/assets/images/brand-logo.svg'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useDocument, useEventListener } from '../composables'
import { CLOSE_MENU_EVENT_ID, CLOSE_SEARCH_EVENT_ID, OPEN_MENU_EVENT_ID, OPEN_SEARCH_EVENT_ID } from '../config'
import { trackGoal } from '../helpers'
import SocialNetworks from './SocialNetworks.vue'

const mainMenuItems = [
    { label: 'Home', href: '/' },
    { label: 'Podcast', href: '/podcast' },
    { label: 'Meetup', href: '/meetup' },
    { label: 'Hall of Fame', href: '/hall-of-fame' },
    { label: 'Pick of the Day', href: '/pick-of-the-day' },
    { label: 'Über uns', href: '/ueber-uns' },
]
const subMenuItems = [
    { label: 'Kontakt', href: '/kontakt' },
    { label: 'Impressum', href: '/impressum' },
    { label: 'Datenschutz', href: '/datenschutz' },
]

// Add route und router
const route = useRoute()
const router = useRouter()

// Create menu and search is open reference
const menuIsOpen = ref(false)
const searchIsOpen = ref(false)

// Create search placeholder reference
const searchPlaceholder = ref('')

// Create search input element reference
const searchInputElement = ref<HTMLInputElement>()
const menuElement = ref<HTMLElement>()

// Track analytic menu events
watch(menuIsOpen, () => {
    if (menuIsOpen.value) {
        trackGoal(OPEN_MENU_EVENT_ID)
    } else {
        trackGoal(CLOSE_MENU_EVENT_ID)
    }
})

// Track analytic search events
watch(searchIsOpen, () => {
    if (searchIsOpen.value) {
        trackGoal(OPEN_SEARCH_EVENT_ID)
    } else {
        trackGoal(CLOSE_SEARCH_EVENT_ID)
    }
})

// Set serach placeholder depending on device type and operating system
onMounted(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
        searchPlaceholder.value = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'
    }
})

/**
 * It closes the menu.
 */
const closeMenu = () => {
    // TODO: setTimeout() was added because on slow devices it causes the
    // menu to close only after the page below it has loaded. Probably the
    // reason is that the page change blocks the main thread and by
    // setTimeout() the menu is closed afterwards. nextTick() unfortunately
    // did not lead to the desired result.
    setTimeout(() => {
        menuIsOpen.value = false
    }, 100)
}

/**
 * It sets the initial value of the search
 * input element and opens the search form.
 */
const setInitialSearch = () => {
    if (route.path === '/suche' && searchInputElement.value) {
        searchInputElement.value.value = (route.query.search as string) || ''
        searchIsOpen.value = true
        nextTick(() => searchInputElement.value?.focus())
    }
}

// Set initial search state when component is mounted or path changes
onMounted(setInitialSearch)
router.afterEach(setInitialSearch)

// Close and reset search if path does not change to /suche
router.afterEach((to) => {
    if (to.path !== '/suche' && searchIsOpen.value) {
        searchIsOpen.value = false
        if (searchInputElement.value?.value) {
            searchInputElement.value.value = ''
        }
    }
})

/**
 * It handles clicking on the burger button.
 */
const handleBurgerClick = () => {
    if (searchIsOpen.value) {
        searchIsOpen.value = false
        if (menuIsOpen.value) {
            menuIsOpen.value = false
        }
    } else {
        menuIsOpen.value = !menuIsOpen.value
    }
}

/**
 * It handles the search by open it or forwarding
 * or replacing the location.
 */
const handleSearch = (event: Event) => {
    if (searchIsOpen.value) {
        const location = {
            path: '/suche',
            query: { search: searchInputElement.value?.value || '' },
        }
        navigateTo(location)
        if (menuIsOpen.value) {
            menuIsOpen.value = false
        }
    } else {
        searchIsOpen.value = true
        nextTick(() => searchInputElement.value?.focus())
    }
}

// Add input event listener to search input element
useEventListener(searchInputElement, 'input', handleSearch)

/**
 * It handles key down events.
 */
const handleKeyDown = (event: KeyboardEvent) => {
    // Get keys and target from event
    const { metaKey, target } = event
    const key = event.key.toLowerCase()

    // Check if target is an input element
    const targetIsInput =
        target instanceof HTMLElement && (target.nodeName === 'TEXTAREA' || target.nodeName === 'INPUT')

    // Open menu if closed, "m" is pressed
    // and target is not an input element
    if (!menuIsOpen.value && key === 'm' && !targetIsInput) {
        menuIsOpen.value = true
        nextTick(() => menuElement.value?.focus())

        // Otherwise close it if menu is open and escape or "m"
        // is pressed, while target ist not an input element
    } else if (menuIsOpen.value && (key === 'escape' || (key === 'm' && !targetIsInput))) {
        menuIsOpen.value = false
    }

    // Open search if closed and meta key and "k" or "/"
    // key is pressed and target is not an input element
    if (!searchIsOpen.value && ((metaKey && key === 'k') || (key === '/' && !targetIsInput))) {
        event.preventDefault()
        searchIsOpen.value = true
        nextTick(() => searchInputElement.value?.focus())

        // Otherwise close it if search is open and
        // escape or meta key and "k" is pressed
    } else if (searchIsOpen.value && (key === 'escape' || (metaKey && key === 'k'))) {
        searchIsOpen.value = false
    }
}

// Add key down event listener
useEventListener(useDocument(), 'keydown', handleKeyDown)
</script>

<style scoped>
.main-menu-item a {
    font-size: max(4.5vh, 1.75rem);
}
@media (min-width: 1024px) {
    .main-menu-item a {
        font-size: max(6vh, 3rem);
    }
}
@media (min-width: 1536px) {
    .main-menu-item a {
        font-size: max(7vh, 4rem);
    }
}
@keyframes fade-in {
    from {
        opacity: 0;
        transform: translateY(40px);
    }
}
.main-menu-item.animate {
    animation: fade-in ease both;
}
</style>
