<script setup lang="ts" >
import type { RankingOrder } from '@platforma-open/milaboratories.top-antibodies.model';
import type {
  SUniversalPColumnId,
} from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlDropdown } from '@platforma-sdk/ui-vue';
import './metrics-manager.scss';

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
  options?: ListOption<SUniversalPColumnId>[];
}>();
</script>

<template>
  <div class="d-flex flex-column gap-24">
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
        Increasing to pick candidates with higher column values, decreasing to pick candidates with lower values.
      </template>
    </PlDropdown>
  </div>
</template>
