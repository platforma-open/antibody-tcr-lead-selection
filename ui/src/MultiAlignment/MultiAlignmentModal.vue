<script lang="ts" setup>
import { PlSlideModal, PlCheckbox, PlBtnPrimary, PlTooltip, PlIcon24 } from '@platforma-sdk/ui-vue';
import { useCssModule } from 'vue';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, computed, toRaw } from 'vue';
import { residueType, residueTypeLabels, residueTypeColorMap } from '../utils/colors';
import type { SequenceRow, AlignmentRow } from '../types';
import Worker from './worker?worker';

const worker = new Worker();

const props = defineProps<{
  sequenceRows: SequenceRow[] | undefined;
}>();

const output = ref<AlignmentRow[]>([]);

const style = useCssModule();

const showChemicalProperties = ref(true);

const findLabel = (header: string) => {
  return props.sequenceRows?.find((row) => row.header === header)?.label;
};

const computedOutput = computed(() => {
  const parsedAlignment = output.value;

  if (parsedAlignment.length === 0) {
    return '';
  }

  return parsedAlignment.map((alignmentItem) => {
    const sequenceHtml = alignmentItem.highlighted.map((highlight) => {
      if (showChemicalProperties.value) {
        return `<span style="color: ${residueTypeColorMap[highlight.color]}">${highlight.residue}</span>`;
      }
      return `<span>${highlight.residue}</span>`;
    }).join('');
    return `<span class="${style.sequence}">${sequenceHtml}</span>`;
  }).join('');
});

const runAlignment = () => {
  worker.postMessage({
    sequenceRows: toRaw(props.sequenceRows),
  });

  worker.onmessage = (event: { data: { result: AlignmentRow[] } }) => {
    output.value = event.data.result;
  };
};

const isDisabled = computed(() => {
  const a = props.sequenceRows ?? [];
  return a.length === 0 || a.length > 100;
});
</script>

<template>
  <PlSlideModal v-model="isOpen" width="80%" :close-on-outside-click="false">
    <template #title>Multi Alignment</template>
    <slot/>
    <PlBtnPrimary :disabled="isDisabled" @click="runAlignment">Run Alignment {{ props.sequenceRows?.length }}</PlBtnPrimary>
    <div v-if="output.length" :class="[$style.output]">
      <div>
        <span v-for="row in output" :key="row.header">
          {{ findLabel(row.header) }}
        </span>
      </div>
      <div class="pl-scrollable" v-html="computedOutput" />
    </div>
    <div :class="[$style['checkbox-panel']]">
      <PlCheckbox v-model="showChemicalProperties">Show chemical properties</PlCheckbox>
      <PlTooltip style="display: flex; align-items: center;">
        <PlIcon24 name="info" />
        <template #tooltip>
          <div
            v-for="type in residueType"
            :key="type"
          >
            <span :class="[$style.colorSample]" :style="{ backgroundColor: residueTypeColorMap[type] }" />
            {{ residueTypeLabels[type] }}
          </div>
        </template>
      </PlTooltip>
    </div>
  </PlSlideModal>
</template>

<style module>
.checkbox-panel {
  display: flex;
  align-items: center;
  gap: 8px;
}

.output {
  white-space: pre;
  font-family: monospace;
  display: grid;
  grid-template-columns: fit-content(20px) 1fr;
  > div {
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  > div:first-child {
    background-color: #f0f0f0;
    border: 1px solid #f0f0f0;
  }
  > div:last-child {
    border: 1px solid #f0f0f0;
    border-left: none;
    overflow: auto;
    max-width: 100%;
  }
}

.header {
  color: #000;
  display: inline-block;
}

.sequence {
  > span {
    width: 14px;
    padding: 0 2px;
    display: inline-block;
  }
}

.colorSample {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid #ccc;
  margin-right: 8px;
  vertical-align: middle;
}
</style>
