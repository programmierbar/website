<template>
    <section class="flex w-full flex-col items-center overflow-x-hidden pt-20 md:pt-24 lg:pt-32">
        <div class="relative">
            <NuxtLink
                class="inline-block min-w-56 rounded-full border-4 border-lime px-10 pb-3 pt-4 text-center text-sm font-black uppercase tracking-widest text-lime transition-colors hover:bg-lime hover:text-black md:min-w-76 md:pb-4 md:pt-5 md:text-lg lg:min-w-88 lg:pb-5 lg:pt-6 lg:text-xl"
                to="/kontakt"
                data-cursor-hover
            >
                Feedback
            </NuxtLink>
            <div
                class="absolute -right-32 -top-20 -z-1 h-32 md:-right-44 md:-top-24 md:h-40 lg:-right-48 lg:-top-32 lg:h-48"
                v-html="feedbackFigure"
            />
        </div>
        <SocialNetworks class="mt-10 h-8 md:h-9 lg:h-10" />
    </section>
</template>

<script setup>
import feedbackFigure from '~/assets/images/feedback-figure.svg'
</script>
