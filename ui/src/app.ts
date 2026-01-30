import { convertFilterUI, convertRankingOrderUI, getDefaultBlockLabel, model } from '@platforma-open/milaboratories.top-antibodies.model';
import { plRefsEqual } from '@platforma-sdk/model';
import { defineApp } from '@platforma-sdk/ui-vue';
import debounce from 'lodash.debounce';
import { watch, watchEffect } from 'vue';
import MainPage from './pages/MainPage.vue';
import SpectratypePage from './pages/SpectratypePage.vue';
import UmapPage from './pages/UmapPage.vue';
import UsagePage from './pages/UsagePage.vue';

export const sdkPlugin = defineApp(model, (app) => {
  app.model.args.customBlockLabel ??= '';

  syncDefaultBlockLabel(app.model);

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

type AppModel = ReturnType<typeof useApp>['model'];

function syncDefaultBlockLabel(model: AppModel) {
  watchEffect(() => {
    const datasetLabel = model.args.inputAnchor
      ? model.outputs.inputOptions
        ?.find((option) => plRefsEqual(option.ref, model.args.inputAnchor!))
        ?.label
      : undefined;

    model.args.defaultBlockLabel = getDefaultBlockLabel({
      datasetLabel,
    });
  });
}
