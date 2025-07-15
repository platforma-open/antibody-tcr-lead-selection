<script setup lang="ts">
import type {
  PlRef,
  PlSelectionModel,
} from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import {
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMultiSequenceAlignment,
  PlNumberField,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { ref, watch } from 'vue';
import { useApp } from '../app';
import {
  isLabelColumnOption,
  isLinkerColumn,
  isSequenceColumn,
} from '../util';
import FilterList from './components/FilterList.vue';
import RankList from './components/RankList.vue';

const app = useApp();

const settingsOpen = ref(app.model.args.inputAnchor === undefined);
const multipleSequenceAlignmentOpen = ref(false);

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  const datasetName = ref
    && app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, ref))
      ?.label;
  app.model.ui.title = ['Antibody/TCR Leads', datasetName]
    .filter(Boolean).join(' - ');
}

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.table,
  // filtersConfig: ({ column }) => ({ default: defaultFilters(column) }),
});

let defaultRankingLabel = 'Number of Samples';
watch(() => [app.model.outputs.rankingOptions], (_) => {
  const sampleNumber = app.model.outputs.rankingOptions?.find((o) => o.label.split(' / ')[0] === 'Number of Samples');
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
      show-export-button
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
      <FilterList />
      <PlAlert v-if="app.model.args.rankingOrder.length === 0 && app.model.args.topClonotypes !== undefined" type="warn">
        {{ "Warning: If you don't select any Clonotype Ranking columns to pick the top candidates, '" + defaultRankingLabel + "' will be used by default in increasing order" }}
      </PlAlert>
      <PlAlert
        v-if="app.model.args.topClonotypes !== undefined
          && app.model.args.rankingOrder.some((order) => order.value === undefined)" type="warn"
      >
        {{ "Warning: Please remove or assign values to empty ranking columns" }}
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
