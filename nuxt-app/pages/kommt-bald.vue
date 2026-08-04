<template>
    <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
        <Breadcrumbs :breadcrumbs="breadcrumbs" />

        <SectionHeading class="mt-8 md:mt-0" element="h1"> Kommt bald! </SectionHeading>

        <PrettyJSON :data="content" class="mt-6" />
    </div>
</template>

<script setup lang="ts">
import { getMetaInfo } from '../helpers'

const breadcrumbs = [{ label: 'Kommt bald!' }]

const content = {
    content: 'coming soon',
}

useHead(
    getMetaInfo({
        type: 'website',
        path: '/kommt-bald',
        title: 'Kommt bald!',
        noIndex: true,
    })
)
</script>
