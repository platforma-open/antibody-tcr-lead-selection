import { model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import { ref } from 'vue';

export const sdkPlugin = defineApp(model, () => {
  const multiAlignmentOpen = ref(false);

  const openMultiAlignment = () => {
    multiAlignmentOpen.value = true;
  };

  return {
    routes: {
      '/': () => MainPage,
    },
    multiAlignmentOpen,
    openMultiAlignment,
  };
});

export const useApp = sdkPlugin.useApp;
