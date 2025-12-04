import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  CreatePlDataTableOps,
  InferOutputsType,
  PFrameHandle,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPFrameForGraphs,
  createPlDataTableStateV2,
  createPlDataTableV2,
  deriveLabels,
} from '@platforma-sdk/model';
import type { AnchoredColumnId, Column, Filter, FilterUI, RankingOrder, RankingOrderUI } from './util';
import { anchoredColumnId, getColumns } from './util';
import type { PColumn, PColumnDataUniversal } from '@platforma-sdk/model';

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

export * from './converters';

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes?: number;
  rankingOrder: RankingOrder[];
  rankingOrderDefault?: RankingOrder;
  filters: Filter[];
  kabatNumbering?: boolean;
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
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    rankingOrder: [],
    filters: [],
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

  .output('defaultRankingOrder', (ctx) => {
    const anchor = ctx.args.inputAnchor;
    if (anchor === undefined)
      return undefined;

    return getColumns(ctx)?.defaultRankingOrder;
  })

  .output('rankingOptions', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    return deriveLabels(
      columns.props.filter((c) => c.column.spec.valueType !== 'String'),
      (c) => c.column.spec,
      { includeNativeLabel: true },
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
    }));
  })

  .output('filterOptions', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    return deriveLabels(
      columns.props.filter((c) => c.column.spec.annotations?.['pl7.app/isScore'] === 'true'),
      (c) => c.column.spec,
      { includeNativeLabel: true },
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
      column: o.value.column, // Add column for UI access to spec and discrete values
    }));
  })

  .output('allFilterableOptions', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    return deriveLabels(
      columns.props.filter((c) => {
        // Include numeric columns (like ranking)
        if (c.column.spec.valueType !== 'String') return true;
        // Include string columns with discrete values (categorical filters)
        if (c.column.spec.annotations?.['pl7.app/discreteValues']) return true;
        return false;
      }),
      (c) => c.column.spec,
      { includeNativeLabel: true },
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
      column: o.value.column, // Add column for UI access to spec and discrete values
    }));
  })

  .output('rankingOrderDefault', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    // Use the first score column as default ranking
    const scoreColumns = columns.props.filter((c) =>
      c.column.spec.annotations?.['pl7.app/isScore'] === 'true'
      && c.column.spec.valueType !== 'String',
    );

    if (scoreColumns.length > 0) {
      return {
        id: `default-rank-${scoreColumns[0].column.id}`,
        value: anchoredColumnId(scoreColumns[0]),
        rankingOrder: 'decreasing', // highest scores first
        isExpanded: false,
      };
    }

    // Fall back to any non-string column (like number of samples, counts, etc.)
    const numericColumns = columns.props.filter((c) =>
      c.column.spec.valueType !== 'String',
    );

    if (numericColumns.length > 0) {
      return {
        id: `default-rank-${numericColumns[0].column.id}`,
        value: anchoredColumnId(numericColumns[0]),
        rankingOrder: 'decreasing', // highest counts first
        isExpanded: false,
      };
    }

    // Last resort: use any available column
    if (columns.props.length > 0) {
      return {
        id: `default-rank-${columns.props[0].column.id}`,
        value: anchoredColumnId(columns.props[0]),
        rankingOrder: 'increasing', // default for string columns
        isExpanded: false,
      };
    }

    // Should never reach here if columns exist
    return undefined;
  })

  .output('defaultFilters', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    return columns.defaultFilters;
  })

  .output('pf', (ctx) => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    return createPFrameForGraphs(ctx, columns.props.map((c) => c.column));
  })

  // Use the cdr3LengthsCalculated cols
  .output('spectratypePf', (ctx) => {
    // const pCols = ctx.outputs?.resolve('cdr3VspectratypePf')?.getPColumns();
    const pCols = ctx.prerun?.resolve({
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
    const pCols = ctx.prerun?.resolve({
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

    const props = columns.props.map((c) => c.column);

    // Get filtered/sampled rows from prerun
    const sampledRows = ctx.prerun?.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();

    const assemblingKabatPf = ctx.prerun?.resolve({
      field: 'assemblingKabatPf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();

    let ops: CreatePlDataTableOps = {};
    const cols: Column[] = [];

    // Case where we just opened the block (no filters, no ranking)
    if (sampledRows === undefined) { // case where we have changed parameters but not hit run
      // Only update cluster column labels if we have multiple clustering blocks
      cols.push(...(hasMultipleClusteringBlocks(props)
        ? updateClusterColumnLabels(props)
        : props));
    } else {
      // Use sampled rows if available (ranking applied), otherwise use filtered clonotypes
      const allColumns = [
        ...props,
        ...(sampledRows ?? []),
        ...(assemblingKabatPf ?? []),
      ];
      // Only update cluster column labels if we have multiple clustering blocks
      cols.push(...(hasMultipleClusteringBlocks(allColumns)
        ? updateClusterColumnLabels(allColumns)
        : allColumns));
      ops = {
        coreColumnPredicate: (col) => col.spec.name === 'pl7.app/vdj/sampling-column',
        coreJoinType: 'inner',
      };
    }

    return createPlDataTableV2(
      ctx,
      cols,
      ctx.uiState.tableState,
      ops,
    );
  }, { retentive: true })

  .output('calculating', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return false;

    const sampledReady = ctx.prerun?.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    }) !== undefined;

    let kabatReady = true;
    if (ctx.args.kabatNumbering === true) {
      kabatReady = ctx.prerun?.resolve({
        field: 'assemblingKabatPf',
        assertFieldType: 'Input',
        allowPermanentAbsence: true,
      }) !== undefined;
    }

    return !(sampledReady && kabatReady);
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
    const sampledRows = ctx.prerun?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return createPFrameForGraphs(ctx, [...umap, ...(sampledRows ?? [])]);
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

export type { AnchoredColumnId, Filter, FilterUI, RankingOrder };
