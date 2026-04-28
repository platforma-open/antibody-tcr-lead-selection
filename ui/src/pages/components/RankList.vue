<script setup lang="ts">
import type { ScopedColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
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

const getMetricLabel = (value: ScopedColumnId | undefined) => {
  const column = app.model.outputs.rankingConfig?.options?.find(
    (option) => option && option.value.column === value?.column,
  );
  return column?.label ?? 'Set rank';
};

const addRankColumn = () => {
  const ui = app.model.data;

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

const getPresetDefaults = () => {
  const config = app.model.outputs.rankingConfig;
  if (!config) return undefined;
  const preset = app.model.data.preset;
  if (preset === 'in-vivo') return config.inVivoDefaults;
  if (preset === 'in-vitro') return config.inVitroDefaults;
  return undefined;
};

const resetToDefaults = () => {
  const defaults = getPresetDefaults();
  app.model.data.rankingOrder = defaults?.map((defaultRank: { value?: ScopedColumnId; rankingOrder: 'increasing' | 'decreasing' }) => ({
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
  hasDefaults: () => (getPresetDefaults()?.length ?? 0) > 0,
  getPreset: () => app.model.data.preset,
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
