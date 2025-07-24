<script setup lang="ts">
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  PlNumberField,
  PlSectionSeparator,
  PlSlideModal,
  PlTextArea,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from '../app';

const app = useApp();

const settingsOpen = ref(false);

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.table,
  // filtersConfig: ({ column }) => ({ default: defaultFilters(column) }),
});

</script>

<template>
  <PlBlockPage>
    <template #title>
      {{ app.model.ui.title }}
    </template>
    <template #append>
      <PlBtnGhost
        icon="settings"
        @click.stop="() => (settingsOpen = true)"
      >
        Settings
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      v-model="app.model.ui.tableState"
      :settings="tableSettings"
      show-export-button
      disable-filters-panel
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>

      <!-- Clonotype filtering section -->
      <PlAccordionSection label="Docking parameters (HADDOCK3)">
        <PlNumberField
          v-model="app.model.args.haddockParams.haddockSampling"
          label="Haddock sampling"
          :minValue="1"
          :step="1"
          :maxValue="50000"
          placeholder="1000"
        >
          <template #tooltip>
            Number of rigidbody docking models to generate for HADDOCK3 docking.
          </template>
        </PlNumberField>
        <PlNumberField
          v-model="app.model.args.haddockParams.haddockSeleTop"
          label="Haddock selection top"
          :minValue="1"
          :step="1"
          :maxValue="50000"
          placeholder="200"
        >
          <template #tooltip>
            Number of models from the input sampling models to be used in HADDOCK3 docking refinement steps.
          </template>
        </PlNumberField>
        <PlNumberField
          v-model="app.model.args.haddockParams.haddockTopClusters"
          label="Haddock top clusters"
          :minValue="1"
          :step="1"
          :maxValue="99999"
          placeholder="10"
        >
          <template #tooltip>
            Number of clusters to consider (ranked by score) for HADDOCK3 top model selection.
          </template>
        </PlNumberField>
        <PlNumberField
          v-model="app.model.args.haddockParams.haddockFinalTop"
          label="Haddock final top"
          :minValue="1"
          :step="1"
          :maxValue="99999"
          placeholder="10"
        >
          <template #tooltip>
            Number of best-ranked models to select per cluster to be used in affinity step.
          </template>
        </PlNumberField>
      </PlAccordionSection>

      <PlSectionSeparator>Required inputs</PlSectionSeparator>
      <PlTextArea
        v-model="app.model.args.antigenSequence"
        label="Antigen sequence"
      >
        <template #tooltip>
          Enter the antigen sequence for affinity prediction against selected clonotypes' antigens
        </template>
      </PlTextArea>
      <PlNumberField
        v-model="app.model.args.cpu"
        label="CPU (cores)"
        :minValue="1"
        :step="1"
        :maxValue="128"
      >
        <template #tooltip>
          Sets the number of CPU cores to use for the clustering.
        </template>
      </PlNumberField>
    </PlSlideModal>
  </PlBlockPage>
</template>
