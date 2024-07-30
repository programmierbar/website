<template>
    <div v-if="loginPage" class="relative">
        <div class="container px-6 pb-20 pt-24 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <div v-if="shouldShowLoginOptions" class="flex-col items-center justify-center md:flex">
                <div class="mb-2 mt-5 text-2xl font-semibold italic text-white md:text-4xl">
                    {{ loginPage.heading }}
                </div>
                <BrandLogoIcon class="h-8 md:h-8 lg:h-16" />
            </div>

            <div v-if="shouldShowLoginOptions" class="mt-10 flex flex-col items-center justify-center gap-y-2">
                <SsoLoginOption
                    v-for="provider in providers"
                    :key="provider.name"
                    class="w-full max-w-md"
                    :provider="provider.name"
                >
                    <a :href="provider.url"
                        >Mit <span class="capitalize">{{ provider.name }}</span> anmelden</a
                    >
                </SsoLoginOption>
                <EmailLoginOption class="w-full max-w-md" @register-user="createUser" />
                <!-- Text -->
                <InnerHtml
                    class="mt-6 space-y-8 break-words text-base font-semibold italic text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                    :html="loginPage.text"
                />
            </div>

            <Transition name="fade">
                <div
                    v-if="shouldShowEmailConfirmation"
                    class="mt-5 md:flex md:flex-col md:items-center md:justify-center"
                >
                    <span class="mb-2 mt-5 text-3xl font-semibold italic text-white md:text-4xl"
                        >Check deine Mails!</span
                    >
                    <div class="flex justify-center">
                        <CheersIcon />
                    </div>
                </div>
            </Transition>
            <Transition name="fade">
                <div v-if="shouldShowErrorScreen" class="mt-5 md:flex md:flex-col md:items-center md:justify-center">
                    <span class="mb-2 mt-5 text-3xl font-semibold italic text-white md:text-4xl"
                        >Etwas ist schief gelaufen! ;-(</span
                    >
                    <div class="flex justify-center">
                        <SearchFigure class="mt-10" />
                    </div>
                </div>
            </Transition>
        </div>
    </div>
</template>

<script setup lang="ts">
import EmailLoginOption from '~/components/EmailLoginOption.vue'
import SsoLoginOption from '~/components/SsoLoginOption.vue'
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusLoginPage, LoginProvider } from '~/types'
import BrandLogoIcon from 'assets/images/brand-logo.svg'
import CheersIcon from 'assets/images/cheers-icon.svg'
import SearchFigure from 'assets/images/search-figure.svg'
import { computed, type ComputedRef } from 'vue'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()
const breadcrumbs = [{ label: 'Login' }]

// Query login page
// We tie the login to this page, so that we can easily en/disable logging in via the UI.
const { data: pageData } = useAsyncData(async () => {
    const [loginPage, providers] = await Promise.all([
        await directus.getLoginPage(),
        await directus.getSingleSignOnProviders(),
    ])

    return { loginPage, providers }
})

const loginPage: ComputedRef<DirectusLoginPage | undefined> = computed(() => pageData.value?.loginPage)
const providers: ComputedRef<LoginProvider[] | undefined> = computed(() => pageData.value?.providers)

// Set loading screen
useLoadingScreen(loginPage, providers)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/login',
        title: 'Login',
        noIndex: true,
    })
)

const shouldShowEmailConfirmation = ref(false)
const shouldShowErrorScreen = ref(false)
const shouldShowLoginOptions = computed(() => !shouldShowEmailConfirmation.value && !shouldShowErrorScreen.value)

async function createUser(user: { email: string; password: string }) {
    const error = await directus.registerNewUser(user.email, user.password)
    if (!error) {
        shouldShowEmailConfirmation.value = true
    } else {
        shouldShowErrorScreen.value = true
    }
}
</script>

<style lang="postcss" scoped>
.fade-enter-active {
    transition: opacity 1s ease-out;
}
.fade-enter-from {
    opacity: 0;
}
</style>
