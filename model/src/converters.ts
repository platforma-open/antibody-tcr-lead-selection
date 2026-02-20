import type { PlRef, SUniversalPColumnId } from '@platforma-sdk/model';
import type { PlAdvancedFilter } from '@platforma-sdk/ui-vue';
import type { AnchoredColumnId, Filter, RankingOrder, RankingOrderUI } from './util';

export function convertRankingOrderUI(rankingOrder: RankingOrderUI[]): RankingOrder[] {
  return rankingOrder.map((item) => ({
    value: item.value,
    rankingOrder: item.rankingOrder,
  }));
}

/**
 * Flatten a PlAdvancedFilter tree into a flat Filter[] for the workflow args.
 * Only extracts leaf filters (ignoring AND/OR/NOT grouping since the workflow
 * only supports flat AND semantics).
 */
export function convertFilterTree(
  filterModel: PlAdvancedFilter,
  filterColumnAnchors: Record<string, { anchorRef: PlRef; anchorName: string }>,
): Filter[] {
  const result: Filter[] = [];
  collectLeaves(filterModel, filterColumnAnchors, result);
  return result;
}

// Use Record<string, unknown> to avoid depending on internal PlAdvancedFilter node types
// (only RootFilter and PlAdvancedFilterItem are exported). We check shape at runtime.
type FilterNode = Record<string, unknown>;

function collectLeaves(
  node: FilterNode,
  anchorMap: Record<string, { anchorRef: PlRef; anchorName: string }>,
  result: Filter[],
): void {
  if ('filters' in node && Array.isArray(node.filters)) {
    // Group node (and/or/not) — recurse into children
    for (const child of node.filters as FilterNode[]) {
      collectLeaves(child, anchorMap, result);
    }
    return;
  }

  // Leaf filter
  const leaf = node as { type: string; column?: SUniversalPColumnId; x?: number; value?: string | string[]; n?: number };
  if (!leaf.column) return;

  const columnId = leaf.column as string;
  const anchor = anchorMap[columnId];
  if (!anchor) return; // Skip filters with unknown columns

  const anchoredId: AnchoredColumnId = {
    anchorRef: anchor.anchorRef,
    anchorName: anchor.anchorName,
    column: leaf.column,
  };

  const filter = mapLeafToWorkflowFilter(leaf);
  if (filter === undefined) return;

  result.push({
    value: anchoredId,
    filter,
  });
}

function mapLeafToWorkflowFilter(
  leaf: { type: string; column?: SUniversalPColumnId; x?: number; value?: string | string[]; n?: number },
): Filter['filter'] {
  const column = leaf.column!;
  switch (leaf.type) {
    case 'greaterThan':
      return { type: 'greaterThan', column, x: leaf.x ?? 0 };
    case 'greaterThanOrEqual':
      return { type: 'greaterThanOrEqual', column, x: leaf.x ?? 0 };
    case 'lessThan':
      return { type: 'lessThan', column, x: leaf.x ?? 0 };
    case 'lessThanOrEqual':
      return { type: 'lessThanOrEqual', column, x: leaf.x ?? 0 };
    case 'equal':
      return { type: 'equal', column, x: leaf.x ?? 0 };
    case 'notEqual':
      return { type: 'notEqual', column, x: leaf.x ?? 0 };
    case 'patternEquals':
      return { type: 'patternEquals', column, value: (leaf.value as string) ?? '' };
    case 'patternNotEquals':
      return { type: 'patternNotEquals', column, value: (leaf.value as string) ?? '' };
    case 'inSet':
      return { type: 'inSet', column, value: (leaf.value as string[]) ?? [] };
    case 'notInSet':
      return { type: 'notInSet', column, value: (leaf.value as string[]) ?? [] };
    default:
      return undefined;
  }
}
