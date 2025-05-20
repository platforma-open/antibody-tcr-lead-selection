<script setup lang="ts">
import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import '@milaboratories/graph-maker/styles';
import { PlBlockPage } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';

const app = useApp();

const defaultOptions = computed((): GraphMakerProps['defaultOptions'] => {
  return [
    {
      inputName: 'y',
      selectedSource: {
        kind: 'PColumn',
        valueType: 'Int',
        name: 'pl7.app/vdj/vSpectratype',
        axesSpec: [],
      },
    },
    {
      inputName: 'primaryGrouping',
      selectedSource: {
        type: 'Int',
        name: 'pl7.app/vdj/sequenceLength',
      },
    },
    {
      inputName: 'secondaryGrouping',
      selectedSource: {
        type: 'String',
        name: 'pl7.app/vdj/geneHit',
      },
    },
    {
      inputName: 'tabBy',
      selectedSource: {
        type: 'String',
        name: 'pl7.app/vdj/chain',
      },
    },
  ];
});

</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.cdr3StackedBarPlotState"
      chartType="discrete"
      :p-frame="app.model.outputs.spectratypePf"
      :default-options="defaultOptions"
    />
  </PlBlockPage>
</template>
