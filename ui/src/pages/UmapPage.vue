<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlBlockPage, PlBtnGhost, PlSlideModal } from '@platforma-sdk/ui-vue';
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import { useApp } from '../app';

import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import type { PlSelectionModel } from '@platforma-sdk/model';
import { ref } from 'vue';
import { isSequenceColumn } from '../util';

const app = useApp();

const defaultOptions: PredefinedGraphOption<'scatterplot-umap'>[] = [
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
