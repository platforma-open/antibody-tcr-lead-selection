import { createPlDataTableStateV2, DataModelBuilder } from '@platforma-sdk/model';
import type { BlockData, LegacyBlockArgs, LegacyUiState } from './types';
import { getDefaultBlockLabel } from './util';

export const blockDataModel = new DataModelBuilder()
  .from<BlockData>('Ver_2026_02_20')
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
  .migrate<BlockData>('Ver_2026_02_20_diversification_column', (prev) => {
    const { disableClusterRanking, clusterColumn, ...rest } = prev;
    return {
      ...rest,
      diversificationColumn: disableClusterRanking ? undefined : clusterColumn,
    };
  })
  .init(() => ({
    defaultBlockLabel: getDefaultBlockLabel({}),
    customBlockLabel: '',
    topClonotypes: 100,
    rankingOrder: [],
    filters: [],
    diversificationColumn: undefined,
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
