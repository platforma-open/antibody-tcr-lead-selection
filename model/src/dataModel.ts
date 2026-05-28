import {
  createDatasetSelection,
  createGlobalPObjectId,
  createPlDataTableStateV2,
  createPrimaryRef,
  DataModelBuilder,
} from '@platforma-sdk/model';
import type {
  BlockData,
  BlockData_Ver_2026_02_25,
  BlockData_Ver_2026_05_08,
  BlockData_Ver_2026_05_21,
  LegacyBlockArgs,
  LegacyUiState,
} from './types';
import { getDefaultBlockLabel } from './util';

const defaultSelectionPlotState = (): BlockData['selectionPlotState'] => ({
  title: 'Selection Plot',
  template: 'selection',
  currentTab: null,
});

export const blockDataModel = new DataModelBuilder()
  .from<BlockData_Ver_2026_02_25>('Ver_2026_02_25')
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    // upgradeLegacy returns the v1 shape — inputAnchor / diversificationColumn
    // are still PlRef here. The PlRef → ColumnUniversalId conversion happens in
    // the dedicated Ver_2026_05_28 step so stored-v1 data takes the same path.
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
      title: 'Sequence Space UMAP',
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
    preset: uiState?.preset,
  }))
  .migrate<BlockData_Ver_2026_05_08>('Ver_2026_05_08', (prev) => ({
    ...prev,
    selectionPlotState: defaultSelectionPlotState(),
  }))
  .migrate<BlockData_Ver_2026_05_21>('Ver_2026_05_21', (prev) => {
    const { inputAnchor, ...rest } = prev;
    return {
      ...rest,
      input: inputAnchor !== undefined
        ? createDatasetSelection(createPrimaryRef(inputAnchor))
        : undefined,
    };
  })
  .migrate<BlockData>('Ver_2026_05_28', (prev) => {
    const { diversificationColumn, ...rest } = prev;
    return {
      ...rest,
      diversificationColumn: diversificationColumn !== undefined
        ? createGlobalPObjectId(diversificationColumn.blockId, diversificationColumn.name)
        : undefined,
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
      title: 'Sequence Space UMAP',
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
    selectionPlotState: {
      title: 'Selection Plot',
      template: 'selection',
      currentTab: null,
    },
    alignmentModel: {},
    filtersInitializedForAnchor: undefined,
    rankingsInitializedForAnchor: undefined,
    preset: undefined,
  }));
