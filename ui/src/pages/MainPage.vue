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
import type { PlRef, PTableRecordSingleValueFilterV2 } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import { useApp } from '../app';
import { computed, watch } from 'vue';
import { GreaterOrEqualFilter, isNotNaFilter, equalStringFilter } from '../utils/filters';

const app = useApp();

// Create base filter with hidden filters
let mainFilter: PTableRecordSingleValueFilterV2[] = [];

// default filters
watch(() => app.model.args.inputAnchor,
  () => {
    mainFilter = [
      ...isNotNaFilter(
        app.model.outputs.Cdr3SeqAaColumn?.id,
      )];
    // Initialize filterModel if it doesn't exist
    if (!app.model.ui.filterModel) {
      app.model.ui.filterModel = { filters: mainFilter };
    }
  });

watch(
  () => [app.model.ui.enrichmentScoreThreshold, app.model.ui.frequencyScoreThreshold,
    app.model.ui.liabilitiesScore, app.model.ui.condition,
  ],
  () => {
    // Combine filters using spread operators
    const filters = [
      ...GreaterOrEqualFilter(
        app.model.outputs.enrichmentScoreColumn?.id,
        app.model.ui.enrichmentScoreThreshold,
      ),
      ...GreaterOrEqualFilter(
        app.model.outputs.frequencyScoreColumn?.id,
        app.model.ui.frequencyScoreThreshold,
      ),
      ...equalStringFilter(
        app.model.outputs.liabilitiesColumn?.id,
        app.model.ui.liabilitiesScore,
      ),
      ...equalStringFilter(
        {
          type: 'String',
          name: 'pl7.app/vdj/condition',
          domain: {},
        },
        app.model.ui.condition,
      ),
    ];

    // Initialize filterModel if it doesn't exist
    if (!app.model.ui.filterModel) {
      app.model.ui.filterModel = { filters: mainFilter };
    }

    // Set filters
    app.model.ui.filterModel.filters = [...mainFilter, ...filters];
  },
);

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
      <PlDropdownMulti v-model="app.model.ui.liabilitiesScore" :options="liabilitiesOptions" label="Liabilities score" >
        <template #tooltip>
          Select liabilities scores for filtering.
        </template>
      </PlDropdownMulti>

      <PlDropdownMulti
        v-model="app.model.ui.condition"
        label="Condition"
        :options="[
          { text: 'd0', value: '0' },
          { text: 'd5', value: '5' },
          { text: 'd6', value: '6' },
          { text: 'd12', value: '12' },
          { text: 'd60', value: '60' },
        ]"
      >
        <template #tooltip> Restrict the analysis to certain Conditions. </template>
      </PlDropdownMulti>
    </PlSlideModal>
  </PlBlockPage>
</template>
