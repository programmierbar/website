<template>
    <div>
        <template v-if="cover">
            <DirectusImage
                class="w-full outline outline-1 -outline-offset-1 outline-lime/40"
                :image="cover"
                alt="Cover für heise.de"
                sizes="xs:100vw md:50vw lg:40vw"
                fit="inside"
            />
            <!-- Directus answers `?download` with the original file as an attachment -->
            <a
                class="mt-6 inline-flex items-center gap-3 rounded-full border-3 border-lime px-6 py-2 text-sm font-black uppercase tracking-widest text-lime transition-colors hover:bg-lime hover:text-black md:border-4 md:text-base"
                :href="downloadUrl"
                download
                data-cursor-hover
            >
                <DownloadIcon class="h-4 md:h-5" />
                Cover herunterladen
            </a>
            <p v-if="dimensions" class="mt-3 text-sm font-light text-white/70">Original: {{ dimensions }}</p>
        </template>
        <HeiseMissingValue v-else>Noch kein Cover hinterlegt.</HeiseMissingValue>
    </div>
</template>

<script setup lang="ts">
import DownloadIcon from '~/assets/icons/download.svg'
import { getAssetUrl } from '~/helpers/getAssetUrl'
import type { FileItem } from '~/types'
import { computed } from 'vue'

const props = defineProps<{
    cover: FileItem | null
}>()

const downloadUrl = computed(() => getAssetUrl(props.cover, { queryParams: { download: true } }))

const dimensions = computed(() =>
    props.cover?.width && props.cover.height ? `${props.cover.width} × ${props.cover.height} px` : null
)
</script>
