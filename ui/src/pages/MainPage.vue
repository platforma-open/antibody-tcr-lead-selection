<script setup lang="ts">
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import strings from '@milaboratories/strings';
import type { PlRef, PlSelectionModel } from '@platforma-sdk/model';
import { createPlDataTableStateV2 } from '@platforma-sdk/model';
import {
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlCheckbox,
  PlDropdown,
  PlDropdownRef,
  PlIcon16,
  PlNumberField,
  PlRow,
  PlSlideModal,
  PlTooltip,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import {
  isSequenceColumn,
} from '../util';
import FilterList from './components/FilterList.vue';
import RankList from './components/RankList.vue';

const app = useApp();

const settingsOpen = ref(app.model.data.inputAnchor === undefined);
const multipleSequenceAlignmentOpen = ref(false);

// Watch for when the workflow starts running and close settings
watch(() => app.model.outputs.isRunning, (isRunning) => {
  if (isRunning) {
    settingsOpen.value = false;
  }
});

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.table,
});

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});

// Temporary typed bridge until model types are regenerated
const kabatNumbering = computed<boolean>({
  get: () => (app.model.data.kabatNumbering ?? false),
  set: (v: boolean) => (app.model.data.kabatNumbering = v),
});

// Special value for "No diversification" option
const NO_DIVERSIFICATION_VALUE = '__no_diversification__';

// Cluster column options with "No diversification" prepended
// Transform ref-based options to value-based options using JSON.stringify
const clusterColumnOptionsWithNone = computed(() => {
  const options = app.model.outputs.clusterColumnOptions ?? [];
  return [
    { label: 'No diversification (allow similar clonotypes)', value: NO_DIVERSIFICATION_VALUE },
    ...options.map((o) => ({
      label: o.label,
      value: JSON.stringify(o.ref),
    })),
  ];
});

// Selected cluster column value for the dropdown
const selectedClusterColumnValue = computed<string | undefined>({
  get: () => {
    if (app.model.data.disableClusterRanking) {
      return NO_DIVERSIFICATION_VALUE;
    }
    if (app.model.data.clusterColumn) {
      return JSON.stringify(app.model.data.clusterColumn);
    }
    return undefined;
  },
  set: (v: string | undefined) => {
    if (v === NO_DIVERSIFICATION_VALUE || v === undefined) {
      app.model.data.disableClusterRanking = true;
      app.model.data.clusterColumn = undefined;
    } else {
      app.model.data.disableClusterRanking = undefined; // Clear flag when cluster column is selected
      app.model.data.clusterColumn = JSON.parse(v) as PlRef;
    }
  },
});

// Clear clusterColumn when inputAnchor changes (old value is invalid for new dataset)
watch(
  () => app.model.data.inputAnchor,
  (newAnchor, oldAnchor) => {
    // Only clear if anchor actually changed (not on initial load)
    if (oldAnchor && newAnchor && JSON.stringify(oldAnchor) !== JSON.stringify(newAnchor)) {
      app.model.data.clusterColumn = undefined;
      // Don't reset disableClusterRanking - preserve user's diversification preference
    }
  },
);

// Auto-set default clusterColumn when options become available
watch(
  () => app.model.outputs.clusterColumnOptions,
  (options) => {
    // Only set default if:
    // - options are available
    // - clusterColumn is not set
    // - disableClusterRanking is not explicitly true
    if (
      options
      && options.length > 0
      && !app.model.data.clusterColumn
      && app.model.data.disableClusterRanking !== true
    ) {
      app.model.data.clusterColumn = options[0].ref;
      app.model.data.disableClusterRanking = undefined; // Clear flag (not disabled)
    }
  },
  { immediate: true },
);

// Detect if selected dataset is Immunoglobulins (IG) vs TCR
const isIGDataset = computed<boolean | undefined>(() => {
  const spec = app.model.outputs.inputAnchorSpec;
  if (!spec?.axesSpec || spec.axesSpec.length < 2) return undefined;

  // Single cell: second axis has receptor domain
  const isSingleCell = spec.axesSpec?.[1]?.name === 'pl7.app/vdj/scClonotypeKey';
  if (isSingleCell) {
    const receptor = spec.axesSpec?.[1]?.domain?.['pl7.app/vdj/receptor'];
    return receptor === 'IG';
  }

  // Bulk: first second axis has chain domain
  const chain = spec.axesSpec?.[1]?.domain?.['pl7.app/vdj/chain'];
  return chain === 'IGHeavy' || chain === 'IGLight';
});

