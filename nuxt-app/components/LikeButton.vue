<template>
    <div class="flex items-center space-x-2 lg:space-x-3">
        <!-- TODO: Increase likes on click -->
        <button
            class="text-pink"
            :class="variant === 'pick_of_the_day_card' ? 'h-5 xs:h-6 md:h-7 xl:h-8' : 'h-6 md:h-8 lg:h-10'"
            type="button"
            data-cursor-hover
            v-html="heartIcon"
        />
        <div
            class="mt-1 font-black text-pink md:text-lg"
            :class="variant === 'pick_of_the_day_card' ? 'text-sm xs:text-base xl:text-xl' : 'text-base lg:text-2xl'"
        >
            <!-- TODO: Make counter dynamic via props -->
            200
        </div>
    </div>
</template>

<script setup lang="ts">
import heartIcon from '~/assets/icons/heart.svg?raw'

const { variant } =
    toRefs(
        defineProps<{
            variant: 'default' | 'pick_of_the_day_card'
        }>()
    )
</script>
