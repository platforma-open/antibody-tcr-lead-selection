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
  BlockData_Ver_2026_07_28,
  InitializedForAnchor,
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

/**
 * Reshapes one stored `JSON.stringify(anchor) + "::" + preset` guard value into
 * the two-field slot.
 *
 * Split at the LAST `"::"`: a block id or column name can itself contain a colon,
 * so a leftmost split would cut the anchor JSON in half. The tail is the preset —
 * `"none"` when none was selected — and the head is the bare anchor JSON, which
 * is what relocates when a template is applied.
 */
function splitInitializedForAnchor(stored: string | undefined): InitializedForAnchor | undefined {
  if (stored === undefined) return undefined;
  const separator = stored.lastIndexOf("::");
  if (separator < 0) return { anchor: stored, preset: "none" };
  return {
    anchor: stored.slice(0, separator),
    preset: stored.slice(separator + 2) as InitializedForAnchor["preset"],
  };
}

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
  .migrate<BlockData_Ver_2026_07_28>("Ver_2026_07_28", (prev) => {
    const rankingOrder = prev.rankingOrder.filter(
      (rank) => rank.value?.column !== REMOVED_IN_VIVO_SCORE_COLUMN_ID,
    );
    if (rankingOrder.length === prev.rankingOrder.length) return { ...prev };
    return { ...prev, rankingOrder, inVivoScoreRemovedNotice: true };
  })
  // The defaults-init guards were one `JSON.stringify(anchor) + "::" + preset`
  // string; they are two fields now, so the anchor half stays a bare stringified
  // `PlRef`. See `splitInitializedForAnchor` for why the split is from the right.
  .migrate<BlockData>("Ver_2026_08_20", (prev) => ({
    ...prev,
    filtersInitializedForAnchor: splitInitializedForAnchor(prev.filtersInitializedForAnchor),
    rankingsInitializedForAnchor: splitInitializedForAnchor(prev.rankingsInitializedForAnchor),
  }))
  // `params` is absent when a block is created by hand rather than from a
  // template, so every field the contract carries keeps its own default.
  .init(({ params }) => ({
    defaultBlockLabel: params?.defaultBlockLabel ?? getDefaultBlockLabel({}),
    customBlockLabel: params?.customBlockLabel ?? "",
    input: params?.input,
    topClonotypes: params?.topClonotypes ?? 100,
    kabatNumbering: params?.kabatNumbering,
    rankingOrder: params?.rankingOrder ?? [],
    filters: params?.filters ?? [],
    diversificationColumn: params?.diversificationColumn,
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
    filtersInitializedForAnchor: params?.filtersInitializedForAnchor,
    rankingsInitializedForAnchor: params?.rankingsInitializedForAnchor,
    preset: params?.preset,
    inVivoScoreRemovedNotice: undefined,
  }));
