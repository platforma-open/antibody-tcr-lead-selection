<script setup lang="ts" generic="T = unknown">
import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref, watch } from 'vue';
import { useApp } from '../../app';
import RankCard from './RankCard.vue';

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

// Track if defaults have been added to avoid re-adding them
const defaultsAdded = ref(false);

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

// Add default score columns when ranking section becomes available
// Only watch topClonotypes and filterOptions to avoid feedback loop
watch(
  () => ({
    topClonotypes: app.model.args.topClonotypes,
    filterOptions: app.model.outputs.filterOptions, // Score columns
  }),
  (newVal) => {
    // Only add defaults when:
    // 1. topClonotypes is set (section is visible)
    // 2. filterOptions (score columns) are available
    // 3. Defaults haven't been added yet
    if (
      newVal.topClonotypes
      && newVal.filterOptions
      && newVal.filterOptions.length > 0
      && !defaultsAdded.value
    ) {
      // Check if ranking order is currently empty
      const currentRankingOrder = app.model.args.rankingOrder;
      if (!currentRankingOrder || currentRankingOrder.length === 0) {
        app.updateArgs((args) => {
          args.rankingOrder = newVal.filterOptions!.map((scoreColumn) => ({
            id: generateUniqueId(),
            value: scoreColumn.value,
            rankingOrder: 'decreasing', // Score columns typically ranked highest first
            isExpanded: false,
          }));
        });
        defaultsAdded.value = true;
      }
    }

    // Reset defaults flag when topClonotypes is cleared
    if (!newVal.topClonotypes) {
      defaultsAdded.value = false;
    }
  },
  { immediate: true },
);
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
    </div>
  </div>
</template>
