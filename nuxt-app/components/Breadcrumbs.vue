<template>
    <div>
        <ul class="-m-0.5 flex flex-wrap text-sm font-black uppercase text-pink lg:text-lg">
            <li v-for="breadcrumb of breadcrumbs" :key="breadcrumb.label" class="m-0.5 max-w-1/2-screen truncate">
                //
                <NuxtLink
                    v-if="breadcrumb.href"
                    :to="breadcrumb.href"
                    class="border-pink hover:border-b-3"
                    data-cursor-hover
                >
                    {{ breadcrumb.label }}
                </NuxtLink>
                <span v-else>{{ breadcrumb.label }} </span>
            </li>
        </ul>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'

export default defineComponent({
    props: {
        breadcrumbs: {
            type: Array as PropType<
                {
                    label: string
                    href?: string
                }[]
            >,
            required: true,
        },
    },
})
</script>
