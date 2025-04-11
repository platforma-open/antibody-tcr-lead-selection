<script setup lang="ts">
import type {
  PlDataTableSettings } from '@platforma-sdk/ui-vue';
import { PlBlockPage,
  PlAgDataTableToolsPanel,
  PlBtnGhost,
  PlMaskIcon24,
  PlSlideModal,
  PlDropdownRef,
  PlNumberField,
  PlDropdownMulti,
  PlAgDataTable } from '@platforma-sdk/ui-vue';
import type { PlRef } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import type { PTableRecordSingleValueFilterV2 } from '@platforma-sdk/model';
import { useApp } from '../app';
import { computed, watch } from 'vue';

const app = useApp();

watch(() => app.model.ui.enrichmentScoreThreshold, (newValue) => {
  if (app.model.outputs.enrichmentScoreColumn && app.model.ui.enrichmentScoreThreshold !== undefined && newValue) {
    const currentFilters = app.model.ui.filterModel?.filters ?? [];

    const filtersWithoutPrevValue = currentFilters.filter((filter) => filter.column.id !== app.model.outputs.enrichmentScoreColumn?.id);
    const finalFilters: PTableRecordSingleValueFilterV2[] = [...filtersWithoutPrevValue, {
      type: 'bySingleColumnV2',
      column: { type: 'column', id: app.model.outputs.enrichmentScoreColumn.id },
      predicate: {
        operator: 'GreaterOrEqual',
        reference: newValue,
      },
    }];

    if (!app.model.ui.filterModel) {
      app.model.ui.filterModel = { filters: [] };
    }
    app.model.ui.filterModel.filters = finalFilters;
  }
});

watch(() => app.model.ui.frequencyScoreThreshold, (newValue) => {
  if (app.model.outputs.frequencyScoreColumn && app.model.ui.frequencyScoreThreshold !== undefined && newValue) {
    const currentFilters = app.model.ui.filterModel?.filters ?? [];

    const filtersWithoutPrevValue = currentFilters.filter((filter) => filter.column.id !== app.model.outputs.frequencyScoreColumn?.id);
    const finalFilters: PTableRecordSingleValueFilterV2[] = [...filtersWithoutPrevValue, {
      type: 'bySingleColumnV2',
      column: { type: 'column', id: app.model.outputs.frequencyScoreColumn.id },
      predicate: {
        operator: 'GreaterOrEqual',
        reference: newValue,
      },
    }];

    if (!app.model.ui.filterModel) {
      app.model.ui.filterModel = { filters: [] };
    }
    app.model.ui.filterModel.filters = finalFilters;
  }
});

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  // app.model.args.clonotypingRunId = ref?.blockId;
  app.model.ui.title = ref
    ? app.model.outputs.inputOptions?.find((o) =>
      plRefsEqual(o.ref, ref),
    )?.label
    : undefined;
}

const tableSettings = computed<PlDataTableSettings>(() => ({
  sourceType: 'ptable',
  pTable: app.model.outputs.scoresTable?.scoresTable,
}));

const liabilitiesOptions = [
  { text: 'None', value: 'None' },
  { text: 'Low', value: 'Low' },
  { text: 'Medium', value: 'Medium' },
  { text: 'High', value: 'High' },
];

</script>

<template>
  <PlBlockPage>
    <template #title>
      Top Antibodies{{ app.model.ui.title ? ` - ${app.model.ui.title}` : '' }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel/>
      <PlBtnGhost @click.stop="() => (app.model.ui.settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <PlAgDataTable
      v-model="app.model.ui.tableState"
      :settings="tableSettings"
      show-columns-panel
      show-export-button
    />
    <PlSlideModal v-model="app.model.ui.settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>
      <PlDropdownRef
        :options="app.model.outputs.inputOptions"
        :model-value="app.model.args.inputAnchor"
        label="Select dataset"
        clearable
        @update:model-value="setAnchorColumn"
      />
      <PlNumberField
        v-model="app.model.ui.frequencyScoreThreshold"
        label="Frequency threshold" :minValue="0" :step="0.1"
      >
        <template #tooltip>
          Select minimum clonotype frequency.
        </template>
      </PlNumberField>
      <PlNumberField
        v-model="app.model.ui.enrichmentScoreThreshold"
        label="Enrichment threshold" :minValue="0" :step="0.1"
      >
        <template #tooltip>
          Select minimum clonotype enrichment score.
        </template>
      </PlNumberField>
      <PlDropdownMulti v-model="app.model.args.liabilitiesScore" :options="liabilitiesOptions" label="Liabilities score" >
        <template #tooltip>
          Select liabilities scores for filtering.
        </template>
      </PlDropdownMulti>

      <!-- <PlDropdownMulti
        v-model="theModel"
        label="The filter I always dreamed about"
        :options="[
          { value: 'a', label: 'a' },
          { value: 'b', label: 'b' }
        ]"
      >
      <template #tooltip> Restrict the analysis to certain LChain sequences. </template>
    </PlDropdownMulti> -->
    </PlSlideModal>
  </PlBlockPage>
</template>
