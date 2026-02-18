<script setup lang="ts">
import '@milaboratories/graph-maker/styles';
import { PlMultiSequenceAlignment } from '@milaboratories/multi-sequence-alignment';
import strings from '@milaboratories/strings';
import { PlBlockPage, PlBtnGhost, PlSlideModal } from '@platforma-sdk/ui-vue';

import { useApp } from '../app';

import type { PredefinedGraphOption } from '@milaboratories/graph-maker';
import { GraphMaker } from '@milaboratories/graph-maker';
import type { PlSelectionModel } from '@platforma-sdk/model';
import { computed, ref } from 'vue';
import { isSequenceColumn } from '../util';

const app = useApp();

const defaultOptions = computed((): PredefinedGraphOption<'scatterplot-umap'>[] | null => {
  if (!app.model.outputs.umapPcols?.ok)
    return null;

  const umapPcols = app.model.outputs.umapPcols.value;

  const getColSpec = (name: string) => {
    const col = umapPcols?.find((p) => p.spec.name === name);
    return col?.spec;
  };

  const umap1Col = getColSpec('pl7.app/vdj/umap1');
  const umap2Col = getColSpec('pl7.app/vdj/umap2');
  const leadSelectionCol = getColSpec('pl7.app/vdj/lead-selection');

  if (!umap1Col || !umap2Col)
    return null;

  const defaults: PredefinedGraphOption<'scatterplot-umap'>[] = [
    {
      inputName: 'x',
      selectedSource: umap1Col,
    },
    {
      inputName: 'y',
      selectedSource: umap2Col,
    },
  ];

  if (leadSelectionCol) {
    defaults.push({
      inputName: 'highlight',
      selectedSource: leadSelectionCol,
    });
  }

  return defaults;
});

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
      :meta-column-predicate="(spec) => !spec.annotations?.['pl7.app/trace']?.includes('antibody-tcr-lead-selection')"
      :status-text="{ noPframe: { title: strings.callToActions.configureSettingsAndRun } }"
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
        :p-frame="app.model.outputs.pf?.ok ? app.model.outputs.pf.value : undefined"
        :selection="selection"
      />
    </PlSlideModal>
  </PlBlockPage>
</template>
