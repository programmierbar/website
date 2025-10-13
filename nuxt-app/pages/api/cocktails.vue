<template>
    <div v-if="imprintPage" class="relative">
        <div class="container px-6 pb-20 pt-32 md:pb-32 md:pl-48 md:pt-40 lg:pb-52 lg:pr-8 lg:pt-56 2xl:pt-64 3xl:px-8">
            <Breadcrumbs :breadcrumbs="breadcrumbs" />

          <vue-json-pretty class='mt-6' :data="cocktails" :theme="'dark'" :showLine='false' :showLineNumber='true'/>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDirectus } from '~/composables/useDirectus'
import { useLoadingScreen } from '../composables'
import { getMetaInfo } from '../helpers'
import VueJsonPretty from 'vue-json-pretty';

const directus = useDirectus()
const breadcrumbs = [{ label: 'API' }, { label: 'Cocktails' }]

// Query imprint page
const { data: imprintPage } = await useAsyncData(() => directus.getImprintPage())

const cocktails = {
  cocktails: [
    {
      name: 'Gin Tonic',
      ingredients: ['gin', 'tonic water', 'ice'],
      contains_alcohol: true,
      alcohol_free_variant_available: true,
    },
    {
      name: 'Ipanema',
      ingredients: ['ginger ale', 'juice', 'lime', 'brown sugar', 'ice'],
      contains_alcohol: false,
    },
    {
      name: 'Crodino Spritz',
      ingredients: ['crodino', 'orange', 'mint', 'ice'],
      contains_alcohol: false,
    },
  ],
}

// Set loading screen
useLoadingScreen(imprintPage)

// Set page meta data
useHead(
    getMetaInfo({
        type: 'website',
        path: '/api/cocktails',
        title: 'Cocktails',
        noIndex: true,
    })
)
</script>

<style>
.vjs-tree {
  padding: 0 !important;
  color: white;
}

.vjs-tree-node {
  font-size: 1.5rem;
  line-height: 1.5;
}
.vjs-key {
  color: white;
}

.vjs-tree-brackets {
  color: white;
}
</style>
