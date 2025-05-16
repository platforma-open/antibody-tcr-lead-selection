<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlBlockPage } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import { ref, watch } from 'vue';

const app = useApp();

function getDefaultOptions(topClonotypes?: number | undefined) {
  const defaults: GraphMakerProps['defaultOptions'] = [
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

  if (topClonotypes !== undefined) {
    defaults.push({
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

  return defaults;
}

// Steps needed to reset graph maker after changing input table
const defaultOptions = ref(getDefaultOptions(app.model.args.topClonotypes));
const key = ref(defaultOptions.value ? JSON.stringify(defaultOptions.value) : '');
// Reset graph maker state to allow new selection of defaults
watch(() => [app.model.outputs.UMAPPf, app.model.args.topClonotypes], (_) => {
  delete app.model.ui.graphStateUMAP.optionsState;
  defaultOptions.value = getDefaultOptions(app.model.args.topClonotypes);
  key.value = defaultOptions.value ? JSON.stringify(defaultOptions.value) : '';
},
// immediate - to trigger first time before first change
// deep - for objects of complicated structure
{ deep: true, immediate: true },
);

</script>

<template>
  <PlBlockPage>
    <GraphMaker
      :key="key"
      v-model="app.model.ui.graphStateUMAP" chartType="scatterplot-umap"
      :p-frame="app.model.outputs.UMAPPf" :default-options="defaultOptions"
    />
  </PlBlockPage>
</template>
