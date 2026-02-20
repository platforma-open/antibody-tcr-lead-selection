import { createPlDataTableStateV2, DataModelBuilder } from '@platforma-sdk/model';
import type { BlockData, BlockDataV20260220, LegacyBlockArgs, LegacyUiState } from '.';
import { getDefaultBlockLabel } from './label';

export const blockDataModel = new DataModelBuilder()
  .from<BlockDataV20260220>('V20260220')
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    defaultBlockLabel: args.defaultBlockLabel,
    customBlockLabel: args.customBlockLabel,
    inputAnchor: args.inputAnchor,
    topClonotypes: args.topClonotypes,
    kabatNumbering: args.kabatNumbering,
    disableClusterRanking: args.disableClusterRanking,
    clusterColumn: args.clusterColumn,
    rankingOrder: uiState?.rankingOrder ?? [],
    filters: uiState?.filters ?? [],
    tableState: uiState?.tableState ?? createPlDataTableStateV2(),
    graphStateUMAP: uiState?.graphStateUMAP ?? {
      title: 'Clonotype Space UMAP',
      template: 'dots',
      currentTab: null,
      layersSettings: { dots: { dotFill: '#5d32c6' } },
    },
    cdr3StackedBarPlotState: uiState?.cdr3StackedBarPlotState ?? {
      title: 'CDR3 V Spectratype',
      template: 'stackedBar',
      currentTab: null,
    },
    vjUsagePlotState: uiState?.vjUsagePlotState ?? {
      title: 'V/J Usage',
      template: 'heatmap',
      currentTab: null,
      layersSettings: { heatmap: { normalizationDirection: null } },
    },
    alignmentModel: uiState?.alignmentModel ?? {},
    filtersInitializedForAnchor: uiState?.filtersInitializedForAnchor,
    rankingsInitializedForAnchor: uiState?.rankingsInitializedForAnchor,
  }))
  .migrate<BlockData>('V20260220Filters', (prev) => ({
    defaultBlockLabel: prev.defaultBlockLabel,
    customBlockLabel: prev.customBlockLabel,
    inputAnchor: prev.inputAnchor,
    topClonotypes: prev.topClonotypes,
    kabatNumbering: prev.kabatNumbering,
    disableClusterRanking: prev.disableClusterRanking,
    clusterColumn: prev.clusterColumn,
    rankingOrder: prev.rankingOrder,
    filterModel: { type: 'and' as const, filters: [], id: 0 },
    filterColumnAnchors: {},
    tableState: prev.tableState,
    graphStateUMAP: prev.graphStateUMAP,
    cdr3StackedBarPlotState: prev.cdr3StackedBarPlotState,
    vjUsagePlotState: prev.vjUsagePlotState,
    alignmentModel: prev.alignmentModel,
    // Reset so default filters re-apply with new PlAdvancedFilter format
    filtersInitializedForAnchor: undefined,
    rankingsInitializedForAnchor: prev.rankingsInitializedForAnchor,
  }))
  .init(() => ({
    defaultBlockLabel: getDefaultBlockLabel({}),
    customBlockLabel: '',
    topClonotypes: 100,
    rankingOrder: [],
    filterModel: { type: 'and' as const, filters: [], id: 0 },
    filterColumnAnchors: {},
    disableClusterRanking: false,
    tableState: createPlDataTableStateV2(),
    graphStateUMAP: {
      title: 'Clonotype Space UMAP',
      template: 'dots',
      currentTab: null,
      layersSettings: { dots: { dotFill: '#5d32c6' } },
    },
    cdr3StackedBarPlotState: {
      title: 'CDR3 V Spectratype',
      template: 'stackedBar',
      currentTab: null,
    },
    vjUsagePlotState: {
      title: 'V/J Usage',
      template: 'heatmap',
      currentTab: null,
      layersSettings: { heatmap: { normalizationDirection: null } },
    },
    alignmentModel: {},
    filtersInitializedForAnchor: undefined,
    rankingsInitializedForAnchor: undefined,
  }));
