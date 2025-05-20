import type { GraphMakerState } from '@milaboratories/graph-maker';
import type {
  CreatePlDataTableOps,
  DataInfo,
  InferOutputsType,
  PColumn,
  PColumnValues,
  PFrameHandle,
  PlDataTableState,
  PlMultiSequenceAlignmentModel,
  PlRef,
  PlTableFilter,
  PlTableFiltersModel,
  PTableColumnId,
  RenderCtx,
  SUniversalPColumnId,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPFrameForGraphs,
  createPlDataTableV2,
} from '@platforma-sdk/model';

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes?: number;
  rankingOrder: SUniversalPColumnId[];
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel: PlTableFiltersModel;
  graphStateUMAP: GraphMakerState;
  cdr3StackedBarPlotState: GraphMakerState;
  alignmentModel: PlMultiSequenceAlignmentModel;
};

type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor | PColumnValues>;

type PlTableFiltersDefault = {
  column: PTableColumnId;
  default: PlTableFilter;
};

type Columns = {
  props: Column[];
  scores: Column[];
  links: Column[];
  defaultFilters: PlTableFiltersDefault[];
};

function getColumns(ctx: RenderCtx<BlockArgs, UiState>): Columns | undefined {
  const anchor = ctx.args.inputAnchor;
  if (anchor === undefined)
    return undefined;

  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
  if (anchorSpec === undefined)
    return undefined;

  // all clone properties
  const props = (ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{ anchor: 'main', idx: 1 }],
      },
    ]) ?? [])
    .filter((p) => p.spec.annotations?.['pl7.app/sequence/isAnnotation'] !== 'true');

  // const abundance = ctx.resultPool.getAnchoredPColumns(
  //   { main: anchor },
  //   [
  //     {
  //       axes: [{ anchor: 'main', idx: 0 }, { anchor: 'main', idx: 1 }],
  //       annotations: { 'pl7.app/isAbundance': 'true' },
  //     },
  //   ],
  // ) ?? [];

  // linker columns
  const links: Column[] = [];
  const linkProps: Column[] = [];
  for (const idx of [0, 1]) {
    let axesToMatch;
    if (idx === 0) {
      // clonotypeKey in second axis
      axesToMatch = [{}, { anchor: 'main', idx: 1 }];
    } else {
      // clonotypeKey in first axis
      axesToMatch = [{ anchor: 'main', idx: 1 }, {}];
    }

    const l = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: axesToMatch,
          annotations: { 'pl7.app/isLinkerColumn': 'true' },
        },
      ],
    ) ?? [];

    links.push(...l);

    for (const link of l) {
      linkProps.push(...ctx.resultPool.getAnchoredPColumns(
        { linker: link.spec },
        [
          {
            axes: [{ anchor: 'linker', idx: idx }],
          },
        ],
      ) ?? []);
    }
  }

  // score columns
  const cloneScores = props?.filter((p) => p.spec.annotations?.['pl7.app/isScore'] === 'true');

  // links score columns
  const linkScores = linkProps?.filter((p) => p.spec.annotations?.['pl7.app/isScore'] === 'true');

  // @TODO: remove this hack once the bug with excessive labels is fixed
  for (const arr of [props, links, linkProps]) {
    for (const c of arr) {
      if (c.spec.annotations) {
        const label = c.spec.annotations['pl7.app/label'] ?? '';
        c.spec.annotations['pl7.app/label'] = label.split('/')[0] ?? label;
      }
    }
  }

  // make clonotype key visible by default
  for (const arr of [props, links, linkProps]) {
    for (const c of arr) {
      if (c.spec.annotations) {
        const cloneKeyAxis = c.spec.axesSpec.find((s) => s.name === anchorSpec.axesSpec[1].name);
        if (cloneKeyAxis !== undefined) {
          if (cloneKeyAxis.annotations) {
            cloneKeyAxis.annotations['pl7.app/table/visibility'] = 'default';
          }
        }
      }
    }
  }

  // calculate default filters
  const scores = [...cloneScores, ...linkScores];
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const value = score.spec.annotations?.['pl7.app/vdj/score/default'];

    if (value !== undefined) {
      const type = score.spec.valueType === 'String' ? 'string_equals' : 'number_greaterThan';
      defaultFilters.push({
        column: {
          type: 'column',
          id: score.id,
        },
        default: {
          type: type,
          reference: value as never,
        },
      });
    }
  }

  return {
    props: [...links, ...props, ...linkProps],
    links: links,
    scores: scores,
    defaultFilters: defaultFilters,
  };
}

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    rankingOrder: [],
  })

  .withUiState<UiState>({
    title: 'Top Antibodies',
    tableState: {
      gridState: {},
    },
    filterModel: {},
    graphStateUMAP: {
      title: 'UMAP',
      template: 'dots',
      layersSettings: {
        dots: {
          dotFill: '#99E099',
        },
      },
    },
    cdr3StackedBarPlotState: {
      title: 'CDR3 V Spectratype',
      template: 'stackedBar',
      currentTab: null,
    },
    alignmentModel: {},
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

  .output('scoreColumns', (ctx) => {
    return getColumns(ctx)?.scores;
  })

  .output('defaultFilters', (ctx) => {
    return getColumns(ctx)?.defaultFilters;
  })

  .output('__TEMP__OUTPUT__', (ctx) => {
    return getColumns(ctx);
  })

  .output('rankingOptions', (ctx) => {
    const anchor = ctx.args.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const allowedOptions = ctx.resultPool.getCanonicalOptions({ main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          type: ['Int', 'Long', 'Double', 'Float'],
        },
      ],
    );

    if (allowedOptions === undefined)
      return undefined;

    // Using this columns causes error right now
    // @TODO: fix this
    // linker columns
    // for (const idx of [0, 1]) {
    //   let axesToMatch;
    //   if (idx === 0) {
    //     // clonotypeKey in second axis
    //     axesToMatch = [{}, { anchor: 'main', idx: 1 }];
    //   } else {
    //     // clonotypeKey in first axis
    //     axesToMatch = [{ anchor: 'main', idx: 1 }, {}];
    //   }

    //   const l = ctx.resultPool.getAnchoredPColumns(
    //     { main: anchor },
    //     [
    //       {
    //         axes: axesToMatch,
    //         annotations: { 'pl7.app/isLinkerColumn': 'true' },
    //       },
    //     ],
    //   ) ?? [];

    //   for (const link of l) {
    //     allowedOptions.push(...ctx.resultPool.getCanonicalOptions(
    //       { linker: link.spec },
    //       [
    //         {
    //           axes: [{ anchor: 'linker', idx: idx }],
    //           type: ['Int', 'Long', 'Double', 'Float'],
    //         },
    //       ],
    //     ) ?? []);
    //   }
    // }

    return allowedOptions;
  })

  .output('test', (ctx) => {
    const anchor = ctx.args.inputAnchor;
    if (anchor === undefined)
      return undefined;

    return anchor;
  })
/* 
  .output('pf', (ctx) => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    return createPFrameForGraphs(ctx, [...columns.props, ...columns.links]);
  })
 */

  .output('pf', (ctx) => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;
    return createPFrameForGraphs(ctx, columns.props);
  })

  // Use the cdr3LengthsCalculated cols
  .output('spectratypePf', (ctx) => {
    const pcols = ctx.outputs?.resolve('cdr3VspectratypePf')?.getPColumns();
    if (!pcols) return undefined;

    return createPFrameForGraphs(ctx, pcols);
  })

  .output('table', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    // we wont compute the workflow output in cases where ctx.args.topClonotypes == undefined
    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', allowPermanentAbsence: true })?.getPColumns();
    let ops: CreatePlDataTableOps = {
      filters: ctx.uiState.filterModel.filters,
    };
    const cols: Column[] = [];
    if (ctx.args.topClonotypes === undefined) {
      cols.push(...columns.props);
      ops = {
        filters: ctx.uiState.filterModel.filters,
      };
    } else if (sampledRows === undefined) {
      return undefined;
    } else {
      cols.push(...columns.props, ...sampledRows);
      ops = {
        filters: ctx.uiState.filterModel.filters,
        coreColumnPredicate: (spec) => spec.name === 'pl7.app/vdj/sampling-column',
        coreJoinType: 'inner',
      };
    }

    const maxAxes = columns.props.reduce((acc, curr) => Math.max(acc, curr.spec.axesSpec.length), 0);
    return createPlDataTableV2(
      ctx,
      cols,
      // if there are links, we need need to pick one of the links to show all axes in the table
      (spec) => spec.axesSpec.length == maxAxes,
      ctx.uiState.tableState,
      ops,
    );
  })

  .output('UMAPPf', (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve('umap')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }

    // Get the selected rows if any
    const sampledRowsUmap = ctx.outputs?.resolve({ field: 'sampledRowsUmap',
      allowPermanentAbsence: true })?.getPColumns();
    if (sampledRowsUmap === undefined) {
      return createPFrameForGraphs(ctx, [...pCols]);
    }

    return createPFrameForGraphs(ctx, [...pCols, ...sampledRowsUmap]);
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title((ctx) => ctx.uiState.title ?? 'Top Antibodies')

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
    { type: 'link', href: '/umap', label: 'Clonotype UMAP' },
    { type: 'link', href: '/spectratype', label: 'CDR3 V Spectratype' },
    //  { type: 'link', href: '/usage', label: 'V/J gene usage' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
