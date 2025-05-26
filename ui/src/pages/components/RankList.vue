<script setup lang="ts" generic="T = unknown">
import type { SUniversalPColumnId } from '@platforma-sdk/model';
import { PlIcon16, PlMaskIcon16, PlMaskIcon24, PlRow, PlTooltip, useSortable2 } from '@platforma-sdk/ui-vue';
import { reactive, ref } from 'vue';
import { useApp } from '../../app';
import './metrics-manager.scss';
import RankCard from './RankCard.vue';

const app = useApp();

const openState = reactive<Record<number, boolean>>({});
const listRef = ref<HTMLElement>();
const listKey = ref(0);

useSortable2(listRef, {
  handle: '.handle',
  onChange(indices) {
    console.log('[RankList] onChange: indices:', indices);
    app.updateArgs((args) => {
      args.rankingOrder = indices.map((i) => args.rankingOrder[i]);
    });

    listKey.value++;
  },
});

const getMetricLabel = (value: SUniversalPColumnId | undefined) => {
  const column = app.model.outputs.rankingOptions?.find(
    (option) => option && option.value === value,
  );
  return column?.label ?? 'Set rank';
};

const toggleExpandMetric = (index: number) => {
  if (!openState[index]) openState[index] = true;
  else delete openState[index];
  // listKey.value++; // Optional: force update if display issues occur
};

const deleteRankingColumn = (index: number) => {
  const currentRankingOrder = app.model.args.rankingOrder;
  const oldLen = currentRankingOrder.length;

  currentRankingOrder.splice(index, 1);

  const newOpenState: Record<number, boolean> = {};
  for (let i = 0; i < index; i++) {
    if (Object.prototype.hasOwnProperty.call(openState, i)) {
      newOpenState[i] = openState[i];
    }
  }
  for (let i = index; i < oldLen - 1; i++) {
    if (Object.prototype.hasOwnProperty.call(openState, i + 1)) {
      newOpenState[i] = openState[i + 1];
    }
  }

  Object.keys(openState).forEach((key) => {
    delete openState[parseInt(key)];
  });
  for (const key in newOpenState) {
    if (Object.prototype.hasOwnProperty.call(newOpenState, key)) {
      openState[parseInt(key)] = newOpenState[key];
    }
  }
  listKey.value++; // Ensure list re-renders correctly after deletion
};

const addRankColumn = () => {
  app.updateArgs((args) => {
    if (!args.rankingOrder || !Array.isArray(args.rankingOrder)) {
      args.rankingOrder = [];
    }
    const index = args.rankingOrder.length;
    args.rankingOrder.push({
      value: undefined,
      rankingOrder: 'increasing',
    });
    openState[index] = true;
  });
  listKey.value++;
};

const resetToDefaults = () => {
  app.updateArgs((args) => {
    args.rankingOrder = app.model.outputs.defaultRankingOrder ?? [];
  });
  Object.keys(openState).forEach((key) => {
    delete openState[parseInt(key)];
  });
  listKey.value++;
};
</script>

<template>
  <div v-if="app.model.args.topClonotypes" class="metrics-manager d-flex flex-column gap-6">
    <div class="text-s-btn">
      <PlRow>
        Rank by:
        <PlTooltip>
          <PlIcon16 name="info" />
          <template #tooltip> Specify the columns to rank the picked clonotypes by. </template>
        </PlTooltip>
      </PlRow>
    </div>
    <div ref="listRef" :key="listKey">
      <div
        v-for="(entry, index) in app.model.args.rankingOrder"
        :key="index"
        :class="{ open: openState[index] ?? false }"
        class="metrics-manager__metric"
      >
        <div
          class="metrics-manager__header d-flex align-center gap-8"
          @click="toggleExpandMetric(index)"
        >
          <div class="metrics-manager__drag-handle handle me-1" style="cursor: grab;">
            <PlMaskIcon16 name="drag-dots" />
          </div>
          <div class="metrics-manager__expand-icon">
            <PlMaskIcon16 name="chevron-right" />
          </div>

          <div class="metrics-manager__title flex-grow-1 text-s-btn" style="white-space: nowrap;">
            {{ entry.value ? getMetricLabel(entry.value) : 'Add Rank' }}
          </div>

          <div class="metrics-manager__actions">
            <div class="metrics-manager__delete ms-auto" @click.stop="deleteRankingColumn(index)">
              <PlMaskIcon24 name="close" />
            </div>
          </div>
        </div>

        <div class="metrics-manager__content d-flex gap-24 p-24 flex-column">
          <RankCard
            v-model="app.model.args.rankingOrder[index]"
            :options="app.model.outputs.rankingOptions"
          />
        </div>
      </div>
    </div>

    <div :class="{ 'pt-24': true }" class="metrics-manager__add-action-wrapper">
      <div
        class="metrics-manager__add-btn"
        @click="addRankColumn"
      >
        <div class="metrics-manager__add-btn-icon">
          <PlMaskIcon16 name="add" />
        </div>
        <div class="metrics-manager__add-btn-title text-s-btn">Add Ranking Column</div>
      </div>

      <div :class="{ 'pt-24': true }" class="metrics-manager__add-action-wrapper">
        <div
          class="metrics-manager__add-btn"
          @click="resetToDefaults"
        >
          <div class="metrics-manager__add-btn-icon">
            <PlMaskIcon16 name="reverse" />
          </div>
          <div class="metrics-manager__add-btn-title text-s-btn">Reset to defaults</div>
        </div>
      </div>
    </div>
  </div>
</template>
