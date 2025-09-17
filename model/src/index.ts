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

export * from './converters';

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes?: number;
  rankingOrder: RankingOrder[];
  rankingOrderDefault?: RankingOrder;
  filters: Filter[];
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
    const pCols = ctx.outputs?.resolve('cdr3VspectratypePf')?.getPColumns();
    if (!pCols) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .output('vjUsagePf', (ctx) => {
    const pCols = ctx.outputs?.resolve('vjUsagePf')?.getPColumns();
    if (!pCols) return undefined;

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

    let ops: CreatePlDataTableOps = {};
    const cols: Column[] = [];

    // Case where we just opened the block (no filters, no ranking)
    if (sampledRows === undefined) { // case where we have changed parameters but not hit run
      cols.push(...props);
    } else {
      // Use sampled rows if available (ranking applied), otherwise use filtered clonotypes
      cols.push(...props, ...sampledRows);
      ops = {
        coreColumnPredicate: (spec) => spec.name === 'pl7.app/vdj/sampling-column',
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

  .output('calculating', (ctx) => ctx.args.inputAnchor !== undefined
    && ctx.prerun?.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    }) === undefined)

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
