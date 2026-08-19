import {
  createDatasetSelection,
  createPlDataTableStateV2,
  createPrimaryRef,
  DataModelBuilder,
  type PObjectId,
} from "@platforma-sdk/model";
import { kind } from "@platforma-open/milaboratories.top-antibodies.kind";
import type {
  BlockData,
  BlockData_Ver_2026_02_25,
  BlockData_Ver_2026_05_08,
  BlockData_Ver_2026_05_21,
  LegacyBlockArgs,
  LegacyUiState,
} from "./types";
import { getDefaultBlockLabel } from "./util";

const defaultSelectionPlotState = (): BlockData["selectionPlotState"] => ({
  title: "Selection Plot",
  template: "selection",
  currentTab: null,
});

/**
 * Sentinel column id of the block's former built-in "In Vivo Score" ranking
 * option.
 */
const REMOVED_IN_VIVO_SCORE_COLUMN_ID = "pl7.app/vdj/inVivoScore" as PObjectId;

export const blockDataModel = new DataModelBuilder({ kind })
  .from<BlockData_Ver_2026_02_25>("Ver_2026_02_25")
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    defaultBlockLabel: args.defaultBlockLabel,
    customBlockLabel: args.customBlockLabel,
    inputAnchor: args.inputAnchor,
    topClonotypes: args.topClonotypes,
    kabatNumbering: args.kabatNumbering,
    diversificationColumn: args.diversificationColumn,
    rankingOrder: uiState?.rankingOrder ?? [],
    filters: uiState?.filters ?? [],
    tableState: uiState?.tableState ?? createPlDataTableStateV2(),
    graphStateUMAP: uiState?.graphStateUMAP ?? {
      title: "Sequence Space UMAP",
      template: "dots",
      currentTab: null,
      layersSettings: { dots: { dotFill: "#5d32c6" } },
    },
    cdr3StackedBarPlotState: uiState?.cdr3StackedBarPlotState ?? {
      title: "CDR3 V Spectratype",
      template: "stackedBar",
      currentTab: null,
    },
    vjUsagePlotState: uiState?.vjUsagePlotState ?? {
      title: "V/J Usage",
      template: "heatmap",
      currentTab: null,
      layersSettings: { heatmap: { normalizationDirection: null } },
    },
    alignmentModel: uiState?.alignmentModel ?? {},
    filtersInitializedForAnchor: uiState?.filtersInitializedForAnchor,
    rankingsInitializedForAnchor: uiState?.rankingsInitializedForAnchor,
    preset: uiState?.preset,
  }))
  .migrate<BlockData_Ver_2026_05_08>("Ver_2026_05_08", (prev) => ({
    ...prev,
    selectionPlotState: defaultSelectionPlotState(),
  }))
  .migrate<BlockData_Ver_2026_05_21>("Ver_2026_05_21", (prev) => {
    const { inputAnchor, ...rest } = prev;
    return {
      ...rest,
      input:
        inputAnchor !== undefined
          ? createDatasetSelection(createPrimaryRef(inputAnchor))
          : undefined,
    };
  })
  // The built-in "In Vivo Score" is gone — the Repertoire Score block produces
  // the score now. Stored ranking entries still hold its sentinel id, which no
  // longer matches any ranking option (red "Rank by" dropdown) and resolves to
  // nothing when the workflow builds its column bundle. Drop those entries and
  // flag the one-time notice, but only for projects that actually used it.
  .migrate<BlockData>("Ver_2026_07_28", (prev) => {
    const rankingOrder = prev.rankingOrder.filter(
      (rank) => rank.value?.column !== REMOVED_IN_VIVO_SCORE_COLUMN_ID,
    );
    if (rankingOrder.length === prev.rankingOrder.length) return { ...prev };
    return { ...prev, rankingOrder, inVivoScoreRemovedNotice: true };
  })
  // `params` is absent when a block is created by hand rather than from a
  // template, so every field the contract carries keeps its own default.
  .init(({ params }) => ({
    defaultBlockLabel: params?.defaultBlockLabel ?? getDefaultBlockLabel({}),
    customBlockLabel: params?.customBlockLabel ?? "",
    input: params?.input,
    topClonotypes: params?.topClonotypes ?? 100,
    kabatNumbering: params?.kabatNumbering,
    rankingOrder: [],
    filters: [],
    diversificationColumn: undefined,
    tableState: createPlDataTableStateV2(),
    graphStateUMAP: {
      title: "Sequence Space UMAP",
      template: "dots",
      currentTab: null,
      layersSettings: { dots: { dotFill: "#5d32c6" } },
    },
    cdr3StackedBarPlotState: {
      title: "CDR3 V Spectratype",
      template: "stackedBar",
      currentTab: null,
    },
    vjUsagePlotState: {
      title: "V/J Usage",
      template: "heatmap",
      currentTab: null,
      layersSettings: { heatmap: { normalizationDirection: null } },
    },
    selectionPlotState: {
      title: "Selection Plot",
      template: "selection",
      currentTab: null,
    },
    alignmentModel: {},
    filtersInitializedForAnchor: undefined,
    rankingsInitializedForAnchor: undefined,
    preset: params?.preset,
    inVivoScoreRemovedNotice: undefined,
  }));
