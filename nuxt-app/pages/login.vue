<template>
    <div v-if="loginPage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ loginPage.heading }}
            </SectionHeading>

            <!-- Text -->
            <InnerHtml
                class="mt-8 space-y-8 break-words text-base font-light text-white md:mt-16 md:text-xl md:leading-normal lg:text-2xl lg:leading-normal"
                :html="loginPage.text"
            />
            <ul class="text-white">
                <li v-for="provider in providers" :key="provider.name">
                    <a :href="provider.url">{{ provider.name }}</a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useDirectusLogin } from '~/composables/useDirectusLogin'
import type { DirectusLoginPage, LoginProvider } from '~/types'
import { computed, type ComputedRef } from 'vue'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()
const directusLogin = useDirectusLogin()
const breadcrumbs = [{ label: 'Login' }]

// Query login page and settings
const { data: pageData } = useAsyncData(async () => {
    const [loginPage, providers] = await Promise.all([
        await directus.getLoginPage(),
        await directusLogin.getProviders(),
    ])

    console.log(loginPage)
    console.log(providers)

    return { loginPage, providers }
})

const loginPage: ComputedRef<DirectusLoginPage | undefined> = computed(() => pageData.value?.loginPage)
const providers: ComputedRef<LoginProvider[] | undefined> = computed(() => pageData.value?.providers)

// Set loading screen
useLoadingScreen()

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/login',
        title: 'Login',
        noIndex: true,
    })
)
</script>
