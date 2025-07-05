<script setup lang="ts" generic="T = unknown">
import type { AnchoredColumnId, RankingOrder } from '@platforma-open/milaboratories.top-antibodies.model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlTooltip } from '@platforma-sdk/ui-vue';
import { watch } from 'vue';
import { useApp } from '../../app';
import RankCard from './RankCard.vue';

const app = useApp();

const getMetricLabel = (value: AnchoredColumnId | undefined) => {
  const column = app.model.outputs.rankingOptions?.find(
    (option) => option && option.value.column === value?.column,
  );
  return column?.label ?? 'Set rank';
};

const handleExpand = (item: RankingOrder) => {
  item.isExpanded = !item.isExpanded;
};

const handleRemove = (item: RankingOrder, index: number) => {
  app.model.args.rankingOrder.splice(index, 1);
};

const handleSort = (oldIndex: number, newIndex: number) => {
  console.log('[RankList] onChange: indices:', [oldIndex, newIndex]);
  app.updateArgs((args) => {
    args.rankingOrder = args.rankingOrder.map((_, i) => {
      if (i === oldIndex) return args.rankingOrder[newIndex];
      if (i === newIndex) return args.rankingOrder[oldIndex];
      return args.rankingOrder[i];
    });
  });
};

const addRankColumn = () => {
  app.updateArgs((args) => {
    if (!args.rankingOrder || !Array.isArray(args.rankingOrder)) {
      args.rankingOrder = [];
    }
    args.rankingOrder.push({
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
watch(() => app.model.args.topClonotypes, (oldValue, newValue) => {
  if (oldValue === undefined && newValue !== undefined) {
    resetToDefaults();
  }
});
</script>

<template>
  <div v-if="app.model.args.topClonotypes" class="d-flex flex-column gap-6">
    <div class="text-s-btn">
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select columns to use for ranking the clonotypes. If none selected, "Number of Samples" will be used by default. </template>
      </PlTooltip>
      Rank by:
    </div>

    <PlElementList
      v-model:items="app.model.args.rankingOrder"
      :get-item-key="(item, index) => index.toString()"
      :is-expanded="(item) => item.isExpanded === true"
      :on-expand="handleExpand"
      :on-remove="handleRemove"
      :on-sort="handleSort"
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
