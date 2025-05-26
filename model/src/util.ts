import type {
    DataInfo,
    PColumn,
    PColumnValues,
    PlTableFilter,
    PTableColumnId,
    RenderCtx,
    SUniversalPColumnId,
    TreeNodeAccessor,
} from '@platforma-sdk/model';
import type { BlockArgs, UiState } from '.';

export type Column = PColumn<DataInfo<TreeNodeAccessor> | TreeNodeAccessor | PColumnValues>;

export type RankingOrder = {
  value?: SUniversalPColumnId;
  rankingOrder: 'increasing' | 'decreasing';
};

export type PlTableFiltersDefault = {
  column: PTableColumnId;
  default: PlTableFilter;
};

export type Columns = {
  props: Column[];
  scores: Column[];
  links: Column[];
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
  const props = (ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{ anchor: 'main', idx: 1 }],
      },
    ]) ?? [])
    .filter((p) =>
      p.spec.annotations?.['pl7.app/sequence/isAnnotation'] !== 'true'
      && p.spec.annotations?.['pl7.app/isLinkerColumn'] !== 'true');

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
    defaultRankingOrder: scores
      .filter((s) => s.spec.valueType !== 'String')
      .map((s) => ({
        value: s.id as SUniversalPColumnId,
        rankingOrder: 'increasing',
      })),
  };
}
