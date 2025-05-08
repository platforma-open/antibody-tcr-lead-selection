<script setup lang="ts">
import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import type { PDataColumnSpec } from '@platforma-sdk/model';
import { PlBlockPage } from '@platforma-sdk/ui-vue';
import { GraphMaker } from '@milaboratories/graph-maker';
import { useApp } from '../app';

const app = useApp();

function getColumnSpec(name: string): PDataColumnSpec {
  const index = app.model.outputs.histPcols?.findIndex((p) => p.spec.name === name) ?? -1;
  return (index >= 0 ? app.model.outputs.histPcols?.[index].spec : {}) as PDataColumnSpec;
}

const defaultOptions: PredefinedGraphOption<'histogram'>[] = [
  {
    inputName: 'value',
    selectedSource: getColumnSpec('pl7.app/vdj/sequenceLength'),
  },
];

</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.ui.graphStateHistogram"
      chartType="histogram"
      :p-frame="app.model.outputs.pf"
      :default-options="defaultOptions"
    />
  </PlBlockPage>
</template>