const validateTopClonotypes = (value: number | undefined): string | undefined => {
  if (value === undefined) {
    return 'This field is required';
  }
  if (value < 2) {
    return 'Value must be higher or equal than 2';
  }
  return undefined;
};

// Disable and reset Kabat until sampling number is set
const isSamplingConfigured = computed<boolean>(() => app.model.data.topClonotypes !== undefined);
watch(() => app.model.data.topClonotypes, (newVal) => {
  if (newVal === undefined) kabatNumbering.value = false;
});

// Reset table state when dataset or Kabat toggle changes to re-apply defaults (like optional visibility)
watch(() => [app.model.data.inputAnchor, app.model.data.kabatNumbering], () => {
  app.model.data.tableState = createPlDataTableStateV2();
});
</script>

<template>
  <PlBlockPage
    title="Antibody/TCR Leads"
  >
    <template #append>
      <PlBtnGhost
        icon="dna"
        @click.stop="() => (multipleSequenceAlignmentOpen = true)"
      >
        Multiple Sequence Alignment
      </PlBtnGhost>
      <PlBtnGhost
        icon="settings"
        @click.stop="() => (settingsOpen = true)"
      >
        Settings
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      v-model="app.model.data.tableState"
      v-model:selection="selection"
      :settings="tableSettings"
      :not-ready-text="strings.callToActions.configureSettingsAndRun"
      :no-rows-text="strings.states.noDataAvailable"
      show-export-button
      disable-filters-panel
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>

      <!-- First element: Select dataset -->
      <PlDropdownRef
        v-model="app.model.data.inputAnchor"
        :options="app.model.outputs.inputOptions"
        :style="{ width: '320px' }"
        label="Select dataset"
        clearable
        required
      />

      <!-- Number of clonotypes to select -->
      <PlNumberField
        v-model="app.model.data.topClonotypes"
        :style="{ width: '320px' }"
        label="Number of clonotypes to select"
        :step="1"
        :error-message="validateTopClonotypes(app.model.data.topClonotypes)"
      >
        <template #tooltip>
          Total number of clonotypes that will be selected.
        </template>
      </PlNumberField>

      <!-- Clonotype filtering section -->
      <FilterList />

      <!-- Clonotype sampling section -->
      <template v-if="isSamplingConfigured && app.model.outputs.clusterColumnOptions && app.model.outputs.clusterColumnOptions.length > 0">
        <PlRow>
          Diversify by:
          <PlTooltip>
            <PlIcon16 name="info" />
            <template #tooltip>Defines how clonotypes are grouped to ensure diversity in the selected panel.</template>
          </PlTooltip>
        </PlRow>

        <PlDropdown
          v-model="selectedClusterColumnValue"
          :options="clusterColumnOptionsWithNone"
          :style="{ width: '320px' }"
          label="Cluster for diversification"
        />
      </template>

      <RankList />

      <template v-if="isSamplingConfigured && isIGDataset">
        <PlCheckbox v-model="kabatNumbering">
          Apply Kabat numbering
          <PlTooltip class="info" position="top">
            <PlIcon16 name="info"/>
            <template #tooltip>
              Applies Kabat residue numbering to the variable (VDJ) region amino acid
              sequences and annotates sequences with Kabat positions (per chain where applicable).
            </template>
          </PlTooltip>
        </PlCheckbox>
      </template>

      <PlAlert
        v-if="app.model.data.rankingOrder.some((order) => order.value === undefined)" type="warn"
        :style="{ width: '320px' }"
      >
        {{ "Warning: Please remove or assign values to empty ranking columns" }}
      </PlAlert>
    </PlSlideModal>
    <PlSlideModal
      v-model="multipleSequenceAlignmentOpen"
      width="100%"
      :close-on-outside-click="false"
    >
      <template #title>Multiple Sequence Alignment</template>
      <PlMultiSequenceAlignment
        v-model="app.model.data.alignmentModel"
        :sequence-column-predicate="isSequenceColumn"
        :p-frame="app.model.outputs.pf?.ok ? app.model.outputs.pf.value : undefined"
        :selection="selection"
      />
    </PlSlideModal>
  </PlBlockPage>
</template>
