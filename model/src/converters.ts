import type { RankingOrder, RankingOrderUI } from './util';

export function convertRankingOrderUI(rankingOrder: RankingOrderUI[]): RankingOrder[] {
  return rankingOrder.map((item) => ({
    value: item.value,
    rankingOrder: item.rankingOrder,
  }));
}
