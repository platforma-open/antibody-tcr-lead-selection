import type { Filter, FilterUI, RankingOrder, RankingOrderArg, RankingOrderUI } from "./types";
import { DEFAULT_RANKING_WEIGHT, normalizeWeights } from "./util";

/** Narrows ranking rows to what the workflow reads, weights normalized across the list. */
export function convertRankingOrderUI(rankingOrder: RankingOrderUI[]): RankingOrderArg[] {
  const weightNorms = normalizeWeights(
    rankingOrder.map((item) => item.weight ?? DEFAULT_RANKING_WEIGHT),
  );
  return rankingOrder.map((item, i) => ({
    value: item.value,
    rankingOrder: item.rankingOrder,
    weightNorm: weightNorms[i],
  }));
}

/** As {@link convertRankingOrderUI}, keeping `weight` so a template round-trips it. */
export function convertRankingOrderUIForParams(rankingOrder: RankingOrderUI[]): RankingOrder[] {
  return rankingOrder.map((item) => ({
    value: item.value,
    rankingOrder: item.rankingOrder,
    weight: item.weight,
  }));
}

export function convertFilterUI(filters: FilterUI[]): Filter[] {
  return filters.map((item) => ({
    value: item.value,
    filter: item.filter,
  }));
}
