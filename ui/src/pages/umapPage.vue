<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlBlockPage } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';

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
];

if (app.model.args.topClonotypes !== undefined) {
  defaultOptions.push({
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
  });
}

</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.graphStateUMAP"
      :dataStateKey="app.model.outputs.UMAPPf" chartType="scatterplot-umap"
      :p-frame="app.model.outputs.UMAPPf" :default-options="defaultOptions"
    />
  </PlBlockPage>
</template>
