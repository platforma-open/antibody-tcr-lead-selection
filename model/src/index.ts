import type { GraphMakerState } from '@milaboratories/graph-maker';
import strings from '@milaboratories/strings';
import type {
  AxisSpec,
  InferHrefType,
  InferOutputsType,
  PColumn, PColumnDataUniversal,
  PColumnIdAndSpec,
  PColumnSpec,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
  PObjectId,
  PTableSorting,
  SUniversalPColumnId,
} from '@platforma-sdk/model';
import {
  Annotation,
  BlockModelV3,
  createPFrameForGraphs,
  createPlDataTableV2,
  deriveLabels,
} from '@platforma-sdk/model';
import type { PlAdvancedFilter, PlAdvancedFilterItem } from '@platforma-sdk/ui-vue';
import { convertFilterTree, convertRankingOrderUI } from './converters';
import { blockDataModel } from './data_model';
import type { AnchoredColumnId, Filter, RankingOrder, RankingOrderUI } from './util';
import { anchoredColumnId, clusterAxisDomainsMatch, getColumns, getVisibleClusterAxes } from './util';

// ---------------------------------------------------------------------------
// Legacy types (for upgradeLegacy migration)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Intermediate migration type (flat filters, before tree conversion)
// ---------------------------------------------------------------------------

export type BlockDataV20260220 = {
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

// ---------------------------------------------------------------------------
// V3 unified data type (tree-based filters)
// ---------------------------------------------------------------------------

export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;
  inputAnchor?: PlRef;
  topClonotypes: number;
  kabatNumbering?: boolean;
  disableClusterRanking?: boolean;
  clusterColumn?: PlRef;

  rankingOrder: RankingOrderUI[];

  /** Tree-based filter model from PlAdvancedFilter */
  filterModel: PlAdvancedFilter;
  /** Lookup: SUniversalPColumnId → { anchorRef, anchorName } — maintained by UI */
  filterColumnAnchors: Record<string, { anchorRef: PlRef; anchorName: string }>;

  tableState: PlDataTableStateV2;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
  filtersInitializedForAnchor?: string;
  rankingsInitializedForAnchor?: string;
};

// ---------------------------------------------------------------------------
// Derived args — same shape the workflow expects
// ---------------------------------------------------------------------------

