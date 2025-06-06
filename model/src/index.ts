import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  CreatePlDataTableOps,
  InferOutputsType,
  PFrameHandle,
  PlDataTableState,
  PlMultiSequenceAlignmentModel,
  PlRef,
  PlTableFiltersModel,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPFrameForGraphs,
  createPlDataTableV2,
  deriveLabels,
} from '@platforma-sdk/model';
import type { AnchoredColumnId, Column, RankingOrder } from './util';
import { anchoredColumnId, getColumns } from './util';

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes?: number;
  rankingOrder: RankingOrder[];
  rankingOrderDefault?: RankingOrder;
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel: PlTableFiltersModel;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  vjUsagePlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    rankingOrder: [],
  })

  .withUiState<UiState>({
    title: 'Antibody/TCR Leads',
    tableState: {
      gridState: {},
    },
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
    filterModel: {},
  })

  // Activate "Run" button only after these conditions are satisfied
  .argsValid((ctx) => (ctx.args.inputAnchor !== undefined),
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
    ).map((o) => ({
      ...o,
      value: anchoredColumnId(o.value),
    }));
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

    // we wont compute the workflow output in cases where ctx.args.topClonotypes == undefined
    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', allowPermanentAbsence: true })?.getPColumns();
    let ops: CreatePlDataTableOps = {
      filters: ctx.uiState.filterModel.filters,
    };
    const cols: Column[] = [];
    if (ctx.args.topClonotypes === undefined) {
      cols.push(...props);
      ops = {
        filters: ctx.uiState.filterModel.filters,
      };
    } else if (sampledRows === undefined) {
      return undefined;
    } else {
      cols.push(...props, ...sampledRows);
      ops = {
        filters: ctx.uiState.filterModel.filters,
        coreColumnPredicate: (spec) => spec.name === 'pl7.app/vdj/sampling-column',
        coreJoinType: 'inner',
      };
    }

    const maxAxes = props.reduce((acc, curr) => Math.max(acc, curr.spec.axesSpec.length), 0);
    return createPlDataTableV2(
      ctx,
      cols,
      // if there are links, we need need to pick one of the links to show all axes in the table
      (spec) => spec.axesSpec.length == maxAxes,
      ctx.uiState.tableState,
      ops,
    );
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

    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', allowPermanentAbsence: true })?.getPColumns();

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

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type { AnchoredColumnId, RankingOrder };
