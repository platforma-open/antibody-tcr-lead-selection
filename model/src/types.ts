import type { GraphMakerState } from '@milaboratories/graph-maker';
import type { DataInfo, PColumn, PColumnValues, PlDataTableStateV2, PlMultiSequenceAlignmentModel, PlRef, SUniversalPColumnId, TreeNodeAccessor } from '@platforma-sdk/model';
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
  disableClusterRanking?: boolean;
  clusterColumn?: PlRef;
};

export type LegacyUiState = {
  tableState: PlDataTableStateV2;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
  rankingOrder: RankingOrderUI[];
  filters: FilterUI[];
  filtersInitializedForAnchor?: string;
  rankingsInitializedForAnchor?: string;
};

export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  topClonotypes: number;
  kabatNumbering?: boolean;
  disableClusterRanking?: boolean;
  clusterColumn?: PlRef;
  rankingOrder: RankingOrderUI[];
  filters: FilterUI[];
  tableState: PlDataTableStateV2;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
  filtersInitializedForAnchor?: string;
  rankingsInitializedForAnchor?: string;
};

export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  topClonotypes: number;
  rankingOrder: RankingOrder[];
  filters: Filter[];
  kabatNumbering?: boolean;
  clusterColumn?: PlRef;
  disableClusterRanking?: boolean;
};

export type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor | PColumnValues>;

export type AnchoredColumn = {
  anchorRef: PlRef;
  anchorName: string;
  column: Column;
};

export type AnchoredColumnId = {
  anchorRef: PlRef;
  anchorName: string;
  column: SUniversalPColumnId;
};

export type RankingOrder = {
  value?: AnchoredColumnId;
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
  value?: AnchoredColumnId;
  filter?: PlTableFilter | DiscreteFilter;
};

export type FilterUI = Filter & {
  id?: string;
  isExpanded?: boolean;
};

export type PlTableFiltersDefault = {
  column: AnchoredColumnId;
  default: PlTableFilter | DiscreteFilter;
};

export type Columns = {
  // all props: clones + linked
  props: AnchoredColumn[];
  scores: AnchoredColumn[];
  defaultFilters: PlTableFiltersDefault[];
  defaultRankingOrder: RankingOrder[];
};