export type BlockArgs = {
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

// ---------------------------------------------------------------------------
// Helper types re-exported from util (for backward compat & UI usage)
// ---------------------------------------------------------------------------

export type { AnchoredColumnId, Filter, RankingOrder, RankingOrderUI };

// Legacy FilterUI type — kept for data_model migration typing
export type FilterUI = Filter & {
  id?: string;
  isExpanded?: boolean;
};

// ---------------------------------------------------------------------------
// Helper functions (unchanged from V2)
// ---------------------------------------------------------------------------

function hasClusterData(columns: PColumn<PColumnDataUniversal>[]): boolean {
  for (const col of columns) {
    for (const axis of col.spec.axesSpec) {
      if (axis.name === 'pl7.app/vdj/clusterId') {
        return true;
      }
    }
  }
  return false;
}

function hasMultipleClusteringBlocks(columns: PColumn<PColumnDataUniversal>[]): boolean {
  const blockIds = new Set<string>();
  for (const col of columns) {
    for (const axis of col.spec.axesSpec) {
      if (axis.name === 'pl7.app/vdj/clusterId' && axis.domain) {
        const blockId = axis.domain['pl7.app/vdj/clustering/blockId'];
        if (blockId && typeof blockId === 'string') {
          blockIds.add(blockId);
        }
      }
    }
  }
  return blockIds.size > 1;
}

function updateClusterColumnLabels(columns: PColumn<PColumnDataUniversal>[]): PColumn<PColumnDataUniversal>[] {
  const clusterColumns = columns.filter((col) => {
    if (col.spec.name.startsWith('pl7.app/vdj/clustering/')) {
      return true;
    }
    const hasClusterIdAxis = col.spec.axesSpec.some((axis) => axis.name === 'pl7.app/vdj/clusterId');
    if (!hasClusterIdAxis) {
      return false;
    }
    const relevantNames = [
      'pl7.app/vdj/sequence',
      'pl7.app/vdj/uniqueMoleculeCount',
      'pl7.app/vdj/uniqueMoleculeFraction',
      'pl7.app/vdj/readCount',
      'pl7.app/vdj/readFraction',
    ];
    return relevantNames.includes(col.spec.name);
  });

  if (clusterColumns.length === 0) {
    return columns;
  }

  const derivedLabels = deriveLabels(
    clusterColumns,
    (col) => col.spec,
    { includeNativeLabel: true },
  );

  const labelMap = new Map(
    derivedLabels.map(({ value, label }) => [value.id, label]),
  );

  return columns.map((col) => {
    const derivedLabel = labelMap.get(col.id);
    if (derivedLabel !== undefined) {
      return {
        ...col,
        spec: {
          ...col.spec,
          annotations: {
            ...col.spec.annotations,
            'pl7.app/label': derivedLabel,
          },
        },
      };
    }
    return col;
  });
}

function getDisambiguatedOptions<T>(
  items: T[],
  getSpec: (item: T) => PColumnSpec,
): { value: T; label: string }[] {
  const labelMap = new Map<string, T[]>();
  for (const item of items) {
    const spec = getSpec(item);
    const label = spec.annotations?.['pl7.app/label'] || spec.name;
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
    }
    labelMap.get(label)!.push(item);
  }

  const results: { value: T; label: string }[] = [];
  for (const [label, group] of labelMap.entries()) {
    if (group.length > 1) {
      const derived = deriveLabels(
        group,
        getSpec,
        { includeNativeLabel: true },
      );
      results.push(...derived);
    } else {
      results.push({
        value: group[0],
        label,
      });
    }
  }
  return results;
}

function disambiguateLabels(columns: PColumn<PColumnDataUniversal>[]): PColumn<PColumnDataUniversal>[] {
  const labelMap = new Map<string, PColumn<PColumnDataUniversal>[]>();
  for (const col of columns) {
    const label = col.spec.annotations?.['pl7.app/label'] || col.spec.name;
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
    }
    labelMap.get(label)!.push(col);
  }

  const updates = new Map<string, string>();
  for (const [label, cols] of labelMap.entries()) {
    if (cols.length > 1) {
      const derived = deriveLabels(
        cols,
        (col) => col.spec,
        { includeNativeLabel: true },
      );
      for (const { value, label: newLabel } of derived) {
        if (newLabel !== label) {
          updates.set(value.id as string, newLabel);
        }
      }
    }
  }

  if (updates.size === 0) return columns;

  return columns.map((col) => {
    if (updates.has(col.id as string)) {
      return {
        ...col,
        spec: {
          ...col.spec,
          annotations: {
            ...col.spec.annotations,
            'pl7.app/label': updates.get(col.id as string)!,
          },
        },
      };
    }
    return col;
  });
}

function isFullProteinSequence(spec: PColumnSpec): boolean {
  return (
    spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'
    && spec.annotations?.['pl7.app/vdj/isMainSequence'] === 'true'
    && spec.domain?.['pl7.app/alphabet'] === 'aminoacid'
  );
}

function getDefaultVisibleColumns(
  columns: PColumn<PColumnDataUniversal>[],
  filterColumnIds: Set<string>,
  rankingColumnIds: Set<string>,
  kabatEnabled: boolean,
): Set<PObjectId> {
  const visible = new Set<PObjectId>();

  for (const col of columns) {
    if (isFullProteinSequence(col.spec)) {
      visible.add(col.id);
      continue;
    }
    if (col.spec.name === 'pl7.app/vdj/ranking-order') {
      visible.add(col.id);
      continue;
    }
    if (kabatEnabled && col.spec.name.startsWith('pl7.app/vdj/kabatSequence')) {
      visible.add(col.id);
      continue;
    }
    const colIdStr = col.id as string;
    if (filterColumnIds.has(colIdStr) || rankingColumnIds.has(colIdStr)) {
      visible.add(col.id);
      continue;
    }
  }

  return visible;
}

