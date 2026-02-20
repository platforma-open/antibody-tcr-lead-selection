import type { Filter, FilterUI, RankingOrder, RankingOrderUI } from './types';

export function convertRankingOrderUI(rankingOrder: RankingOrderUI[]): RankingOrder[] {
  return rankingOrder.map((item) => ({
    value: item.value,
    rankingOrder: item.rankingOrder,
  }));
}

export function convertFilterUI(filters: FilterUI[]): Filter[] {
  return filters.map((item) => ({
    value: item.value,
    filter: item.filter,
  }));
}
