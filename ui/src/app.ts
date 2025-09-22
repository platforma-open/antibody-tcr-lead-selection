import { convertFilterUI, convertRankingOrderUI, model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import debounce from 'lodash.debounce';
import { toRaw, watch } from 'vue';
import AffinityPage from './pages/AffinityPage.vue';
import MainPage from './pages/MainPage.vue';
import SpectratypePage from './pages/SpectratypePage.vue';
import UmapPage from './pages/UmapPage.vue';
import UsagePage from './pages/UsagePage.vue';

export const sdkPlugin = defineApp(model, (app) => {
  watch(
    () => app.model.ui.rankingOrder,
    debounce((value) => {
      app.updateArgs((args) => {
        args.rankingOrder = convertRankingOrderUI(toRaw(value ?? []));
      });
    }, 500),
    { immediate: true, deep: true },
  );

  watch(
    () => app.model.ui.filters,
    debounce((value) => {
      app.updateArgs((args) => {
        args.filters = convertFilterUI(toRaw(value ?? []));
      });
    }, 500),
    { immediate: true, deep: true },
  );

  return {
    progress: () => app.model.outputs.calculating,
    routes: {
      '/': () => MainPage,
      '/umap': () => UmapPage,
      '/spectratype': () => SpectratypePage,
      '/usage': () => UsagePage,
      '/affinity': () => AffinityPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
