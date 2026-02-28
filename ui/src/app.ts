import { getDefaultBlockLabel, platforma } from '@platforma-open/milaboratories.top-antibodies.model';
import { plRefsEqual } from '@platforma-sdk/model';
import { defineAppV3 } from '@platforma-sdk/ui-vue';
import { watchEffect } from 'vue';
import MainPage from './pages/MainPage.vue';
import SpectratypePage from './pages/SpectratypePage.vue';
import UmapPage from './pages/UmapPage.vue';
import UsagePage from './pages/UsagePage.vue';

export const sdkPlugin = defineAppV3(platforma, (app) => {
  app.model.data.customBlockLabel ??= '';

  syncDefaultBlockLabel(app.model);

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
    const datasetLabel = model.data.inputAnchor
      ? model.outputs.inputOptions
        ?.find((option) => plRefsEqual(option.ref, model.data.inputAnchor!))
        ?.label
      : undefined;

    model.data.defaultBlockLabel = getDefaultBlockLabel({
      datasetLabel,
    });
  });
}
