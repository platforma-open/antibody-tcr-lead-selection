<script setup lang="ts" generic="T = unknown">
import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref, watch } from 'vue';
import { useApp } from '../../app';
import RankCard from './RankCard.vue';

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `rank-${idCounter.value}-${Date.now()}`;
};

const getMetricLabel = (value: AnchoredColumnId | undefined) => {
  const column = app.model.outputs.rankingOptions?.find(
    (option) => option && option.value.column === value?.column,
  );
  return column?.label ?? 'Set rank';
};

const addRankColumn = () => {
  app.updateArgs((args) => {
    if (!args.rankingOrder || !Array.isArray(args.rankingOrder)) {
      args.rankingOrder = [];
    }
    args.rankingOrder.push({
      id: generateUniqueId(),
      value: undefined,
      rankingOrder: 'increasing',
      isExpanded: true, // Auto-expand new items
    });
  });
};

const resetToDefaults = () => {
  app.updateArgs((args) => {
    args.rankingOrder = app.model.outputs.defaultRankingOrder ?? [];
  });
};

// set default ranking order when topClonotypes is set
watch(() => app.model.args.topClonotypes, (newValue, oldValue) => {
  if (oldValue === undefined && newValue !== undefined) {
    resetToDefaults();
  }
});
</script>

<template>
  <div v-if="app.model.args.topClonotypes" class="d-flex flex-column gap-6">
    <PlRow>
      Rank by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select columns to use for ranking the clonotypes. If none selected, "Number of Samples" will be used by default. </template>
      </PlTooltip>
    </PlRow>

    <PlElementList
      v-model:items="app.model.args.rankingOrder"
      :get-item-key="(item) => item.id ?? 0"
      :is-expanded="(item) => item.isExpanded === true"
      :on-expand="(item) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ item.value ? getMetricLabel(item.value) : 'Add Rank' }}
      </template>
      <template #item-content="{ index }">
        <RankCard
          v-model="app.model.args.rankingOrder[index]"
          :options="app.model.outputs.rankingOptions"
        />
      </template>
    </PlElementList>

    <div class="d-flex flex-column gap-6">
      <PlBtnSecondary icon="add" @click="addRankColumn">
        Add Ranking Column
      </PlBtnSecondary>

      <PlBtnSecondary icon="reverse" @click="resetToDefaults">
        Reset to defaults
      </PlBtnSecondary>
    </div>
  </div>
</template>
