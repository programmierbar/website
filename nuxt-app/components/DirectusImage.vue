<template>
    <nuxt-img
        :src="url"
        :alt="image.title || alt"
        :width="image.width ?? 0"
        :height="image.height ?? 0"
        :sizes="sizes"
        :loading="loading"
        :format="format"
        quality="80"
        :fit="fit"
    />
</template>

<script lang="ts">
import { getAssetUrl } from '~/helpers/getAssetUrl'
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import type { FileItem } from '../types'

export default defineComponent({
    props: {
        image: {
            type: Object as PropType<FileItem>,
            required: true,
        },
        sizes: {
            type: String,
            required: true,
        },
        alt: {
            type: String,
            default: '',
        },
        loading: {
            type: String as PropType<'lazy' | 'auto'>,
            default: undefined,
        },
        fit: {
            type: String as PropType<'cover' | 'contain' | 'inside' | 'outside' | 'fill'>,
            default: 'cover',
        },
    },
    setup(props) {
        // Create image format
        const format = computed(() => props.image.type.split('/')[1])
        const url = computed(() => getAssetUrl(props.image))

        return {
            format,
            url,
        }
    },
})
</script>
