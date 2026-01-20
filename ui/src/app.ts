import { convertFilterUI, convertRankingOrderUI, model } from '@platforma-open/milaboratories.top-antibodies.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import debounce from 'lodash.debounce';
import { watch } from 'vue';
import MainPage from './pages/MainPage.vue';
import SpectratypePage from './pages/SpectratypePage.vue';
import UmapPage from './pages/UmapPage.vue';
import UsagePage from './pages/UsagePage.vue';

export const sdkPlugin = defineApp(model, (app) => {
  watch(
    () => app.model.ui.rankingOrder,
    debounce((value) => {
      app.model.args.rankingOrder = convertRankingOrderUI(value ?? []);
    }, 250),
    { immediate: true, deep: true },
  );

  watch(
    () => app.model.ui.filters,
    debounce((value) => {
      app.model.args.filters = convertFilterUI(value ?? []);
    }, 250),
    { immediate: true, deep: true },
  );

  return {
    progress: () => app.model.outputs.calculating,
    routes: {
      '/': () => MainPage,
      '/umap': () => UmapPage,
      '/spectratype': () => SpectratypePage,
      '/usage': () => UsagePage,
    },
  };
});

export const useApp = sdkPlugin.useApp;

// Make sure labels are initialized
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  const app = useApp();
  app.model.args.customBlockLabel ??= '';
  app.model.args.defaultBlockLabel ??= 'Select dataset';
  unwatch();
});
