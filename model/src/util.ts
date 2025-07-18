import type {
  DataInfo,
  PColumn,
  PColumnValues,
  PlRef,
  PlTableFilter,
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

export type RankingOrderUI = RankingOrder & {
  id?: string;
  isExpanded?: boolean;
};

export type Filter = {
  value?: AnchoredColumnId;
  filter?: PlTableFilter;
};

export type FilterUI = Filter & {
  id?: string;
  isExpanded?: boolean;
};

export type PlTableFiltersDefault = {
  column: AnchoredColumnId;
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
    const valueString = score.column.spec.annotations?.['pl7.app/score/defaultCutoff'];
    if (valueString === undefined) continue;

    const spec = score.column.spec;
    if (spec.valueType === 'String') {
      try {
        const value = JSON.parse(valueString) as string[];
        // should be an array of strings
        if (!Array.isArray(value)) {
          console.error('defaultFilters: invalid string filter', valueString);
          continue;
        }
        defaultFilters.push({
          column: anchoredColumnId(score),
          default: {
            type: 'string_equals',
            reference: value[0], // @TODO: support multiple values
          },
        });
      } catch (e) {
        console.error('defaultFilters: invalid string filter', valueString, e);
        continue;
      }
    } else {
      try {
        // Assuming non-String valueType implies a number
        const numericValue = parseFloat(valueString);
        if (isNaN(numericValue)) {
          console.error('defaultFilters: invalid numeric value', valueString);
          continue;
        }

        const direction = spec.annotations?.['pl7.app/score/rankingOrder'] ?? 'increasing';
        if (direction !== 'increasing' && direction !== 'decreasing') {
          console.error('defaultFilters: invalid ranking order', direction);
          continue;
        }

        defaultFilters.push({
          column: anchoredColumnId(score),
          default: {
            type: direction === 'increasing' ? 'number_greaterThanOrEqualTo' : 'number_lessThanOrEqualTo',
            reference: numericValue,
          },
        });
      } catch (e) {
        console.error('defaultFilters: invalid numeric value', valueString, e);
        continue;
      }
    }
  }

  return {
    props: [...links, ...cloneProps, ...linkProps],
    scores: scores,
    defaultFilters: defaultFilters,
    defaultRankingOrder: scores
      .filter((s) => s.column.spec.valueType !== 'String')
      .map((s) => ({
        id: `default-rank-${s.column.id}`,
        value: anchoredColumnId(s),
        rankingOrder: 'increasing',
        isExpanded: false,
      })),
  };
}
