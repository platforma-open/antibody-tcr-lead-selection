<script setup lang="ts">
import type {
  PlRef,
  PlSelectionModel,
  PTableColumnSpec,
} from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import type { PlAgDataTableSettings } from '@platforma-sdk/ui-vue';
import {
  PlAgDataTableToolsPanel,
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMultiSequenceAlignment,
  PlNumberField,
  PlSlideModal,
  PlTableFilters,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import {
  defaultFilters,
  isLabelColumnOption,
  isLinkerColumn,
  isSequenceColumn,
} from '../util';
import RankList from './components/RankList.vue';

const app = useApp();

const settingsOpen = ref(app.model.args.inputAnchor === undefined);
const multipleSequenceAlignmentOpen = ref(false);

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  app.model.ui.filterModel = {}; // clear filters
  const datasetName = ref
    && app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, ref))
      ?.label;
  app.model.ui.title = ['Antibody/TCR Leads', datasetName]
    .filter(Boolean).join(' - ');
}

const tableSettings = computed<PlAgDataTableSettings>(() => (
  app.model.outputs.table
    ? { sourceType: 'ptable', model: app.model.outputs.table }
    : undefined
));

let defaultRankingLabel = 'Number of Samples';
watch(() => [app.model.outputs.rankingOptions], (_) => {
  const sampleNumber = app.model.outputs.rankingOptions?.find((o) => o.label === 'Number of Samples');
  if (sampleNumber) {
    defaultRankingLabel = sampleNumber.label;
    app.model.args.rankingOrderDefault = {
      value: {
        anchorRef: sampleNumber.value.anchorRef,
        anchorName: 'main',
        column: sampleNumber.value.column,
      },
      rankingOrder: 'increasing',
    };
  // if we didn't find 'Number of Samples' in ranking options, we just select the first option
  } else {
    const firstOption = app.model.outputs.rankingOptions?.[0];
    if (firstOption) {
      defaultRankingLabel = firstOption.label;
      app.model.args.rankingOrderDefault = {
        value: {
          anchorRef: firstOption.value.anchorRef,
          anchorName: 'main',
          column: firstOption.value.column,
        },
        rankingOrder: 'increasing',
      };
    }
  }
});

const columns = ref<PTableColumnSpec[]>([]);

const selection = ref<PlSelectionModel>({
  axesSpec: [],
  selectedKeys: [],
});
</script>

<template>
  <PlBlockPage>
    <template #title>
      {{ app.model.ui.title }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters
          v-model="app.model.ui.filterModel"
          :columns="columns"
          :defaults="defaultFilters"
        />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost
        icon="dna"
        @click.stop="() => (multipleSequenceAlignmentOpen = true)"
      >
        Multiple Sequence Alignment
      </PlBtnGhost>
      <PlBtnGhost
        icon="settings"
        @click.stop="() => (settingsOpen = true)"
      >
        Settings
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      v-model="app.model.ui.tableState"
      v-model:selection="selection"
      :settings="tableSettings"
      show-columns-panel
      show-export-button
      @columns-changed="(newColumns) => (columns = newColumns)"
    />
    <PlSlideModal v-model="settingsOpen" :close-on-outside-click="true">
      <template #title>Settings</template>
      <PlDropdownRef
        :options="app.model.outputs.inputOptions"
        :model-value="app.model.args.inputAnchor"
        label="Select dataset"
        clearable
        @update:model-value="setAnchorColumn"
      />
      <PlNumberField
        v-model="app.model.args.topClonotypes"
        label="Pick top candidates"
        :minValue="2"
        :step="1"
      >
        <template #tooltip>
          Choose how many top clonotypes to include, ranked by the columns to be
          selected in the "Rank by" section below
        </template>
      </PlNumberField>

      <!-- @TODO: move to SDK in the future -->
      <RankList />
      <PlAlert v-if="app.model.args.rankingOrder.length === 0 && app.model.args.topClonotypes !== undefined" type="warn">
        {{ "Warning: If you don't select any Clonotype Ranking columns to pick the top candidates, '" + defaultRankingLabel + "' will be used by default in increasing order" }}
      </PlAlert>
    </PlSlideModal>
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
