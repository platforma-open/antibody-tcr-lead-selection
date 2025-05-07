import type {
  ColumnJoinEntry,
  DataInfo,
  InferOutputsType,
  PColumn,
  PColumnSpec,
  PColumnValues,
  PlDataTableState, PlRef, PlTableFilter, PlTableFiltersModel,
  PObjectId,
  PTableColumnId,
  PTableDef,
  PTableHandle,
  PTableSorting,
  PUniversalColumnSpec,
  RenderCtx,
  SUniversalPColumnId,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import { BlockModel, createPlDataTableV2, isLabelColumn } from '@platforma-sdk/model';

export type ListOption<T> = {
  label: string;
  value: T;
};

export type AlignmentModel = {
  label?: PObjectId;
  filterColumn?: PColumn<PColumnValues>;
};

export type BlockArgs = {
  inputAnchor?: PlRef;
  topClonotypes?: number;
  rankingOrder: SUniversalPColumnId[];
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel: PlTableFiltersModel;
  alignmentTableState: AlignmentModel;
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
  const props = ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{ anchor: 'main', idx: 1 }],
      },
    ]) ?? [];

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
  const cloneScores = props?.filter((p) => p.spec.annotations?.['pl7.app/vdj/isScore'] === 'true');

  // links score columns
  const linkScores = linkProps?.filter((p) => p.spec.annotations?.['pl7.app/vdj/isScore'] === 'true');

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

  for (const score of cloneScores) {
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

export function isSequenceColumn(column: PUniversalColumnSpec): boolean {
  if (!(column.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'))
    return false;

  const isBulkSequence = (column: PUniversalColumnSpec) =>
    column.domain?.['pl7.app/alphabet'] === 'aminoacid';
  const isSingleCellSequence = (column: PUniversalColumnSpec) =>
    column.domain?.['pl7.app/vdj/scClonotypeChain/index'] === 'primary'
    && column.axesSpec.length >= 1
    && column.axesSpec[1].name === 'pl7.app/vdj/scClonotypeKey';

  return isBulkSequence(column) || isSingleCellSequence(column);
}

function createAlignmentTableDef(
  columns: Column[],
  label: Column,
  filterColumn: PColumn<PColumnValues>,
): PTableDef<PColumn<TreeNodeAccessor | PColumnValues | DataInfo<TreeNodeAccessor>>> | undefined {
  const sequenceColumns = columns.filter((c) => isSequenceColumn(c.spec));
  if (sequenceColumns.length === 0)
    throw new Error('No sequence columns found');

  return {
    src: {
      type: 'outer',
      primary: {
        type: 'inner',
        entries: [
          {
            type: 'column',
            column: filterColumn,
          } satisfies ColumnJoinEntry<Column>,
          ...sequenceColumns.map((c) => ({
            type: 'column',
            column: c,
          } satisfies ColumnJoinEntry<Column>)),
        ].filter((e): e is ColumnJoinEntry<Column> => e !== undefined),
      },
      secondary: [{
        type: 'column',
        column: label,
      } satisfies ColumnJoinEntry<Column>],
    },
    filters: [],
    sorting: sequenceColumns.map((c) => ({
      column: {
        type: 'column',
        id: c.id,
      },
      ascending: true,
      naAndAbsentAreLeastValues: true,
    } satisfies PTableSorting)),
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
    alignmentTableState: {},
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
    }]),
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

    return ctx.resultPool.getCanonicalOptions({ main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          type: ['Int', 'Long', 'Long', 'Float'],
        },
      ],
    );
  })

  .output('test', (ctx) => {
    const anchor = ctx.args.inputAnchor;
    if (anchor === undefined)
      return undefined;

    return anchor;
  })

// .output('alignmentLabelOptions', (ctx) => {
//   return ctx.resultPool.getCanonicalOptions(
//     // what should be here? argumants are the same as for `ctx.resultPool.getAnchoredPColumns`
//   );
// })

// .output('pf', (ctx) => {
//   const columns = getColumns(ctx);
//   if (columns === undefined)
//     return undefined;

//   return createPFrameForGraphs(ctx, columns.props);
// })

  .output('table', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    const Xtemp = ctx.outputs?.resolve('sampledColumns')?.getPColumns();
    const cols: Column[] = [];
    if (ctx.args.topClonotypes === undefined) {
      cols.push(...columns.props);
    } else if (Xtemp === undefined) {
      return undefined;
    } else
      cols.push(...columns.props, ...Xtemp);

    return createPlDataTableV2(
      ctx,
      cols,
      // if there are links, we need need to pick one of the links to show all axes in the table
      (spec) => columns.links?.length > 0 ? spec.axesSpec.length == 2 : true,
      ctx.uiState.tableState,
      {
        filters: ctx.uiState.filterModel.filters,
        coreJoinType: 'inner',
      },
    );
  })

  .output('alignmentLabelOptions', (ctx): ListOption<PObjectId>[] | undefined => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    return columns.props
      // TODO: rewrite to correct predicate
      .filter((c) => isLabelColumn(c.spec) && c.spec.axesSpec[0].annotations?.['pl7.app/label'] === 'Clonotype key')
      .map((c) => ({
        label: c.spec.annotations?.['pl7.app/label'] ?? '',
        value: c.id,
      }));
  })

  .output('sequenceColumns', (ctx): PColumnSpec[] | undefined => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    return columns.props.map((c) => c.spec).filter(isSequenceColumn);
  })

  .output('alignmentTable', (ctx): PTableHandle | undefined => {
    const columns = getColumns(ctx);
    if (!columns) return undefined;

    const labelId = ctx.uiState.alignmentTableState.label;
    if (!labelId) return undefined;

    const label = columns.props.find((c) => c.id === labelId);
    if (!label) return undefined;

    const filterColumn = ctx.uiState.alignmentTableState.filterColumn;
    if (!filterColumn) return undefined;
    const def = createAlignmentTableDef(columns.props, label, filterColumn);
    if (!def) return undefined;

    return ctx.createPTable(def);
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title((ctx) => ctx.uiState.title ?? 'Top Antibodies')

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
    { type: 'link', href: '/umap', label: 'Clonotype UMAP' },
    { type: 'link', href: '/spectratype', label: 'CDR3 Spectratype' },
    { type: 'link', href: '/usage', label: 'V/J gene usage' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
