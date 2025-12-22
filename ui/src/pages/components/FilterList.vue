<script setup lang="ts">
import type { AnchoredColumnId, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from '../../app';
import { useAnchorSyncedDefaults } from '../../composables/useAnchorSyncedDefaults';
import FilterCard from './FilterCard.vue';

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `filter-${idCounter.value}-${Date.now()}`;
};

const getColumnLabel = (columnId: AnchoredColumnId | undefined) => {
  const column = app.model.outputs.filterConfig?.options?.find(
    (option: { value: AnchoredColumnId; label: string }) => option && option.value.column === columnId?.column,
  );
  return column?.label ?? 'Set filter';
};

const addFilter = () => {
  const ui = app.model.ui;

  if (!Array.isArray(ui.filters)) {
    ui.filters = [];
  }

  ui.filters.push({
    id: generateUniqueId(),
    value: undefined,
    filter: { type: 'number_greaterThan', reference: 0 },
    isExpanded: true, // Auto-expand new items
  });
};

const resetToDefaults = () => {
  app.model.ui.filters = app.model.outputs.filterConfig?.defaults?.map((defaultFilter: { column: AnchoredColumnId; default: PlTableFilter }) => ({
    id: generateUniqueId(),
    value: defaultFilter.column,
    filter: { ...defaultFilter.default },
    isExpanded: false,
  })) ?? [];
};

// Use shared anchor sync logic
useAnchorSyncedDefaults({
  getAnchor: () => app.model.args.inputAnchor,
  getConfig: () => app.model.outputs.filterConfig,
  clearState: () => { app.model.ui.filters = []; },
  applyDefaults: resetToDefaults,
  hasDefaults: () => (app.model.outputs.filterConfig?.defaults?.length ?? 0) > 0,
});
</script>

<template>
  <div class="d-flex flex-column gap-6">
    <PlRow>
      Filter by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select columns to use for filtering the data. </template>
      </PlTooltip>
    </PlRow>

    <PlElementList
      v-model:items="app.model.ui.filters"
      :get-item-key="(item: FilterUI) => item.id ?? 0"
      :is-expanded="(item: FilterUI) => item.isExpanded === true"
      :on-expand="(item: FilterUI) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ (item as FilterUI).value ? getColumnLabel((item as FilterUI).value) : 'Add Filter' }}
      </template>
      <template #item-content="{ index }">
        <FilterCard
          v-model="app.model.ui.filters[index]"
          :options="app.model.outputs.filterConfig?.options"
        />
      </template>
    </PlElementList>

    <div class="d-flex flex-column gap-6">
      <PlBtnSecondary icon="add" @click="addFilter">
        Add Filter
      </PlBtnSecondary>

      <PlBtnSecondary icon="reverse" @click="resetToDefaults">
        Reset to defaults
      </PlBtnSecondary>
    </div>
  </div>
</template>
