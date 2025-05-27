import type {
  DataInfo,
  PColumn,
  PColumnValues,
  PlRef,
  PlTableFilter,
  PTableColumnId,
  RenderCtx,
  SUniversalPColumnId,
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import type { BlockArgs, UiState } from '.';

// @todo: move this type to SDK
export type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor | PColumnValues>;

export type AnchoredColumn = {
  anchorRef: PlRef;
  anchorName: string;
  column: Column;
};

export type AnchoredColumnId = {
  anchorRef: PlRef;
  anchorName: string;
  column: SUniversalPColumnId;
};

export function anchoredColumnId(anchoredColumn: AnchoredColumn): AnchoredColumnId {
  return { ...anchoredColumn, column: anchoredColumn.column.id as SUniversalPColumnId };
}

export type RankingOrder = {
  value?: AnchoredColumnId;
  rankingOrder: 'increasing' | 'decreasing';
};

export type PlTableFiltersDefault = {
  column: PTableColumnId;
  default: PlTableFilter;
};

export type Columns = {
  // all props: clones + linked
  props: AnchoredColumn[];
  scores: AnchoredColumn[];
  defaultFilters: PlTableFiltersDefault[];
  defaultRankingOrder: RankingOrder[];
};

export function getColumns(ctx: RenderCtx<BlockArgs, UiState>): Columns | undefined {
  const anchor = ctx.args.inputAnchor;
  if (anchor === undefined)
    return undefined;

  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
  if (anchorSpec === undefined)
    return undefined;

  // all clone properties
  const cloneProps = (ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{ anchor: 'main', idx: 1 }],
      },
    ]) ?? [])
    .filter((p) =>
      p.spec.annotations?.['pl7.app/sequence/isAnnotation'] !== 'true',
    )
    .map((p) => ({ anchorRef: anchor, anchorName: 'main', column: p }));

  // links to use in table
  const links: AnchoredColumn[] = [];

  // linker columns
  const linkProps: AnchoredColumn[] = [];
  let i = 0;
  for (const idx of [0, 1]) {
    let axesToMatch;
    if (idx === 0) {
      // clonotypeKey in second axis
      axesToMatch = [{}, anchorSpec.axesSpec[1]];
    } else {
      // clonotypeKey in first axis
      axesToMatch = [anchorSpec.axesSpec[1], {}];
    }
    // save linkers to use in table
    links.push(...(ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: axesToMatch,
          annotations: { 'pl7.app/isLinkerColumn': 'true' },
        },
      ],
    ) ?? []).map((c) => ({ anchorRef: anchor, anchorName: 'main', column: c })));

    // get linkers as PlRefs to use in the workflow
    const linkers = ctx.resultPool.getOptions([
      {
        axes: axesToMatch,
        annotations: { 'pl7.app/isLinkerColumn': 'true' },
      },
    ]);

    for (const link of linkers) {
      const anchorName = 'linker-' + i;
      const anchorSpec: Record<string, PlRef> = {};
      anchorSpec[anchorName] = link.ref;

      const props = ctx.resultPool.getAnchoredPColumns(
        anchorSpec,
        [
          {
            axes: [{ anchor: anchorName, idx: idx }],
          },
        ],
      ) ?? [];
      linkProps.push(...props.map((p) => ({ anchorRef: link.ref, anchorName, column: p })));
      i++;
    }
  }

  // score columns
  const cloneScores = cloneProps?.filter((p) => p.column.spec.annotations?.['pl7.app/isScore'] === 'true');

  // links score columns
  const linkScores = linkProps?.filter((p) => p.column.spec.annotations?.['pl7.app/isScore'] === 'true');

  // calculate default filters
  const scores = [...cloneScores, ...linkScores];
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const value = score.column.spec.annotations?.['pl7.app/vdj/score/default'];

    if (value !== undefined) {
      const type = score.column.spec.valueType === 'String' ? 'string_equals' : 'number_greaterThan';
      defaultFilters.push({
        column: {
          type: 'column',
          id: score.column.id,
        },
        default: {
          type: type,
          reference: value as never,
        },
      });
    }
  }

  return {
    props: [...links, ...cloneProps, ...linkProps],
    scores: scores,
    defaultFilters: defaultFilters,
    defaultRankingOrder: scores
      .filter((s) => s.column.spec.valueType !== 'String')
      .map((s) => ({
        value: anchoredColumnId(s),
        rankingOrder: 'increasing',
      })),
  };
}
