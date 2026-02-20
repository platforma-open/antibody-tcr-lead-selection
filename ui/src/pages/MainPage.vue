<script setup lang="ts">
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import strings from '@milaboratories/strings';
import type { AxisId, CanonicalizedJson, ListOptionBase, PlRef, PlSelectionModel, SUniversalPColumnId } from '@platforma-sdk/model';
import { Annotation, createPlDataTableStateV2 } from '@platforma-sdk/model';
import type { PlAdvancedFilter as PlAdvancedFilterType, PlAdvancedFilterItem } from '@platforma-sdk/ui-vue';
import {
  PlAdvancedFilter,
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlBtnSecondary,
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
import { useAnchorSyncedDefaults } from '../composables/useAnchorSyncedDefaults';
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
    if (!app.model.data.diversificationColumn) return NO_DIVERSIFICATION_VALUE;
    return JSON.stringify(app.model.data.diversificationColumn);
  },
  set: (v: string | undefined) => {
    app.model.data.diversificationColumn
      = (v === NO_DIVERSIFICATION_VALUE || v === undefined) ? undefined : JSON.parse(v) as PlRef;
  },
});

// Clear diversificationColumn when inputAnchor changes
watch(
  () => app.model.data.inputAnchor,
  (newAnchor, oldAnchor) => {
    if (oldAnchor && newAnchor && JSON.stringify(oldAnchor) !== JSON.stringify(newAnchor)) {
      app.model.data.diversificationColumn = undefined;
    }
  },
);

// Auto-set default diversificationColumn when options become available
watch(
  () => app.model.outputs.clusterColumnOptions,
  (options) => {
    if (
      options
      && options.length > 0
      && !app.model.data.diversificationColumn
    ) {
      app.model.data.diversificationColumn = options[0].ref;
    }
  },
  { immediate: true },
);

