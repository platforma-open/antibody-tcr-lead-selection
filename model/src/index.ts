import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  CreatePlDataTableOps,
  InferOutputsType,
  PColumnSpec,
  PFrameHandle,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PObjectId,
  PlRef,
  AxisSpec,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPFrameForGraphs,
  createPlDataTableStateV2,
  createPlDataTableV2,
  deriveLabels,
} from '@platforma-sdk/model';
import type { AnchoredColumnId, Filter, FilterUI, RankingOrder, RankingOrderUI } from './util';
import { anchoredColumnId, getColumns, getVisibleClusterAxes, clusterAxisDomainsMatch } from './util';
import type { PColumn, PColumnDataUniversal } from '@platforma-sdk/model';

/**
 * Checks if any cluster data is present by examining clusterId axes.
 * Returns true if at least one column has a clusterId axis.
 */
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

/**
 * Checks if there are multiple upstream clustering blocks by examining clusterId axes.
 * Returns true if there are 2 or more unique clustering blockIds.
 */
function hasMultipleClusteringBlocks(columns: PColumn<PColumnDataUniversal>[]): boolean {
  const blockIds = new Set<string>();

  for (const col of columns) {
    // Look for clusterId axes
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

/**
 * Updates cluster-related columns to use labels derived from trace information.
 * This ensures that columns like "Cluster Size", centroid sequences, and abundance per cluster
 * show distinguishing labels when multiple clustering blocks are present
 * (e.g., "Cluster Size / Clustering (sim:..., ident:..., cov:...)").
 */
function updateClusterColumnLabels(columns: PColumn<PColumnDataUniversal>[]): PColumn<PColumnDataUniversal>[] {
  // Identify cluster-related columns:
  // 1. Columns with clustering prefix (e.g., pl7.app/vdj/clustering/clusterSize)
  // 2. Sequence columns with clusterId axis (centroid sequences from clustering)
  // 3. Abundance columns with clusterId axis (abundance per cluster)
  // 4. distanceToCentroid columns (even without clusterId axis, as they come from cluster blocks)
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
    return columns; // No cluster columns, return as-is
  }

  // Derive labels using trace information
  const derivedLabels = deriveLabels(
    clusterColumns,
    (col) => col.spec,
    { includeNativeLabel: true },
  );

  // Create a map of column id to derived label
  const labelMap = new Map(
    derivedLabels.map(({ value, label }) => [value.id, label]),
  );

  // Update columns with derived labels
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

/**
 * Check if a column is a full protein sequence (main assembling feature, aminoacid)
 */
function isFullProteinSequence(spec: PColumnSpec): boolean {
  return (
    spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'
    && spec.annotations?.['pl7.app/vdj/isMainSequence'] === 'true'
    && spec.domain?.['pl7.app/alphabet'] === 'aminoacid'
  );
}

/**
 * Determine which columns should be visible by default
 */
function getDefaultVisibleColumns(
  columns: PColumn<PColumnDataUniversal>[],
  filterColumnIds: Set<string>,
  rankingColumnIds: Set<string>,
): Set<PObjectId> {
  const visible = new Set<PObjectId>();

  for (const col of columns) {
    // Full protein sequences
    if (isFullProteinSequence(col.spec)) {
      visible.add(col.id);
      continue;
    }

    // Rank column (pl7.app/vdj/ranking-order)
    if (col.spec.name === 'pl7.app/vdj/ranking-order') {
      visible.add(col.id);
      continue;
    }

    // Filter and ranking columns - direct string comparison
    // Both col.id and the IDs in the sets should be SUniversalPColumnId strings
    const colIdStr = col.id as string;
    if (filterColumnIds.has(colIdStr) || rankingColumnIds.has(colIdStr)) {
      visible.add(col.id);
      continue;
    }
  }

  return visible;
}

export * from './converters';

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes: number;
  rankingOrder: RankingOrder[];
  filters: Filter[];
  kabatNumbering?: boolean;
  disableClusterRanking?: boolean;
  /** Selected linker column for cluster-based diversification (grouping by cluster) */
  clusterColumn?: PlRef;
};

export type UiState = {
  title?: string;
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
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    topClonotypes: 100,
    rankingOrder: [],
    filters: [],
    disableClusterRanking: false,
    clusterColumn: undefined,
  })

  .withUiState<UiState>({
    title: 'Antibody/TCR Leads',
    tableState: createPlDataTableStateV2(),
    graphStateUMAP: {
      title: 'Clonotype Space UMAP',
      template: 'dots',
      currentTab: null,
      layersSettings: {
        dots: {
          dotFill: '#5d32c6',
        },
      },
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
      layersSettings: {
        heatmap: {
          normalizationDirection: null,
        },
      },
    },
    alignmentModel: {},
    rankingOrder: [],
    filters: [],
  })

  // Activate "Run" button only after these conditions are satisfied
  .argsValid((ctx) => (ctx.args.inputAnchor !== undefined
    && ctx.args.topClonotypes !== undefined
    && ctx.args.rankingOrder.every((order) => order.value !== undefined)),
  )

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
    const ref = ctx.args.inputAnchor;
    if (ref === undefined) return undefined;
    return ctx.resultPool.getPColumnSpecByRef(ref);
  }, { retentive: true })

  // Combined filter config - options and defaults together for atomic updates
  .output('filterConfig', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined) return undefined;

    const options = deriveLabels(
      columns.props.filter((c) => {
        if (c.column.spec.annotations?.['pl7.app/isLinkerColumn'] === 'true') return false;
        if (c.column.spec.valueType !== 'String') return true;
        if (c.column.spec.annotations?.['pl7.app/discreteValues']) return true;
        return false;
      }),
      (c) => c.column.spec,
      { includeNativeLabel: true },
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
      column: o.value.column,
    }));

    return { options, defaults: columns.defaultFilters };
  })

  // Combined ranking config - options and defaults together for atomic updates
  .output('rankingConfig', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined) return undefined;

    const options = deriveLabels(
      columns.props.filter((c) =>
        c.column.spec.valueType !== 'String'
        && c.column.spec.annotations?.['pl7.app/isLinkerColumn'] !== 'true',
      ),
      (c) => c.column.spec,
      { includeNativeLabel: true },
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
    }));

    return { options, defaults: columns.defaultRankingOrder };
  })

  .output('pf', (ctx) => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    return createPFrameForGraphs(ctx, columns.props.map((c) => c.column));
  })

  // Use the cdr3LengthsCalculated cols
  .output('spectratypePf', (ctx) => {
    // const pCols = ctx.outputs?.resolve('cdr3VspectratypePf')?.getPColumns();
    const pCols = ctx.outputs?.resolve({
      field: 'cdr3VspectratypePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .output('vjUsagePf', (ctx) => {
    // const pCols = ctx.outputs?.resolve('vjUsagePf')?.getPColumns();
    const pCols = ctx.outputs?.resolve({
      field: 'vjUsagePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .output('table', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    // Don't render table until workflow has been executed
    if (!ctx.outputs) {
      return undefined;
    }

    const props = columns.props.map((c) => c.column);

    // Resolve the sampledRows output
    const sampledRowsAccessor = ctx.outputs.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });

    // Get the actual data
    const sampledRows = sampledRowsAccessor?.getPColumns();

    // Check if sampledRows output is finalized (detects stale data after dataset change)
    const sampledRowsAreFinal = sampledRowsAccessor?.getIsFinal() ?? false;

    // Don't render table if sampledRows don't exist or aren't finalized
    if (sampledRows === undefined || !sampledRowsAreFinal) {
      return undefined;
    }

    // Verify sampledRows belong to current inputAnchor by checking axes
    // This is critical to prevent showing data from a different dataset
    if (ctx.args.inputAnchor !== undefined) {
      const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
      if (anchorSpec !== undefined) {
        const samplingCol = sampledRows.find(
          (col) => col.spec.name === 'pl7.app/vdj/sampling-column',
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

    // Use sampled rows (after validation that they're final)
    const allColumns = [
      ...props,
      ...sampledRows,
      ...(assemblingKabatPf ?? []),
    ];

    // Extract column IDs from INITIAL filter/ranking settings BEFORE any transformations
    // Column IDs are SUniversalPColumnId which are already canonical string representations
    // Just use them directly for comparison
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

    // Determine which specific cluster axes should be visible:
    // Collect all unique cluster axes from columns that are used in filters/rankings
    const visibleClusterAxes: AxisSpec[] = getVisibleClusterAxes(allColumns, filterColumnIds, rankingColumnIds);

    // Apply visibility annotations FIRST, before any column transformations
    // This ensures we're working with the same column objects used to calculate visibility
    const defaultVisible = getDefaultVisibleColumns(allColumns, filterColumnIds, rankingColumnIds);

    // Modify column specs to add visibility and order priority annotations
    // Essential columns are set to 'default' (visible), all others are set to 'optional' (hidden)
    // Note: This only evaluates based on INITIAL filter/ranking values.
    // If user changes filters/rankings in the UI, they'll need to manually show those columns.
    //
    // Column order (higher priority = appears left):
    // 1. Clone Label (Clonotype ID) - 1000000
    // 2. Full Protein Sequences - 999000
    // 3. Filter/Rank columns - 7000
    // 4. Everything else - default/existing priority
    const allColumnsWithVisibility = allColumns.map((col) => {
      const isVisible = defaultVisible.has(col.id);
      const colIdStr = col.id as string;
      const isFilterOrRankColumn = filterColumnIds.has(colIdStr) || rankingColumnIds.has(colIdStr);

      // Check if this is a linker column (should be completely hidden from column controls)
      const isLinkerColumn = col.spec.annotations?.['pl7.app/isLinkerColumn'] === 'true';

      // Determine order priority
      const annotations = col.spec.annotations || {};
      let orderPriority = annotations['pl7.app/table/orderPriority'];

      // Check if this is a Clone Label column (label column for clonotype axis)
      const isCloneLabelColumn = col.spec.name === 'pl7.app/label'
        && col.spec.axesSpec.length === 1
        && (col.spec.axesSpec[0].name === 'pl7.app/vdj/clonotypeKey'
          || col.spec.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey');

      // Set highest priority for Clone Label
      if (isCloneLabelColumn) {
        orderPriority = '1000000';
      } else if (isFullProteinSequence(col.spec)) {
        // Set very high priority for full protein sequences (right after Clone Label)
        orderPriority = '999000';
      } else if (isFilterOrRankColumn) {
        // Set priority for filter/ranking columns
        orderPriority = '7000';
      }

      // Determine visibility:
      // - Linker columns: hidden (don't show in column controls at all)
      // - Other columns: default (visible) or optional (hidden by default but can be shown)
      const visibility = isLinkerColumn ? 'hidden' : (isVisible ? 'default' : 'optional');

      const newAnnotations = {
        ...col.spec.annotations,
        'pl7.app/table/visibility': visibility,
        ...(orderPriority && { 'pl7.app/table/orderPriority': orderPriority }),
      };

      // Update axes annotations
      const updatedAxesSpec = col.spec.axesSpec.map((axis) => {
        const isClonotypeAxis = axis.name === 'pl7.app/vdj/clonotypeKey'
          || axis.name === 'pl7.app/vdj/scClonotypeKey';
        const isClusterAxis = axis.name === 'pl7.app/vdj/clusterId';

        // Set high priority on Clonotype axis in ALL columns
        // This ensures the Clonotype ID axis column appears first
        if (isClonotypeAxis) {
          return {
            ...axis,
            annotations: {
              ...axis.annotations,
              'pl7.app/table/orderPriority': '1000000',
            },
          };
        }

        // Hide cluster axes by default unless they match one of the visible cluster axes
        if (isClusterAxis) {
          const shouldBeVisible = visibleClusterAxes.some((visibleAxis: AxisSpec) =>
            clusterAxisDomainsMatch(visibleAxis, axis),
          );

          if (!shouldBeVisible) {
            return {
              ...axis,
              annotations: {
                ...axis.annotations,
                'pl7.app/table/visibility': 'optional',
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

    // Only update cluster column labels if we have multiple clustering blocks
    // Apply this AFTER visibility annotations
    const cols = hasMultipleClusteringBlocks(allColumnsWithVisibility)
      ? updateClusterColumnLabels(allColumnsWithVisibility)
      : allColumnsWithVisibility;

    // Find ranking-order column if present (added by sampling workflow)
    const rankingOrderCol = allColumns.find(
      (col) => col.spec.name === 'pl7.app/vdj/ranking-order',
    );

    const ops: CreatePlDataTableOps = {
      coreColumnPredicate: (col) => col.spec.name === 'pl7.app/vdj/sampling-column',
      coreJoinType: 'inner',
    };

    // If ranking-order column is present, sort by it ascending
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

    return createPlDataTableV2(
      ctx,
      cols,
      ctx.uiState.tableState,
      ops,
    );
  }, { retentive: true, withStatus: true })

  .output('calculating', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return false;

    // If outputs object doesn't exist yet, workflow hasn't been run - not calculating
    if (!ctx.outputs) return false;

    // Check if outputs are currently being computed
    const outputsState = ctx.outputs.getIsReadyOrError();

    // If still computing, return true (actively calculating)
    if (outputsState === false) return true;

    // If errored or ready, we're done calculating
    return false;
  })

  // Use UMAP output from ctx from clonotype-space block
  .output('umapPf', (ctx): PFrameHandle | undefined => {
    const anchor = ctx.args.inputAnchor;
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

    // @TODO: if umap size is > 2 !

    // Get sampled rows from workflow prerun output (if ranking was applied)
    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return createPFrameForGraphs(ctx, [...umap, ...(sampledRows ?? [])]);
  })

  .output('hasClusterData', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return false;

    // Check all available columns (props includes cloneProps, linkProps, and links)
    return hasClusterData(columns.props.map((p) => p.column));
  })

  .output('clusterColumnOptions', (ctx) => {
    const anchor = ctx.args.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
    if (anchorSpec === undefined)
      return undefined;

    // Get linker columns using the same iteration order as util.ts
    // Returns options with ref property for use with PlDropdownRef
    const options: Array<{ label: string; ref: PlRef }> = [];

    for (const idx of [0, 1]) {
      let axesToMatch;
      if (idx === 0) {
        // clonotypeKey in second axis
        axesToMatch = [{}, anchorSpec.axesSpec[1]];
      } else {
        // clonotypeKey in first axis
        axesToMatch = [anchorSpec.axesSpec[1], {}];
      }

      // Get linkers as PlRefs
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

  .title((ctx) => ctx.uiState.title ?? 'Antibody/TCR Leads')

  .sections((_) => {
    return [
      { type: 'link', href: '/', label: 'Main' },
      { type: 'link', href: '/umap', label: 'Clonotype Space' },
      { type: 'link', href: '/spectratype', label: 'CDR3 V Spectratype' },
      { type: 'link', href: '/usage', label: 'V/J gene usage' },
    ];
  })

  .done(2);

export type BlockOutputs = InferOutputsType<typeof model>;

export type { AnchoredColumnId, Filter, FilterUI, RankingOrder, RankingOrderUI };
