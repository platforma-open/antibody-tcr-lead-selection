<script setup lang="ts" >
import type { AnchoredColumnId, RankingOrder } from '@platforma-open/milaboratories.top-antibodies.model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlDropdown } from '@platforma-sdk/ui-vue';

const rankingOrderOptions = [
  { value: 'increasing', label: 'Increasing' },
  { value: 'decreasing', label: 'Decreasing' },
];

const model = defineModel<RankingOrder>(
  {
    default: {
      rankingOrder: 'increasing',
    },
  });

const props = defineProps<{
  options?: ListOption<AnchoredColumnId>[];
}>();
</script>

<template>
  <PlDropdown
    v-model="model.value" :options="props.options"
    label="Rank by"
    required
  />

  <PlDropdown
    v-model="model.rankingOrder" :options="rankingOrderOptions"
    label="Ranking order"
    required
  >
    <template #tooltip>
      Decreasing to pick candidates with higher column values, increasing to pick candidates with lower values.
    </template>
  </PlDropdown>
</template>
