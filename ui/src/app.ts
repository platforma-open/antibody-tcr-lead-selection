import { model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './pages/MainPage.vue';
import SpectratypePage from './pages/SpectratypePage.vue';
import UmapPage from './pages/UmapPage.vue';
import UsagePage from './pages/UsagePage.vue';

export const sdkPlugin = defineApp(model, () => {
  return {
    routes: {
      '/': () => MainPage,
      '/umap': () => UmapPage,
      '/spectratype': () => SpectratypePage,
      '/usage': () => UsagePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
