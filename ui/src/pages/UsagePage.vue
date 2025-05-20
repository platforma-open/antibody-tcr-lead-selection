<script setup lang="ts">
import type { GraphMakerProps } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import '@milaboratories/graph-maker/styles';
import { computed } from 'vue';
import { useApp } from '../app';

const app = useApp();

const defaultOptions = computed((): GraphMakerProps['defaultOptions'] => {
  return [
    {
      inputName: 'value',
      selectedSource: {
        kind: 'PColumn',
        valueType: 'Int',
        name: 'pl7.app/vdj/vjGeneUsage',
        axesSpec: [],
      },
    },
    {
      inputName: 'x',
      selectedSource: {
        type: 'String',
        name: 'pl7.app/vdj/geneHit',
        domain: { 'pl7.app/vdj/reference': 'VGene' },
      },
    },
    {
      inputName: 'y',
      selectedSource: {
        type: 'String',
        name: 'pl7.app/vdj/geneHit',
        domain: { 'pl7.app/vdj/reference': 'JGene' },
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
  <GraphMaker
    v-model="app.model.ui.vjUsagePlotState"
    chart-type="heatmap"
    :p-frame="app.model.outputs.vjUsagePf"
    :default-options="defaultOptions"
  />
</template>
