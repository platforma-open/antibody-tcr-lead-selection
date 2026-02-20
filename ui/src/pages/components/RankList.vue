<script setup lang="ts">
import { ref } from 'vue';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import RankCard from './RankCard.vue';

import { useApp } from '../../app';
import { useAnchorSyncedDefaults } from '../../composables/useAnchorSyncedDefaults';
import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';

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
  if (!Array.isArray(app.model.data.rankingOrder)) {
    app.model.data.rankingOrder = [];
  }

  app.model.data.rankingOrder.push({
    id: generateUniqueId(),
    value: undefined,
    rankingOrder: 'decreasing',
    isExpanded: true,
  });
};

const resetToDefaults = () => {
  app.model.data.rankingOrder = app.model.outputs.rankingConfig?.defaults?.map((defaultRank) => ({
    id: generateUniqueId(),
    value: defaultRank.value,
    rankingOrder: defaultRank.rankingOrder,
    isExpanded: false,
  })) ?? [];
};

// Use shared anchor sync logic
useAnchorSyncedDefaults({
  getAnchor: () => app.model.data.inputAnchor,
  getConfig: () => app.model.outputs.rankingConfig,
  clearState: () => {
    app.model.data.rankingOrder = [];
  },
  applyDefaults: () => {
    resetToDefaults();
  },
  hasDefaults: () => (app.model.outputs.rankingConfig?.defaults?.length ?? 0) > 0,
  // Preserve existing user selections on component remount (e.g., when Settings panel reopens)
  // Returns true if existing state uses columns from the current config
  hasExistingStateForConfig: (config) => {
    const items = app.model.data.rankingOrder ?? [];
    if (items.length === 0) {
      return false;
    }
    const configColumnIds = new Set(config.options?.map((o) => o.value.column) ?? []);
    // Check if at least one item uses a column from current config
    const result = items.some((item) => {
      if (!item.value?.column) return false;
      const matches = configColumnIds.has(item.value.column);
      return matches;
    });
    return result;
  },
  // Check if there are any items at all (used to avoid clearing on remount before config loads)
  hasAnyItems: () => {
    const count = app.model.data.rankingOrder?.length ?? 0;
    return count > 0;
  },
  // Persisted tracking of which anchor's defaults have been applied
  getInitializedAnchorKey: () => {
    const key = app.model.data.rankingsInitializedForAnchor;
    return key;
  },
  setInitializedAnchorKey: (key) => {
    app.model.data.rankingsInitializedForAnchor = key;
  },
});
</script>

<template>
  <div class="d-flex flex-column gap-6">
    <PlRow>
      Choose the best clonotypes by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select the criteria used to prioritize clonotypes during selection.</template>
      </PlTooltip>
    </PlRow>

    <PlElementList
      v-model:items="app.model.data.rankingOrder"
      :get-item-key="(item) => item.id ?? 0"
      :is-expanded="(item) => item.isExpanded === true"
      :on-expand="(item) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ item.value ? getMetricLabel(item.value) : 'Add Rank' }}
      </template>
      <template #item-content="{ index }">
        <RankCard
          v-model="app.model.data.rankingOrder[index]"
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
