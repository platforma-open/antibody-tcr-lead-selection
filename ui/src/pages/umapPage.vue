<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlAgDataTableToolsPanel, PlBlockPage, PlMultiSequenceAlignment } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import type { AxisSpec, PValue, RowSelectionModel } from '@platforma-sdk/model';
import { ref } from 'vue';
import { isLabelColumnOption, isLinkerColumn, isSequenceColumn } from '../util';

const app = useApp();

const defaultOptions: GraphMakerProps['defaultOptions'] = [
  {
    inputName: 'x',
    selectedSource: {
      kind: 'PColumn',
      name: 'pl7.app/vdj/umap1',
      valueType: 'Double',
      axesSpec: [
        {
          name: 'pl7.app/clonotypeKey',
          type: 'String',
        },
      ],
    },
  },
  {
    inputName: 'y',
    selectedSource: {
      kind: 'PColumn',
      name: 'pl7.app/vdj/umap2',
      valueType: 'Double',
      axesSpec: [
        {
          name: 'pl7.app/clonotypeKey',
          type: 'String',
        },
      ],
    },
  },
  {
    inputName: 'filters',
    selectedSource: {
      kind: 'PColumn',
      name: 'pl7.app/vdj/sampling-column-umap',
      valueType: 'Int',
      axesSpec: [
        {
          name: 'pl7.app/clonotypeKey',
          type: 'String',
        },
      ],
    },
  },
];

const selection = ref<RowSelectionModel>({
  axesSpec: [],
  selectedRowsKeys: [],
});

function onUpdateLasso(data: { axesSpec: AxisSpec[]; selectedRowsKeys: PValue[][] }) {
  console.log('onUpdateLasso', data);
  selection.value = {
    axesSpec: data.axesSpec,
    selectedRowsKeys: data.selectedRowsKeys.map((v) => v as string[]),
  };
}
</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.graphStateUMAP"
      v-model:selection-model="selection"
      chartType="scatterplot-umap"
      :data-state-key="app.model.outputs.UMAPPf"
      :p-frame="app.model.outputs.UMAPPf"
      :default-options="defaultOptions"
      @update-lasso-polygon="onUpdateLasso"
    >
      <template #titleLineSlot>
        <PlAgDataTableToolsPanel>
          <PlMultiSequenceAlignment
            v-model="app.model.ui.alignmentModel"
            :label-column-option-predicate="isLabelColumnOption"
            :sequence-column-predicate="isSequenceColumn"
            :linker-column-predicate="isLinkerColumn"
            :p-frame="app.model.outputs.pf"
            :row-selection-model="selection"
          />
        </PlAgDataTableToolsPanel>
      </template>
    </GraphMaker>
  </PlBlockPage>
</template>
