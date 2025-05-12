<script setup lang="ts">
import type {
  PColumnSpec,
  PlRef,
  PTableColumnSpec,
  RowSelectionModel,
} from '@platforma-sdk/model';
import {
  plRefsEqual,
} from '@platforma-sdk/model';
import type {
  PlAgDataTableSettings,
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
  PlDropdownMulti,
  PlMultiSequenceAlignment,
} from '@platforma-sdk/ui-vue';
import {
  computed,
  reactive,
  ref,
} from 'vue';
import {
  useApp,
} from '../app';

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

const tableSettings = computed<PlAgDataTableSettings>(() => (
  app.model.outputs.table
    ? {
        sourceType: 'ptable',
        model: app.model.outputs.table,
      }
    : undefined
));

const columns = ref<PTableColumnSpec[]>([]);
const selection = reactive<{
  model?: RowSelectionModel;
}>({
  model: {
    axesSpec: [],
    selectedRowsKeys: [],
  },
});

const filterColumns = computed<PTableColumnSpec[]>(() => {
  return app.model.outputs.scoreColumns?.map((c) => ({
    type: 'column',
    spec: c.spec,
    id: c.id,
  })) ?? [];
});

const isLabelColumnOption = (column: PColumnSpec) => {
  return column.valueType === 'String';
};

const isSequenceColumn = (column: PColumnSpec) => {
  if (!(column.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'))
    return false;

  const isBulkSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/alphabet'] === 'aminoacid';
  const isSingleCellSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/vdj/scClonotypeChain/index'] === 'primary'
    // && column.axesSpec.length >= 1
    && column.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey';

  return isBulkSequence(column) || isSingleCellSequence(column);
};
</script>

<template>
  <PlBlockPage>
    <template #title>
      {{ app.model.ui.title }} / {{ selection.model?.selectedRowsKeys.length ?? 0 }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters
          v-model="app.model.ui.filterModel"
          :columns="filterColumns"
          :defaults="app.model.outputs.defaultFilters"
        />
        <PlMultiSequenceAlignment
          v-model="app.model.ui.alignmentModel"
          :label-column-option-predicate="isLabelColumnOption"
          :sequence-column-predicate="isSequenceColumn"
          :pframe="app.model.outputs.pf"
          :row-selection-model="selection.model"
        />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost @click.stop="() => (settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      v-model="app.model.ui.tableState"
      v-model:selected-rows="selection.model"
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
      <PlDropdownMulti v-model="app.model.args.rankingOrder" :options="app.model.outputs.rankingOptions" label="Ranking columns" >
        <template #tooltip>
          Select the columns to use for priority-based, sequential sorting of clonotypes.
        </template>
      </PlDropdownMulti>
      <PlNumberField
        v-model="app.model.args.topClonotypes"
        label="Top clonotypes" :minValue="2" :step="1"
      >
        <template #tooltip>
          Choose how many top clonotypes to include, ranked by the columns you selected in the dropdown above.
        </template>
      </PlNumberField>
    </PlSlideModal>
  </PlBlockPage>
</template>
