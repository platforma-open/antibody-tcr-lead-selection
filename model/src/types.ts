import type { GraphMakerState } from '@milaboratories/graph-maker';
import type { ColumnMatch, DataInfo, PColumn, PColumnValues, PlDataTableStateV2, PlMultiSequenceAlignmentModel, PlRef, PObjectId, TreeNodeAccessor } from '@platforma-sdk/model';
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

export type BlockData = {
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

export type BlockArgs = {
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

// @todo: move this type to SDK
export type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor | PColumnValues>;

export type ScopedColumn = {
  anchorRef: PlRef;
  anchorName: string;
  column: Column;
};

export type ScopedColumnId = {
  anchorRef: PlRef;
  anchorName: string;
  column: PObjectId; // SUniversalPColumnId
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

export type WorkflowPreset = 'in-vivo' | 'in-vitro';

export type PresetDefaults = {
  rankingOrder: RankingOrder[];
  filters: PlTableFiltersDefault[];
};

export type ColumnsMeta = {
  /** All discovered columns (direct + linked via linker traversal) */
  allMatches: ColumnMatch[];
  /** Score columns (subset of allMatches with pl7.app/isScore annotation) */
  scores: ColumnMatch[];
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
};
