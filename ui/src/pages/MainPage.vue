<script setup lang="ts">
import type { PlRef, PlSelectionModel } from '@platforma-sdk/model';
import { createPlDataTableStateV2 } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
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
  PlSectionSeparator,
  PlSlideModal,
  PlTooltip,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import { ref, watch, computed } from 'vue';
import { useApp } from '../app';
import {
  isSequenceColumn,
} from '../util';
import FilterList from './components/FilterList.vue';
import RankList from './components/RankList.vue';

const app = useApp();

const settingsOpen = ref(app.model.args.inputAnchor === undefined);
const multipleSequenceAlignmentOpen = ref(false);

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  const datasetName = ref
    && app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, ref))
      ?.label;
  app.model.ui.title = ['Antibody/TCR Leads', datasetName]
    .filter(Boolean).join(' - ');
}

const tableSettings = usePlDataTableSettingsV2({
  // Only set sourceId when table model exists to prevent loading state
  sourceId: () => app.model.outputs.table ? app.model.args.inputAnchor : null,
  model: () => app.model.outputs.table,
  // filtersConfig: ({ column }) => ({ default: defaultFilters(column) }),
});

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});

// Temporary typed bridge until model types are regenerated
const kabatNumbering = computed<boolean>({
  get: () => (app.model.args.kabatNumbering ?? false),
  set: (v: boolean) => (app.model.args.kabatNumbering = v),
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
    if (app.model.args.disableClusterRanking) {
      return NO_DIVERSIFICATION_VALUE;
    }
    if (app.model.args.clusterColumn) {
      return JSON.stringify(app.model.args.clusterColumn);
    }
    return undefined;
  },
  set: (v: string | undefined) => {
    if (v === NO_DIVERSIFICATION_VALUE || v === undefined) {
      app.model.args.disableClusterRanking = true;
      app.model.args.clusterColumn = undefined;
    } else {
      app.model.args.disableClusterRanking = undefined; // Clear flag when cluster column is selected
      app.model.args.clusterColumn = JSON.parse(v) as PlRef;
    }
  },
});

// Clear clusterColumn when inputAnchor changes (old value is invalid for new dataset)
watch(
  () => app.model.args.inputAnchor,
  (newAnchor, oldAnchor) => {
    // Only clear if anchor actually changed (not on initial load)
    if (oldAnchor && newAnchor && JSON.stringify(oldAnchor) !== JSON.stringify(newAnchor)) {
      app.model.args.clusterColumn = undefined;
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
      && !app.model.args.clusterColumn
      && app.model.args.disableClusterRanking !== true
    ) {
      app.model.args.clusterColumn = options[0].ref;
      app.model.args.disableClusterRanking = undefined; // Clear flag (not disabled)
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
const isSamplingConfigured = computed<boolean>(() => app.model.args.topClonotypes !== undefined);
watch(() => app.model.args.topClonotypes, (newVal) => {
  if (newVal === undefined) kabatNumbering.value = false;
});

// Reset table state when dataset or Kabat toggle changes to re-apply defaults (like optional visibility)
watch(() => [app.model.args.inputAnchor, app.model.args.kabatNumbering], () => {
  app.model.ui.tableState = createPlDataTableStateV2();
});

// Debug logging for Settings panel state
watch(settingsOpen, (isOpen) => {
  console.log('[MainPage] Settings panel:', isOpen ? 'OPENED' : 'CLOSED');
  console.log('[MainPage] Current filters count:', app.model.ui.filters?.length ?? 0);
  console.log('[MainPage] Current rankings count:', app.model.ui.rankingOrder?.length ?? 0);
});
</script>

<template>
  <PlBlockPage>
    <template #title>
      {{ app.model.ui.title }}
    </template>
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
      v-model="app.model.ui.tableState"
      v-model:selection="selection"
      :settings="tableSettings"
      show-export-button
      disable-filters-panel
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>

      <!-- First element: Select dataset -->
      <PlDropdownRef
        :options="app.model.outputs.inputOptions"
        :model-value="app.model.args.inputAnchor"
        :style="{ width: '320px' }"
        label="Select dataset"
        clearable
        required
        @update:model-value="setAnchorColumn"
      />

      <!-- Number of clonotypes to select -->
      <PlNumberField
        v-model="app.model.args.topClonotypes"
        :style="{ width: '320px' }"
        label="Number of clonotypes to select"
        :step="1"
        :error-message="validateTopClonotypes(app.model.args.topClonotypes)"
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
        v-if="app.model.args.rankingOrder.some((order) => order.value === undefined)" type="warn"
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
        v-model="app.model.ui.alignmentModel"
        :sequence-column-predicate="isSequenceColumn"
        :p-frame="app.model.outputs.pf"
        :selection="selection"
      />
    </PlSlideModal>
  </PlBlockPage>
</template>
