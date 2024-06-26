<template>
    <div v-if="loginPage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

            <!-- Heading -->
            <SectionHeading class="mt-8 md:mt-0" element="h1">
                {{ loginPage.heading }}
            </SectionHeading>

            <client-only v-if="clientSideUser">
                <p class="text-white">Hello, User# {{ clientSideUser.id }}</p>
            </client-only>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import type { DirectusLoginPage } from '~/types'
import { computed, type ComputedRef } from 'vue'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'

const directus = useDirectus()
const breadcrumbs = [{ label: 'Login' }]

const clientSideUser = ref(null)

// Query login page
// We tie the login to this page, so that we can easily en/disable logging in via the UI.
const { data: pageData } = useAsyncData(async () => {
    const [loginPage] = await Promise.all([await directus.getLoginPage()])

    return { loginPage }
})

const loginPage: ComputedRef<DirectusLoginPage | undefined> = computed(() => pageData.value?.loginPage)
//const currentUser: ComputedRef<any | undefined> = computed(() => pageData.value?.user)

onMounted(async () => {
    clientSideUser.value = await directus.getCurrentUser()

    console.log('User', clientSideUser.value)
})

// Set loading screen
useLoadingScreen()

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/login-callback',
        title: 'Login Callback',
        noIndex: true,
    })
)
</script>
