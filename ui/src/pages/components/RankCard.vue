<script setup lang="ts" >
import type { AnchoredColumnId, RankingOrder } from '@platforma-open/milaboratories.top-antibodies.model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlDropdown } from '@platforma-sdk/ui-vue';

const rankingOrderOptions = [
  { value: 'increasing', label: 'Lowest' },
  { value: 'decreasing', label: 'Highest' },
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
    label="Take from"
    required
  >
    <template #tooltip>
      Rank rows by a specific column value and decide whether to keep the Lowest or Highest.
    </template>
  </PlDropdown>
</template>
