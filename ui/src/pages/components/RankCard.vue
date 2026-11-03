<script setup lang="ts">
import type {
  ScopedColumnId,
  WeightedRankingOrderUI,
} from "@platforma-open/milaboratories.top-antibodies.model";
import { DEFAULT_RANKING_WEIGHT } from "@platforma-open/milaboratories.top-antibodies.model";
import type { ListOption } from "@platforma-sdk/ui-vue";
import { PlDropdown } from "@platforma-sdk/ui-vue";
import { copyOptionValue } from "../../util";

const rankingOrderOptions = [
  { value: "increasing", label: "Lowest" },
  { value: "decreasing", label: "Highest" },
];

const model = defineModel<WeightedRankingOrderUI>({
  default: {
    rankingOrder: "increasing",
    weight: DEFAULT_RANKING_WEIGHT,
  },
});

const props = defineProps<{
  options?: ListOption<ScopedColumnId>[];
}>();
</script>

<template>
  <PlDropdown
    :model-value="model.value"
    :options="props.options"
    label="Rank by"
    required
    @update:model-value="(v) => (model.value = copyOptionValue(v))"
  />

  <PlDropdown
    v-model="model.rankingOrder"
    :options="rankingOrderOptions"
    label="Take from"
    required
  >
    <template #tooltip>
      Rank rows by a specific column value and decide whether to keep the Lowest or Highest.
    </template>
  </PlDropdown>
</template>
