import type {
  DataInfo,
  InferOutputsType,
  PColumn,
  PlDataTableState, PlRef, PlTableFilter, PlTableFiltersModel,
  PTableColumnId,
  RenderCtx,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import { BlockModel, createPlDataTableV2 } from '@platforma-sdk/model';

export type BlockArgs = {
  inputAnchor?: PlRef;
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel: PlTableFiltersModel;
};

type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor>;

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
  const links = ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{}, { anchor: 'main', idx: 1 }],
        annotations: { 'pl7.app/isLinkerColumn': 'true' },
      },
    ],
  ) ?? [];

  const linkProps: Column[] = [];
  for (const link of links ?? []) {
    linkProps.push(...ctx.resultPool.getAnchoredPColumns(
      { linker: link.spec },
      [
        {
          axes: [{ anchor: 'linker', idx: 0 }],
        },
      ],
    ) ?? []);
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

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
  })

  .withUiState<UiState>({
    title: 'Top Antibodies',
    tableState: {
      gridState: {},
    },
    filterModel: {},
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

  .output('table', (ctx) => {
    const columns = getColumns(ctx);
    if (columns === undefined)
      return undefined;

    return createPlDataTableV2(
      ctx,
      columns.props,
      // if there are links, we need need to pick one of the links to show all axes in the table
      (spec) => columns.links?.length > 0 ? spec.axesSpec.length == 2 : true,
      ctx.uiState.tableState,
      ctx.uiState.filterModel,
    );
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title((ctx) => ctx.uiState.title ?? 'Top Antibodies')

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