// ---------------------------------------------------------------------------
// Block Model V3
// ---------------------------------------------------------------------------

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.inputAnchor === undefined) throw new Error('No input anchor');
    if (data.topClonotypes === undefined) throw new Error('No top clonotypes');

    const rankingOrder = convertRankingOrderUI(data.rankingOrder);
    if (rankingOrder.some((order) => order.value === undefined))
      throw new Error('Incomplete ranking order');

    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      inputAnchor: data.inputAnchor,
      topClonotypes: data.topClonotypes,
      rankingOrder,
      filters: convertFilterTree(data.filterModel, data.filterColumnAnchors),
      kabatNumbering: data.kabatNumbering,
      disableClusterRanking: data.disableClusterRanking,
      clusterColumn: data.clusterColumn,
    };
  })

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions([{
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/clonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }, {
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/scClonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }], { refsWithEnrichments: true }),
  )

  .output('inputAnchorSpec', (ctx) => {
    const ref = ctx.args?.inputAnchor;
    if (ref === undefined) return undefined;
    return ctx.resultPool.getPColumnSpecByRef(ref);
  }, { retentive: true })

  .output('filterConfig', (ctx) => {
    const columns = getColumns(ctx, ctx.args?.inputAnchor);
    if (columns === undefined) return undefined;

    const items: PlAdvancedFilterItem[] = getDisambiguatedOptions(
      columns.props.filter((c) => {
        if (c.column.spec.annotations?.['pl7.app/isLinkerColumn'] === 'true') return false;
        if (c.column.spec.valueType !== 'String') return true;
        if (c.column.spec.annotations?.['pl7.app/discreteValues']) return true;
        return false;
      }),
      (c) => c.column.spec,
    ).map((o) => ({
      id: o.value.column.id as SUniversalPColumnId,
      label: o.label,
      spec: o.value.column.spec,
    }));

    const anchorMap: Record<string, { anchorRef: PlRef; anchorName: string }> = Object.fromEntries(
      columns.props.map((c) => [
        c.column.id as string,
        { anchorRef: c.anchorRef, anchorName: c.anchorName },
      ]),
    );

    return { items, anchorMap, defaults: columns.defaultFilters };
  })

  .output('rankingConfig', (ctx) => {
    const columns = getColumns(ctx, ctx.args?.inputAnchor);
    if (columns === undefined) return undefined;

    const options = getDisambiguatedOptions(
      columns.props.filter((c) =>
        c.column.spec.valueType !== 'String'
        && c.column.spec.annotations?.['pl7.app/isLinkerColumn'] !== 'true',
      ),
      (c) => c.column.spec,
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
    }));

    return { options, defaults: columns.defaultRankingOrder };
  })

  .outputWithStatus('pf', (ctx) => {
    const columns = getColumns(ctx, ctx.args?.inputAnchor);
    if (!columns) return undefined;

    return createPFrameForGraphs(ctx, columns.props.map((c) => c.column));
  })

  .outputWithStatus('spectratypePf', (ctx) => {
    const pCols = ctx.outputs?.resolve({
      field: 'cdr3VspectratypePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus('vjUsagePf', (ctx) => {
    const pCols = ctx.outputs?.resolve({
      field: 'vjUsagePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus('table', (ctx) => {
    const columns = getColumns(ctx, ctx.activeArgs?.inputAnchor);
    if (columns === undefined)
      return undefined;

    if (!ctx.outputs) {
      return undefined;
    }

    const props = columns.props.map((c) => c.column);

    const sampledRowsAccessor = ctx.outputs.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });

    const sampledRows = sampledRowsAccessor?.getPColumns();
    const sampledRowsAreFinal = sampledRowsAccessor?.getIsFinal() ?? false;

    if (sampledRows === undefined || !sampledRowsAreFinal) {
      return undefined;
    }

    if (ctx.activeArgs?.inputAnchor !== undefined) {
      const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.activeArgs.inputAnchor);
      if (anchorSpec !== undefined) {
        const samplingCol = sampledRows.find(
          (col) => col.spec.name === 'pl7.app/vdj/lead-selection',
        );
        if (samplingCol !== undefined) {
          const clonotypeAxisMatches = samplingCol.spec.axesSpec.some(
            (axis) => JSON.stringify(axis) === JSON.stringify(anchorSpec.axesSpec[1]),
          );
          if (!clonotypeAxisMatches) {
            return undefined;
          }
        }
      }
    }

    const assemblingKabatPf = ctx.outputs?.resolve({
      field: 'assemblingKabatPf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();

    const allColumns = [
      ...props,
      ...sampledRows,
      ...(assemblingKabatPf ?? []),
    ];

    const filterColumnIds = new Set<string>(
      ctx.activeArgs?.filters
        .filter((f) => f.value?.column !== undefined)
        .map((f) => f.value!.column as string),
    );

    const rankingColumnIds = new Set<string>(
      ctx.activeArgs?.rankingOrder
        .filter((r) => r.value?.column !== undefined)
        .map((r) => r.value!.column as string),
    );

    const visibleClusterAxes: AxisSpec[] = getVisibleClusterAxes(allColumns, filterColumnIds, rankingColumnIds);

    const kabatEnabled = ctx.activeArgs?.kabatNumbering ?? false;
    const defaultVisible = getDefaultVisibleColumns(allColumns, filterColumnIds, rankingColumnIds, kabatEnabled);

    const allColumnsWithVisibility = allColumns.map((col) => {
      const isVisible = defaultVisible.has(col.id);
      const colIdStr = col.id as string;
      const isFilterOrRankColumn = filterColumnIds.has(colIdStr) || rankingColumnIds.has(colIdStr);

      const isLinkerColumn = col.spec.annotations?.[Annotation.IsLinkerColumn] === 'true';

      const annotations = col.spec.annotations || {};
      let orderPriority = annotations[Annotation.Table.OrderPriority];

      const isCloneLabelColumn = col.spec.name === Annotation.Label
        && col.spec.axesSpec.length === 1
        && (col.spec.axesSpec[0].name === 'pl7.app/vdj/clonotypeKey'
          || col.spec.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey');

      if (isCloneLabelColumn) {
        orderPriority = '1000000';
      } else if (isFullProteinSequence(col.spec)) {
        orderPriority = '999000';
      } else if (isFilterOrRankColumn) {
        orderPriority = '7000';
      }

      const originalVisibility = col.spec.annotations?.[Annotation.Table.Visibility];
      const visibility = isLinkerColumn || originalVisibility === 'hidden'
        ? 'hidden'
        : (isVisible ? 'default' : 'optional');

      const newAnnotations = {
        ...col.spec.annotations,
        [Annotation.Table.Visibility]: visibility,
        ...(orderPriority && { [Annotation.Table.OrderPriority]: orderPriority }),
      };

      const updatedAxesSpec = col.spec.axesSpec.map((axis) => {
        const isClonotypeAxis = axis.name === 'pl7.app/vdj/clonotypeKey'
          || axis.name === 'pl7.app/vdj/scClonotypeKey';
        const isClusterAxis = axis.name === 'pl7.app/vdj/clusterId';

        if (isClonotypeAxis) {
          return {
            ...axis,
            annotations: {
              ...axis.annotations,
              [Annotation.Table.OrderPriority]: '1000000',
            },
          };
        }

        if (isClusterAxis) {
          const shouldBeVisible = visibleClusterAxes.some((visibleAxis: AxisSpec) =>
            clusterAxisDomainsMatch(visibleAxis, axis),
          );

          if (!shouldBeVisible) {
            return {
              ...axis,
              annotations: {
                ...axis.annotations,
                [Annotation.Table.Visibility]: 'optional',
              },
            };
          }
        }

        return axis;
      });

      return {
        ...col,
        spec: {
          ...col.spec,
          annotations: newAnnotations,
          axesSpec: updatedAxesSpec,
        },
      };
    });

    const cols = hasMultipleClusteringBlocks(allColumnsWithVisibility)
      ? updateClusterColumnLabels(allColumnsWithVisibility)
      : allColumnsWithVisibility;

    let finalCols = disambiguateLabels(cols);

    const rankingOrderCol = allColumns.find(
      (col) => col.spec.name === 'pl7.app/vdj/ranking-order',
    );

    const ops: {
      coreColumnPredicate: (spec: PColumnIdAndSpec) => boolean;
      coreJoinType: 'inner' | 'full';
      sorting?: PTableSorting[];
    } = {
      coreColumnPredicate: (col) => col.spec.name === 'pl7.app/vdj/lead-selection',
      coreJoinType: 'inner',
    };

    if (rankingOrderCol) {
      ops.sorting = [
        {
          column: {
            type: 'column',
            id: rankingOrderCol.id,
          },
          ascending: true,
          naAndAbsentAreLeastValues: false,
        },
      ];
    }

    finalCols = finalCols.filter((col) => !col.spec.annotations?.[Annotation.Trace]?.includes('antibody-tcr-lead-selection'));

    return createPlDataTableV2(
      ctx,
      finalCols,
      ctx.data.tableState,
      ops,
    );
  })

  .output('calculating', (ctx) => {
    if (ctx.args?.inputAnchor === undefined)
      return false;

    if (!ctx.outputs) return false;

    const outputsState = ctx.outputs.getIsReadyOrError();

    if (outputsState === false) return true;

    return false;
  })

  .outputWithStatus('umapPf', (ctx) => {
    const anchor = ctx.args?.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const umap = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          namePattern: '^pl7\\.app/vdj/umap[12]$',
        },
      ],
    );

    if (umap === undefined || umap.length === 0)
      return undefined;

    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return createPFrameForGraphs(ctx, [...umap, ...(sampledRows ?? [])]);
  })

  .outputWithStatus('umapPcols', (ctx) => {
    const anchor = ctx.args?.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const umap = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          namePattern: '^pl7\\.app/vdj/umap[12]$',
        },
      ],
    );

    if (umap === undefined || umap.length === 0)
      return undefined;

    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return [...umap, ...(sampledRows ?? [])].map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        } satisfies PColumnIdAndSpec),
    );
  })

  .output('hasClusterData', (ctx) => {
    const columns = getColumns(ctx, ctx.args?.inputAnchor);
    if (columns === undefined)
      return false;

    return hasClusterData(columns.props.map((p) => p.column));
  })

  .output('clusterColumnOptions', (ctx) => {
    const anchor = ctx.args?.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
    if (anchorSpec === undefined)
      return undefined;

    const options: Array<{ label: string; ref: PlRef }> = [];

    for (const idx of [0, 1]) {
      let axesToMatch;
      if (idx === 0) {
        axesToMatch = [{}, anchorSpec.axesSpec[1]];
      } else {
        axesToMatch = [anchorSpec.axesSpec[1], {}];
      }

      const linkers = ctx.resultPool.getOptions([
        {
          axes: axesToMatch,
          annotations: { 'pl7.app/isLinkerColumn': 'true' },
        },
      ], {
        label: {
          forceTraceElements: ['milaboratories.clonotype-clustering.clustering'],
        },
      });

      for (const link of linkers) {
        options.push({
          label: link.label || 'Cluster',
          ref: link.ref,
        });
      }
    }

    return options.length > 0 ? options : undefined;
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => 'Antibody/TCR Leads')

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_) => {
    return [
      { type: 'link', href: '/', label: strings.titles.main },
      { type: 'link', href: '/umap', label: 'Clonotype Space' },
      { type: 'link', href: '/spectratype', label: 'CDR3 V Spectratype' },
      { type: 'link', href: '/usage', label: 'V/J Gene Usage' },
    ];
  })

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;

export * from './converters';
export { getDefaultBlockLabel } from './label';
