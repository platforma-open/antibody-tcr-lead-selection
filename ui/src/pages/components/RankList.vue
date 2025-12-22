<script setup lang="ts" generic="T = unknown">
import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
import { plRefsEqual } from '@platforma-sdk/model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
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

// Track which anchor's defaults we've applied
const appliedForAnchor = ref<unknown>(null);

// Extract the config's anchor key for efficient watching (avoids deep: true)
const configAnchorKey = computed(() => {
  const config = app.model.outputs.rankingConfig;
  if (!config?.options?.length) return null;
  const mainOption = config.options.find((o: { value: AnchoredColumnId }) => o.value?.anchorName === 'main');
  return mainOption?.value?.anchorRef ? JSON.stringify(mainOption.value.anchorRef) : null;
});

// Watch inputAnchor and the config's anchor key (lightweight alternative to deep: true)
watch(
  [() => app.model.args.inputAnchor, configAnchorKey],
  ([currentAnchor, configKey]) => {
    const config = app.model.outputs.rankingConfig;

    // No anchor = clear rankings
    if (!currentAnchor) {
      app.model.ui.rankingOrder = [];
      appliedForAnchor.value = null;
      return;
    }

    // Already applied for this anchor? Skip
    if (appliedForAnchor.value && plRefsEqual(appliedForAnchor.value as Parameters<typeof plRefsEqual>[0], currentAnchor)) {
      return;
    }

    // No config yet = clear rankings and reset tracking (wait for config)
    if (!config || !configKey) {
      app.model.ui.rankingOrder = [];
      appliedForAnchor.value = null;
      return;
    }

    // Verify config matches current anchor BEFORE checking defaults
    const mainOption = config.options?.find((o: { value: AnchoredColumnId }) => o.value?.anchorName === 'main');
    if (!mainOption?.value || !plRefsEqual(mainOption.value.anchorRef, currentAnchor)) {
      // Config is stale - clear and wait for fresh config
      app.model.ui.rankingOrder = [];
      appliedForAnchor.value = null;
      return;
    }

    // No defaults available - mark as applied (empty defaults is valid for this anchor)
    if (!config.defaults || config.defaults.length === 0) {
      app.model.ui.rankingOrder = [];
      appliedForAnchor.value = currentAnchor;
      return;
    }

    // Config is fresh and has defaults - apply them
    appliedForAnchor.value = currentAnchor;
    resetToDefaults();
  },
  { immediate: true },
);
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
