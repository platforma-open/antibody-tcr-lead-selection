<script setup lang="ts">
import type {
  PlRef,
  PlSelectionModel,
  PTableColumnSpec,
} from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import type { PlAgDataTableSettings } from '@platforma-sdk/ui-vue';
import {
  PlAgDataTableToolsPanel,
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMultiSequenceAlignment,
  PlNumberField,
  PlSlideModal,
  PlTableFilters,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from '../app';
import {
  defaultFilters,
  isLabelColumnOption,
  isLinkerColumn,
  isSequenceColumn,
} from '../util';
import RankList from './components/RankList.vue';

const app = useApp();

const settingsOpen = ref(app.model.args.inputAnchor === undefined);
const multipleSequenceAlignmentOpen = ref(false);

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  app.model.ui.filterModel = {}; // clear filters
  const datasetName = ref
    && app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, ref))
      ?.label;
  app.model.ui.title = ['Antibody/TCR Leads', datasetName]
    .filter(Boolean).join(' - ');
}

const tableSettings = computed<PlAgDataTableSettings>(() => (
  app.model.outputs.table
    ? { sourceType: 'ptable', model: app.model.outputs.table }
    : undefined
));

const columns = ref<PTableColumnSpec[]>([]);

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
      <PlAgDataTableToolsPanel>
        <PlTableFilters
          v-model="app.model.ui.filterModel"
          :columns="columns"
          :defaults="defaultFilters"
        />
      </PlAgDataTableToolsPanel>
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
      show-columns-panel
      show-export-button
      @columns-changed="(newColumns) => (columns = newColumns)"
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>
      <PlDropdownRef
        :options="app.model.outputs.inputOptions"
        :model-value="app.model.args.inputAnchor"
        label="Select dataset"
        clearable
        @update:model-value="setAnchorColumn"
      />
      <PlNumberField
        v-model="app.model.args.topClonotypes"
        label="Pick top candidates"
        :minValue="2"
        :step="1"
      >
        <template #tooltip>
          Choose how many top clonotypes to include, ranked by the columns you
          selected in the dropdown above.
        </template>
      </PlNumberField>

      <!-- @TODO: move to SDK in the future -->
      <RankList />
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
