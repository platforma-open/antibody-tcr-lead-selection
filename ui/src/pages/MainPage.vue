<script setup lang="ts">
import type { PlRef, PTableColumnSpec } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import type {
  PlAgDataTableSettings,
  PTableRowKey,
} from '@platforma-sdk/ui-vue';
import {
  PlAgDataTableToolsPanel,
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMaskIcon24,
  PlSlideModal,
  PlTableFilters,
  PlNumberField,
  PlRow,
  PlDropdownMulti,
  listToOptions,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, ref } from 'vue';
import { useApp } from '../app';
import { Alignment, MultiAlignmentModal } from '../MultiAlignment';

const app = useApp();

const settingsOpen = ref(app.model.args.inputAnchor === undefined);

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  app.model.ui.filterModel = {};
  app.model.ui.title = 'Top Antibodies - ' + (ref
    ? app.model.outputs.inputOptions?.find((o) =>
      plRefsEqual(o.ref, ref),
    )?.label
    : '');
}

const tableSettings = computed<PlAgDataTableSettings>(() => (app.model.outputs.table
  ? {
      sourceType: 'ptable',
      model: app.model.outputs.table,
    }
  : undefined));

const columns = ref<PTableColumnSpec[]>([]);
const data = reactive<{
  selectedRows: PTableRowKey[];
}>({
  selectedRows: [],
});

const filterColumns = computed<PTableColumnSpec[]>(() => {
  return app.model.outputs.scoreColumns?.map((c) => ({
    type: 'column',
    spec: c.spec,
    id: c.id,
  })) ?? [];
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
          :columns="filterColumns"
          :defaults="app.model.outputs.defaultFilters"
        />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost @click.stop="app.openMultiAlignment">Multi Alignment</PlBtnGhost>
      <PlBtnGhost @click.stop="() => (settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      v-model="app.model.ui.tableState"
      v-model:selected-rows="data.selectedRows"
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
      <PlRow>
        <PlNumberField
          v-model="app.model.args.topClonotypes"
          label="Top clonotypes" :minValue="2" :step="1"
        >
          <template #tooltip>
            TO CHANGE: Provide a desired number of top clonotypes to be selected by ranking of filtering columns and in house scoring script.
          </template>
        </PlNumberField>
        <PlDropdownMulti v-model="app.model.args.rankingOrder" :options="app.model.outputs.rankingOptions" label="Sorting columns" >
          <template #tooltip>
            Order aware selection. Columns for sequential priority sorting of clonotypes.
          </template>
        </PlDropdownMulti>
    </PlRow>
    </PlSlideModal>
    <MultiAlignmentModal v-model="app.multiAlignmentOpen">
      <Alignment
        v-if="app.model.outputs.alignmentLabelOptions"
        v-model="app.model.ui.alignmentTableState"
        :label-options="app.model.outputs.alignmentLabelOptions"
        :table-columns="columns"
        :selected-rows="data.selectedRows"
        :table="app.model.outputs.alignmentTable"
      />
    </MultiAlignmentModal>
  </PlBlockPage>
</template>
