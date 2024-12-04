<script setup lang='ts'>
import { type ComputedRef, ref } from 'vue';
import type { DirectusFileItem } from '~/types';

const emit = defineEmits<{
  (e: 'updatedProfilePicture', file: File, previewUrl: string): void
}>()

const props = defineProps<{
  image?: DirectusFileItem | null,
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const updatedImagePath = ref<string | null>(null);

const currentImage: ComputedRef<DirectusFileItem | string | null> = computed(() => {
  if (updatedImagePath.value) {
    return updatedImagePath.value
  }

  if (props.image) {
    return props.image
  }

  return null;
})

const handleFileSelection = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    const previewUrl = URL.createObjectURL(file);
    updatedImagePath.value = previewUrl;
    emit('updatedProfilePicture', file, previewUrl);
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
      <ProfilePicture :image='currentImage' />
    </div>
    <input ref='fileInput' type='file' accept='image/*' class='hidden' @change='handleFileSelection'/>
    <PrimaryPbButton
      class='mt-5 w-44 border-[1.4px] text-base font-light italic tracking-normal md:w-72 md:py-2 md:text-2xl md:tracking-wide'
      @click='triggerFileInput'
    >
      Profilbild hochladen
    </PrimaryPbButton>
  </div>
</template>
