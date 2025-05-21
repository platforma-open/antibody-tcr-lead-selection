<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlAgDataTableToolsPanel, PlBlockPage, PlMultiSequenceAlignment } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import type { PlSelectionModel } from '@platforma-sdk/model';
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

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});

</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.graphStateUMAP"
      v-model:selection="selection"
      chartType="scatterplot-umap"
      :data-state-key="app.model.outputs.UMAPPf"
      :p-frame="app.model.outputs.UMAPPf"
      :default-options="defaultOptions"
    >
      <template #titleLineSlot>
        <PlAgDataTableToolsPanel>
          <PlMultiSequenceAlignment
            v-model="app.model.ui.alignmentModel"
            :label-column-option-predicate="isLabelColumnOption"
            :sequence-column-predicate="isSequenceColumn"
            :linker-column-predicate="isLinkerColumn"
            :p-frame="app.model.outputs.pf"
            :selection="selection"
          />
        </PlAgDataTableToolsPanel>
      </template>
    </GraphMaker>
  </PlBlockPage>
</template>
