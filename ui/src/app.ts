import { model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import spectraPage from './pages/spectraPage.vue';
import umapPage from './pages/umapPage.vue';
import usagePage from './pages/usagePage.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    routes: {
      '/': () => MainPage,
      '/umap': () => umapPage,
      '/spectratype': () => spectraPage,
      '/usage': () => usagePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
