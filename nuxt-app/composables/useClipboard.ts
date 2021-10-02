import { reactive, ref, watch } from '@nuxtjs/composition-api';
import { useNavigator } from './useNavigator';

/**
 * Composable for secure use of the share API.
 *
 * @returns A reference to the share API.
 */
export function useClipboard() {
  const navigator = useNavigator();
  const isSupported = ref(false);
  const copied = ref(false);

  watch(navigator, () => {
    isSupported.value = !!navigator.value?.clipboard;
  });

  const copy = (data: string) => {
    navigator.value?.clipboard.writeText(data).then(() => {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 1500);
    });
  };

  return reactive({
    isSupported,
    copied,
    copy,
  });
}
