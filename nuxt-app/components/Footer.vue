<template>
    <footer class="space-y-6 bg-gray-900 px-6 py-12 lg:flex lg:space-x-8 lg:space-y-0 lg:px-8 lg:pt-24">
        <!-- Logo -->
        <div class="lg:w-1/4">
            <NuxtLink class="inline-block" to="/" data-cursor-hover>
                <BrandLogo class="h-6 lg:h-8" alt="programmier.bar Logo" />
            </NuxtLink>
        </div>

        <div class="space-y-6 lg:w-3/4 lg:space-y-10">
            <nav class="lg:space-y-10">
                <!-- Main menu -->
                <ul class="hidden gap-x-8 gap-y-2 lg:flex lg:flex-wrap xl:gap-x-8">
                    <li v-for="mainMenuItem in mainMenuItems" :key="mainMenuItem.href">
                        <NuxtLink
                            class="whitespace-nowrap text-xl font-black text-white hover:text-lime xl:text-2xl"
                            data-cursor-hover
                            :to="mainMenuItem.href"
                        >
                            {{ mainMenuItem.label }}
                        </NuxtLink>
                    </li>
                </ul>

                <div class="flex flex-col-reverse lg:flex-row lg:items-baseline lg:justify-between">
                    <!-- Sub menu -->
                    <div class="mt-6 grid grid-cols-2 place-items-center md:grid-cols-4 lg:mt-0">
                        <NuxtLink
                            v-for="subMenuItem in subMenuItems"
                            :key="subMenuItem.href"
                            class="text-sm text-white hover:text-lime hover:underline lg:text-xl"
                            data-cursor-hover
                            :to="subMenuItem.href"
                        >
                            {{ subMenuItem.label }}
                        </NuxtLink>
                    </div>

                    <!-- Social networks -->
                    <SocialNetworks class="h-8" />
                </div>
            </nav>

            <!-- Divider -->
            <hr class="border-white" />

            <!-- Copyright -->
            <div class="text-sm font-light italic text-white lg:text-xl">&copy; {{ fullYear }} Lotum media GmbH</div>
        </div>
    </footer>
</template>

<script setup lang="ts">
import BrandLogo from '~/assets/images/brand-logo.svg'
import SocialNetworks from './SocialNetworks.vue'

const mainMenuItems = [
    { label: 'Home', href: '/' },
    { label: 'Podcast', href: '/podcast' },
    { label: 'Meetup', href: '/meetup' },
    { label: 'Konferenzen', href: '/konferenzen' },
    { label: 'Hall of Fame', href: '/hall-of-fame' },
    { label: 'Pick of the Day', href: '/pick-of-the-day' },
    { label: 'Über uns', href: '/ueber-uns' },
]
const subMenuItems = [
    { label: 'Verhaltensregeln', href: '/verhaltensregeln' },
    { label: 'Kontakt', href: '/kontakt' },
    { label: 'Datenschutz', href: '/datenschutz' },
    { label: 'Impressum', href: '/impressum' },
]
const fullYear = new Date().getFullYear()
</script>
