import { reactive, ref, watch } from '@nuxtjs/composition-api';
import { useNavigator } from './useNavigator';

/**
 * Composables for secure use of the share API.
 *
 * @returns A reference to the share API.
 */
export function useShare() {
  const navigator = useNavigator();
  const isSupported = ref(false);

  watch(navigator, () => {
    isSupported.value = !!navigator.value?.share;
  });

  const share = (data: ShareData) => {
    navigator.value?.share(data);
  };

  return reactive({
    isSupported,
    share,
  });
}
