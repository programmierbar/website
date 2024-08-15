<script setup lang='ts'>
import EmptyProfilePicture from '~/assets/images/profile-picture-empty.svg';
import { ref } from 'vue';
import type { DirectusFileItem } from '~/types';

type CallbackFunction = (file: File, previewUrl: string) => void;

const props = defineProps<{
  editable: boolean,
  image?: DirectusFileItem,
  handler?: CallbackFunction,
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const updatedImagePath = ref<string | null>(null);

const handleFileSelection = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    const previewUrl = URL.createObjectURL(file);
    updatedImagePath.value = previewUrl;
    if (props.handler) {
      props.handler(file, previewUrl);
    }
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};
</script>

<template>
  <div class='flex flex-col items-center justify-center'>
    <div
      class='profile-picture flex flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-t from-white/20 to-white/80 '
    >
      <DirectusImage
        v-if='image && !updatedImagePath'
        :image='image'
        :sizes='""'
        class='h-full w-full rounded-full object-cover'
      />
      <img
        v-if='updatedImagePath'
        :src='updatedImagePath'
        alt='Profile Picture'
        class='h-full w-full rounded-full object-cover'
      />
      <EmptyProfilePicture v-if='!updatedImagePath && !image' class='h-full w-full' />
    </div>
    <input ref='fileInput' type='file' accept='image/*' class='hidden' @change='handleFileSelection' v-if='editable' />
    <PrimaryPbButton
      class='mt-5 w-44 border-[1.4px] text-base font-light italic tracking-normal md:w-72 md:py-2 md:text-2xl md:tracking-wide'
      @click='triggerFileInput'
      v-if='editable'
    >
      Profilbild hochladen
    </PrimaryPbButton>
  </div>
</template>
