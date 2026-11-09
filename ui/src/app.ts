import { getInputAnchorRef, platforma } from "@platforma-open/milaboratories.top-antibodies.model";
import { plRefsEqual } from "@platforma-sdk/model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { computed, watch } from "vue";
import MainPage from "./pages/MainPage.vue";
import SelectionPage from "./pages/SelectionPage.vue";
import SpectratypePage from "./pages/SpectratypePage.vue";
import UmapPage from "./pages/UmapPage.vue";
import UsagePage from "./pages/UsagePage.vue";

export const sdkPlugin = defineAppV3(platforma, (app) => {
  app.model.data.customBlockLabel ??= "";

  syncSubtitleLabel(app.model);

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

type AppModel = ReturnType<typeof useApp>["model"];

function syncSubtitleLabel(model: AppModel) {
  // The input dataset's label. "" when no dataset is picked; undefined while the picked dataset
  // is not among the options yet.
  const subtitleLabel = computed<string | undefined>(() => {
    const anchorRef = getInputAnchorRef(model.data);
    if (!anchorRef) return "";
    return model.outputs.datasetOptions?.find((option) =>
      plRefsEqual(option.primary.ref, anchorRef),
    )?.primary.label;
  });

  watch(
    subtitleLabel,
    (label) => {
      if (label !== undefined && label !== model.data.subtitleLabel)
        model.data.subtitleLabel = label;
    },
    { immediate: true },
  );
}
