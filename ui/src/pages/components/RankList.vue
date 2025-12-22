<script setup lang="ts">
import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from '../../app';
import { useAnchorSyncedDefaults } from '../../composables/useAnchorSyncedDefaults';
import RankCard from './RankCard.vue';

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `rank-${idCounter.value}-${Date.now()}`;
};

const getMetricLabel = (value: AnchoredColumnId | undefined) => {
  const column = app.model.outputs.rankingConfig?.options?.find(
    (option) => option && option.value.column === value?.column,
  );
  return column?.label ?? 'Set rank';
};

const addRankColumn = () => {
  const ui = app.model.ui;

  if (!Array.isArray(ui.rankingOrder)) {
    ui.rankingOrder = [];
  }

  ui.rankingOrder.push({
    id: generateUniqueId(),
    value: undefined,
    rankingOrder: 'decreasing',
    isExpanded: true, // Auto-expand new items
  });
};

const resetToDefaults = () => {
  app.model.ui.rankingOrder = app.model.outputs.rankingConfig?.defaults?.map((defaultRank) => ({
    id: generateUniqueId(),
    value: defaultRank.value,
    rankingOrder: defaultRank.rankingOrder,
    isExpanded: false,
  })) ?? [];
};

// Use shared anchor sync logic
useAnchorSyncedDefaults({
  getAnchor: () => app.model.args.inputAnchor,
  getConfig: () => app.model.outputs.rankingConfig,
  clearState: () => { app.model.ui.rankingOrder = []; },
  applyDefaults: resetToDefaults,
  hasDefaults: () => (app.model.outputs.rankingConfig?.defaults?.length ?? 0) > 0,
});
</script>

<template>
  <div class="d-flex flex-column gap-6">
    <PlRow>
      Rank by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select columns to use for ranking the clonotypes. If none selected, clonotype hash will be used by default. </template>
      </PlTooltip>
    </PlRow>

    <PlElementList
      v-model:items="app.model.ui.rankingOrder"
      :get-item-key="(item) => item.id ?? 0"
      :is-expanded="(item) => item.isExpanded === true"
      :on-expand="(item) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ item.value ? getMetricLabel(item.value) : 'Add Rank' }}
      </template>
      <template #item-content="{ index }">
        <RankCard
          v-model="app.model.ui.rankingOrder[index]"
          :options="app.model.outputs.rankingConfig?.options"
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
