import { model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import umapPage from './pages/umapPage.vue';
import spectraPage from './pages/spectraPage.vue';
import usagePage from './pages/usagePage.vue';
import { ref } from 'vue';

export const sdkPlugin = defineApp(model, () => {
  const multiAlignmentOpen = ref(false);

  const openMultiAlignment = () => {
    multiAlignmentOpen.value = true;
  };

  const labelsToRecords = ref<[string, string][] | undefined>(undefined);

  return {
    routes: {
      '/': () => MainPage,
      '/umap': () => umapPage,
      '/spectratype': () => spectraPage,
      '/usage': () => usagePage,
    },
    multiAlignmentOpen,
    openMultiAlignment,
    labelsToRecords,
  };
});

export const useApp = sdkPlugin.useApp;
