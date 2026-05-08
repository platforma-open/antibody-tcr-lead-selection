<script setup lang="ts">
import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import { PlBlockPage } from '@platforma-sdk/ui-vue';
import strings from '@milaboratories/strings';
import { computed } from 'vue';
import { useApp } from '../app';

const app = useApp();

const defaultOptions = computed((): PredefinedGraphOption<'selection'>[] => {
  return [
    {
      inputName: 'selectionStage',
      selectedSource: {
        kind: 'PColumn',
        valueType: 'Int',
        name: 'pl7.app/selectionStage',
        axesSpec: [],
      },
    },
  ];
});
</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.data.selectionPlotState"
      chartType="selection"
      :p-frame="app.model.outputs.selectionStagePf"
      :default-options="defaultOptions"
      :status-text="{ noPframe: { title: strings.callToActions.configureSettingsAndRun } }"
    />
  </PlBlockPage>
</template>
