<script setup lang="ts">
import type { AnchoredColumnId, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../../app';
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
    (option) => option && option.value.column === columnId?.column,
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
    filter: { ...defaultFilter.default }, // Create a deep copy to avoid reference rewriting issues
    isExpanded: false,
  })) ?? [];
};

// Track which anchor's defaults we've applied
const appliedForAnchor = ref<unknown>(null);

// Extract the config's anchor key for efficient watching (avoids deep: true)
const configAnchorKey = computed(() => {
  const config = app.model.outputs.filterConfig;
  if (!config?.options?.length) return null;
  const mainOption = config.options.find((o: { value: AnchoredColumnId }) => o.value?.anchorName === 'main');
  return mainOption?.value?.anchorRef ? JSON.stringify(mainOption.value.anchorRef) : null;
});

// Watch inputAnchor and the config's anchor key (lightweight alternative to deep: true)
watch(
  [() => app.model.args.inputAnchor, configAnchorKey],
  ([currentAnchor, configKey]) => {
    const config = app.model.outputs.filterConfig;

    // No anchor = clear filters
    if (!currentAnchor) {
      app.model.ui.filters = [];
      appliedForAnchor.value = null;
      return;
    }

    // Already applied for this anchor? Skip
    if (appliedForAnchor.value && plRefsEqual(appliedForAnchor.value as Parameters<typeof plRefsEqual>[0], currentAnchor)) {
      return;
    }

    // No config yet = clear filters and reset tracking (wait for config)
    if (!config || !configKey) {
      app.model.ui.filters = [];
      appliedForAnchor.value = null;
      return;
    }

    // Verify config matches current anchor BEFORE checking defaults
    const mainOption = config.options?.find((o: { value: AnchoredColumnId }) => o.value?.anchorName === 'main');
    if (!mainOption?.value || !plRefsEqual(mainOption.value.anchorRef, currentAnchor)) {
      // Config is stale - clear and wait for fresh config
      app.model.ui.filters = [];
      appliedForAnchor.value = null;
      return;
    }

    // No defaults available - mark as applied (empty defaults is valid for this anchor)
    if (!config.defaults || config.defaults.length === 0) {
      app.model.ui.filters = [];
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
