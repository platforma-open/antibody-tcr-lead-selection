<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlBlockPage, PlBtnGhost, PlMultiSequenceAlignment, PlSlideModal } from '@platforma-sdk/ui-vue';
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
    inputName: 'highlight',
    selectedSource: {
      kind: 'PColumn',
      name: 'pl7.app/vdj/sampling-column',
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

const multipleSequenceAlignmentOpen = ref(false);
</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.graphStateUMAP"
      v-model:selection="selection"
      chartType="scatterplot-umap"
      :data-state-key="app.model.outputs.umapPf"
      :p-frame="app.model.outputs.umapPf"
      :default-options="defaultOptions"
    >
      <template #titleLineSlot>
        <PlBtnGhost
          icon="dna"
          @click.stop="() => (multipleSequenceAlignmentOpen = true)"
        >
          Multiple Sequence Alignment
        </PlBtnGhost>
      </template>
    </GraphMaker>
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
