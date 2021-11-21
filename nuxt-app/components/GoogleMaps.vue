<template>
  <div ref="mapElement"></div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from '@nuxtjs/composition-api';
import { Loader } from '@googlemaps/js-api-loader';

export default defineComponent({
  setup() {
    // Create map element reference
    const mapElement = ref<HTMLDivElement>();

    // Load map when component has mounted
    onMounted(async () => {
      if (mapElement.value) {
        const loader = new Loader({
          apiKey: process.env.NUXT_ENV_GOOGLE_API_KEY!,
        });
        const google = await loader.load();
        // eslint-disable-next-line no-new
        new google.maps.Map(mapElement.value, {
          center: {
            lat: 50.3668885,
            lng: 8.7497127,
          },
          mapId: '6539fad3cb291e05',
          zoom: 15,
        });
      }
    });

    return {
      mapElement,
    };
  },
});
</script>
