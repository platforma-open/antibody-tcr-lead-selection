import type { GraphMakerState } from "@milaboratories/graph-maker";
import type {
  ColumnRecipe,
  DatasetSelection,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
} from "@platforma-sdk/model";
import type {
  DiscreteFilter,
  Filter,
  InitializedForAnchor,
  PlTableFilter,
  RankingOrder,
  ScopedColumnId,
  WorkflowPreset,
} from "@platforma-open/milaboratories.top-antibodies.kind";

// `ScopedColumnId`, `RankingOrder`, `Filter`, the discrete-filter shapes and the
// filter predicate union are part of the block's init-params contract, so they
// are declared by the kind and re-exported here: the model depends on the kind,
// never the other way round.
export type * from "@platforma-open/milaboratories.top-antibodies.kind";

export type LegacyBlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  topClonotypes: number;
  rankingOrder: RankingOrder[];
  filters: Filter[];
  kabatNumbering?: boolean;
  /** Selected linker column for diversified ranking (grouping by cluster). undefined = no diversification */
  diversificationColumn?: PlRef;
};

export type LegacyUiState = {
  tableState: PlDataTableStateV2;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
  rankingOrder: RankingOrderUI[];
  filters: FilterUI[];
  /** Tracks which anchor's filter defaults have been applied (prevents re-applying on panel reopen) */
  filtersInitializedForAnchor?: string;
  /** Tracks which anchor's ranking defaults have been applied (prevents re-applying on panel reopen) */
  rankingsInitializedForAnchor?: string;
  /** Selected workflow preset (in-vivo or in-vitro) */
  preset?: WorkflowPreset;
};

export type BlockData_Ver_2026_02_25 = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  topClonotypes: number;
  kabatNumbering?: boolean;
  /** Selected linker column for diversified ranking (grouping by cluster). undefined = no diversification */
  diversificationColumn?: PlRef;
  rankingOrder: RankingOrderUI[];
  filters: FilterUI[];
  tableState: PlDataTableStateV2;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
  /** Tracks which anchor's filter defaults have been applied (prevents re-applying on panel reopen) */
  filtersInitializedForAnchor?: string;
  /** Tracks which anchor's ranking defaults have been applied (prevents re-applying on panel reopen) */
  rankingsInitializedForAnchor?: string;
  /** Selected workflow preset (in-vivo or in-vitro) */
  preset?: WorkflowPreset;
};

export type BlockData_Ver_2026_05_08 = BlockData_Ver_2026_02_25 & {
  selectionPlotState: GraphMakerState;
};

export type BlockData_Ver_2026_05_21 = Omit<BlockData_Ver_2026_05_08, "inputAnchor"> & {
  /**
   * Dataset selection emitted by `PlDatasetSelector` (primary anchor + optional
   * filter). Replaces the previous `inputAnchor: PlRef`; the args lambda
   * unpacks it into the workflow's `inputAnchor` + `inputFilter`.
   */
  input?: DatasetSelection;
};

export type BlockData_Ver_2026_07_28 = BlockData_Ver_2026_05_21 & {
  /**
   * Set by the `Ver_2026_07_28` migration when it dropped the block's former
   * built-in "In Vivo Score" from the stored ranking. Drives a one-time notice
   * on the main page; cleared when the user dismisses it.
   */
  inVivoScoreRemovedNotice?: boolean;
};

export type BlockData_Ver_2026_08_20 = Omit<
  BlockData_Ver_2026_07_28,
  "filtersInitializedForAnchor" | "rankingsInitializedForAnchor"
> & {
  /**
   * The anchor the filter defaults were last applied for, with the preset they
   * were applied under. Replaces the previous single `anchor::preset` string:
   * split into two fields, the anchor half stays a bare stringified `PlRef`,
   * which is what lets a template relocate it to the project it is applied in.
   */
  filtersInitializedForAnchor?: InitializedForAnchor;
  /** As {@link filtersInitializedForAnchor}, for the ranking defaults. */
  rankingsInitializedForAnchor?: InitializedForAnchor;
};

export type BlockData = BlockData_Ver_2026_08_20;

export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  /**
   * Optional filter column the user picked alongside the dataset in
   * `PlDatasetSelector`. The workflow inner-joins this column into the clone
   * table so all downstream stages see only the filtered clonotypes.
   */
  inputFilter?: PlRef;
  topClonotypes: number;
  rankingOrder: RankingOrder[];
  filters: Filter[];
  kabatNumbering?: boolean;
  /** Selected linker column for diversified ranking (grouping by cluster). undefined = no diversification */
  diversificationColumn?: PlRef;
};

export type RankingOrderUI = RankingOrder & {
  id?: string;
  isExpanded?: boolean;
};

export type FilterUI = Filter & {
  id?: string;
  isExpanded?: boolean;
};

export type PlTableFiltersDefault = {
  column: ScopedColumnId;
  default: PlTableFilter | DiscreteFilter;
};

export type PresetDefaults = {
  rankingOrder: RankingOrder[];
  filters: PlTableFiltersDefault[];
};

export type ColumnsMeta = {
  /** All discovered columns (direct + linked via linker traversal) */
  allMatches: ColumnRecipe[];
  /** Score columns (subset of allMatches with pl7.app/isScore annotation) */
  scores: ColumnRecipe[];
  defaultFilters: PlTableFiltersDefault[];
  defaultRankingOrder: RankingOrder[];
  /** True when the Repertoire Score column is present upstream; it becomes the primary In Vivo ranking */
  hasRepertoireScore: boolean;
  /** True when enrichment score columns are present */
  hasEnrichmentScores: boolean;
  /** Auto-detected preset based on available columns */
  detectedPreset: WorkflowPreset | undefined;
  /** Default ranking and filter settings for in-vivo workflow */
  inVivoDefaults: PresetDefaults;
  /** Default ranking and filter settings for in-vitro workflow */
  inVitroDefaults: PresetDefaults;
  /** Default ranking and filter settings for peptide workflow */
  inPeptideDefaults: PresetDefaults;
};