// Detect if selected dataset is Immunoglobulins (IG) vs TCR
const isIGDataset = computed<boolean | undefined>(() => {
  const spec = app.model.outputs.inputAnchorSpec;
  if (!spec?.axesSpec || spec.axesSpec.length < 2) return undefined;

  const isSingleCell = spec.axesSpec?.[1]?.name === 'pl7.app/vdj/scClonotypeKey';
  if (isSingleCell) {
    const receptor = spec.axesSpec?.[1]?.domain?.['pl7.app/vdj/receptor'];
    return receptor === 'IG';
  }

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

// Reset table state when dataset or Kabat toggle changes
watch(() => [app.model.data.inputAnchor, app.model.data.kabatNumbering], () => {
  app.model.data.tableState = createPlDataTableStateV2();
});

// ---------------------------------------------------------------------------
// PlAdvancedFilter integration
// ---------------------------------------------------------------------------

const filterItems = computed<PlAdvancedFilterItem[]>(() =>
  app.model.outputs.filterConfig?.items ?? [],
);

// Sync filterColumnAnchors whenever filterConfig updates
watch(
  () => app.model.outputs.filterConfig?.anchorMap,
  (anchorMap) => {
    if (anchorMap) {
      app.model.data.filterColumnAnchors = anchorMap;
    }
  },
  { immediate: true },
);

function getSuggestOptions(params: {
  columnId: SUniversalPColumnId | CanonicalizedJson<AxisId>;
  axisIdx?: number;
  searchStr: string;
  searchType: 'value' | 'label';
}): ListOptionBase<string | number>[] {
  const item = filterItems.value.find((i) => i.id === params.columnId);
  if (!item) return [];

  const discreteValuesStr = 'annotations' in item.spec
    ? item.spec.annotations?.[Annotation.DiscreteValues]
    : undefined;
  if (!discreteValuesStr) return [];

  try {
    const values = JSON.parse(discreteValuesStr) as string[];
    const options = values.map((v) => ({ value: v, label: v }));
    if (!params.searchStr) return options;
    const search = params.searchStr.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(search));
  } catch {
    return [];
  }
}

// Apply default filters when anchor changes (reuses useAnchorSyncedDefaults)
const resetFiltersToDefaults = () => {
  const defaults = app.model.outputs.filterConfig?.defaults;
  if (!defaults || defaults.length === 0) {
    app.model.data.filterModel = { type: 'and', filters: [], id: 0 } as PlAdvancedFilterType;
    return;
  }

  let nextId = 1;
  // Build the tree: RootFilter { and, [ NodeFilter { and, [leaf] }, ... ] }
  // Cast needed because TypeScript can't infer the complex discriminated union through spread
  const filters = defaults.map((d) => ({
    type: 'and' as const,
    filters: [{ ...d.default, id: nextId++, isExpanded: false }],
    id: nextId++,
  })) as PlAdvancedFilterType['filters'];

  app.model.data.filterModel = {
    type: 'and' as const,
    filters,
    id: 0,
  } as PlAdvancedFilterType;
};

useAnchorSyncedDefaults({
  getAnchor: () => app.model.data.inputAnchor,
  getConfig: () => {
    const config = app.model.outputs.filterConfig;
    if (!config) return undefined;
    // Adapt to ConfigWithOptions shape expected by useAnchorSyncedDefaults
    return {
      options: config.items.map((item) => ({
        value: {
          anchorRef: config.anchorMap[item.id as string]?.anchorRef,
          anchorName: config.anchorMap[item.id as string]?.anchorName ?? 'main',
          column: item.id as SUniversalPColumnId,
        },
        label: item.label,
      })),
      defaults: config.defaults,
    };
  },
  clearState: () => {
    app.model.data.filterModel = { type: 'and', filters: [], id: 0 };
  },
  applyDefaults: () => {
    resetFiltersToDefaults();
  },
  hasDefaults: () => (app.model.outputs.filterConfig?.defaults?.length ?? 0) > 0,
  hasExistingStateForConfig: (config) => {
    const filters = app.model.data.filterModel?.filters ?? [];
    if (filters.length === 0) return false;
    const configColumnIds = new Set(config.options?.map((o) => o.value.column) ?? []);
    // Check if any leaf filter references a column from the current config
    return hasLeafMatchingConfig(app.model.data.filterModel, configColumnIds);
  },
  hasAnyItems: () => {
    return (app.model.data.filterModel?.filters?.length ?? 0) > 0;
  },
  getInitializedAnchorKey: () => {
    return app.model.data.filtersInitializedForAnchor;
  },
  setInitializedAnchorKey: (key) => {
    app.model.data.filtersInitializedForAnchor = key;
  },
});

function hasLeafMatchingConfig(node: unknown, configColumnIds: Set<SUniversalPColumnId>): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if ('filters' in n && Array.isArray(n.filters)) {
    return (n.filters as unknown[]).some((child) => hasLeafMatchingConfig(child, configColumnIds));
  }
  // Leaf — check column
  if ('column' in n && typeof n.column === 'string') {
    return configColumnIds.has(n.column as SUniversalPColumnId);
  }
  return false;
}
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
      <div class="d-flex flex-column gap-6">
        <PlRow>
          Keep clonotypes that:
          <PlTooltip>
            <PlIcon16 name="info" />
            <template #tooltip> Only clonotypes that satisfy these conditions will be kept. All others will be excluded. </template>
          </PlTooltip>
        </PlRow>

        <PlAdvancedFilter
          v-model:filters="app.model.data.filterModel"
          :items="filterItems"
          :get-suggest-options="getSuggestOptions"
          :enable-dnd="false"
          :enable-add-group-button="false"
        >
          <template #add-group-buttons>
            <div class="d-flex flex-column gap-6">
              <PlBtnSecondary icon="add" @click="app.model.data.filterModel.filters.push({ type: 'and', filters: [], id: Date.now() })">
                Add Filter
              </PlBtnSecondary>
              <PlBtnSecondary icon="reverse" @click="resetFiltersToDefaults">
                Reset to defaults
              </PlBtnSecondary>
            </div>
          </template>
        </PlAdvancedFilter>
      </div>

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
