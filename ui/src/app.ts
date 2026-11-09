import { platforma } from "@platforma-open/milaboratories.top-antibodies.model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import MainPage from "./pages/MainPage.vue";
import SelectionPage from "./pages/SelectionPage.vue";
import SpectratypePage from "./pages/SpectratypePage.vue";
import UmapPage from "./pages/UmapPage.vue";
import UsagePage from "./pages/UsagePage.vue";

export const sdkPlugin = defineAppV3(platforma, (app) => {
  app.model.data.customBlockLabel ??= "";

  return {
    progress: () => app.model.outputs.calculating,
    routes: {
      "/": () => MainPage,
      "/umap": () => UmapPage,
      "/spectratype": () => SpectratypePage,
      "/usage": () => UsagePage,
      "/selection": () => SelectionPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
