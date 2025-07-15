<script setup lang="ts">
import type {
  PlRef,
  PlSelectionModel,
} from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import {
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMultiSequenceAlignment,
  PlNumberField,
  PlSlideModal,
  PlSectionSeparator,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from '../app';
import {
  isLabelColumnOption,
  isLinkerColumn,
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
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.table,
  // filtersConfig: ({ column }) => ({ default: defaultFilters(column) }),
});

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
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

      <!-- Clonotype filtering section -->
      <PlSectionSeparator>Clonotype filtering</PlSectionSeparator>
      <FilterList />

      <!-- Clonotype sampling section -->
      <PlSectionSeparator>Clonotype sampling</PlSectionSeparator>
      <PlNumberField
        v-model="app.model.args.topClonotypes"
        :style="{ width: '320px' }"
        label="Pick top candidates"
        :minValue="2"
        :step="1"
      >
        <template #tooltip>
          Choose how many top clonotypes to include, ranked by the columns to be
          selected in the "Rank by" section below
        </template>
      </PlNumberField>

      <RankList />

      <PlAlert v-if="app.model.args.rankingOrder.length === 0 && app.model.args.topClonotypes !== undefined" type="warn" :style="{ width: '320px' }">
        {{ "Warning: Please select at least one ranking column to determine which clonotypes to include in the top candidates." }}
      </PlAlert>
      <PlAlert
        v-if="app.model.args.topClonotypes !== undefined
          && app.model.args.rankingOrder.some((order) => order.value === undefined)" type="warn"
        :style="{ width: '320px' }"
      >
        {{ "Warning: Please remove or assign values to empty ranking columns" }}
      </PlAlert>
    </PlSlideModal>
    <PlSlideModal v-model="multipleSequenceAlignmentOpen" width="100%">
      <template #title>Multiple Sequence Alignment</template>
      <PlMultiSequenceAlignment
        v-model="app.model.ui.alignmentModel"
        :label-column-option-predicate="isLabelColumnOption"
        :sequence-column-predicate="isSequenceColumn"
        :linker-column-predicate="isLinkerColumn"
        :p-frame="app.model.outputs.pf"
        :selection="selection"
      />
    </PlSlideModal>
  </PlBlockPage>
</template>
