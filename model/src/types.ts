import type { GraphMakerState } from '@milaboratories/graph-maker';
import type { ColumnRecipe, ColumnUniversalId, DatasetSelection, PlDataTableStateV2, PlMultiSequenceAlignmentModel, PlRef } from '@platforma-sdk/model';
import type { PlTableFilter } from './typesFilters';

export * from './typesFilters';

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

/** Stored shape at Ver_2026_02_25 — `inputAnchor` / `diversificationColumn` are
 *  `PlRef`, mirroring what's on disk for projects saved at that version.
 *  Do not retype these fields when the current `BlockData` changes — historical
 *  steps must match what was actually persisted. */
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

/** Stored shape at Ver_2026_05_08 — adds `selectionPlotState`. Frozen so the
 *  current `BlockData` can change without dragging historical aliases with it. */
export type BlockData_Ver_2026_05_08 = BlockData_Ver_2026_02_25 & {
  selectionPlotState: GraphMakerState;
};

/** Stored shape at Ver_2026_05_21 — `inputAnchor: PlRef` becomes
 *  `input: DatasetSelection`. `diversificationColumn` is still a `PlRef`
 *  at this version. */
export type BlockData_Ver_2026_05_21 = Omit<BlockData_Ver_2026_05_08, 'inputAnchor'> & {
  /** Dataset selection emitted by `PlDatasetSelector` (primary anchor + optional filter). */
  input?: DatasetSelection;
};

export type BlockData = Omit<BlockData_Ver_2026_05_21, 'diversificationColumn'> & {
  /**
   * Selected linker column for diversified ranking (grouping by cluster).
   * Migrated from `PlRef` to `ColumnUniversalId` at Ver_2026_05_28.
   * undefined = no diversification.
   */
  diversificationColumn?: ColumnUniversalId;
};

export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  /** Extracted from `data.input?.primary.column` (PlRef) at the args boundary
   *  and converted via `createGlobalPObjectId`. */
  inputAnchor?: ColumnUniversalId;
  /**
   * Optional filter column the user picked alongside the dataset in
   * `PlDatasetSelector`. Extracted from `data.input?.primary.filter` and
   * converted to a `ColumnUniversalId`.
   */
  inputFilter?: ColumnUniversalId;
  topClonotypes: number;
  rankingOrder: RankingOrder[];
  filters: Filter[];
  kabatNumbering?: boolean;
  /** Selected linker column for diversified ranking (grouping by cluster). undefined = no diversification */
  diversificationColumn?: ColumnUniversalId;
};

export type ScopedColumn = {
  anchorRef: ColumnUniversalId;
  anchorName: string;
  column: ColumnRecipe;
};

export type ScopedColumnId = {
  anchorRef: ColumnUniversalId;
  anchorName: string;
  column: ColumnUniversalId;
};

export type RankingOrder = {
  value?: ScopedColumnId;
  rankingOrder: 'increasing' | 'decreasing';
};

export type RankingOrderUI = RankingOrder & {
  id?: string;
  isExpanded?: boolean;
};

/** Filter for matching any of a set of discrete string values */
export type StringInFilter = {
  type: 'string_in';
  /** JSON-encoded string array, e.g. '["Yes","No"]' */
  reference: string;
};

/** Filter for excluding a set of discrete string values */
export type StringNotInFilter = {
  type: 'string_notIn';
  /** JSON-encoded string array, e.g. '["Yes","No"]' */
  reference: string;
};

export type DiscreteFilter = StringInFilter | StringNotInFilter;

export type Filter = {
  value?: ScopedColumnId;
  filter?: PlTableFilter | DiscreteFilter;
};

export type FilterUI = Filter & {
  id?: string;
  isExpanded?: boolean;
};

export type PlTableFiltersDefault = {
  column: ScopedColumnId;
  default: PlTableFilter | DiscreteFilter;
};

export type WorkflowPreset = 'in-vivo' | 'in-vitro' | 'peptide';

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
  /** True when SHM mutation columns are present and In Vivo Score should replace them in ranking */
  hasInVivoScore: boolean;
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
