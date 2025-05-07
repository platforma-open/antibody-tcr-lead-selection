<script lang="ts" setup>
import { PlSlideModal, PlCheckbox, PlBtnPrimary } from '@platforma-sdk/ui-vue';
import { useCssModule } from 'vue';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, computed } from 'vue';
import { parseBiowasmAlignment } from '../utils/alignment';
import { highlightAlignment, residueType, residueTypeLabels, residueTypeColorMap } from '../utils/colors';
import { exec } from './exec';
import type { SequenceRow } from '../types';

const props = defineProps<{
  sequenceRows: SequenceRow[] | undefined;
}>();

const output = ref('');

const style = useCssModule();

const showChemicalProperties = ref(true);

const computedOutput = computed(() => {
  const parsedAlignment = parseBiowasmAlignment(output.value);

  if (parsedAlignment.length === 0) {
    return '';
  }

  const sequences = parsedAlignment.map((item) => item.sequence);
  const highlightedSequences = highlightAlignment(sequences);

  const findLabel = (header: string) => {
    return props.sequenceRows?.find((row) => row.key === header)?.label;
  };

  const col1 = parsedAlignment.map((alignmentItem) => {
    return `<span class="${style.header}">${findLabel(alignmentItem.header)}</span>`;
  }).join('\n');

  const col2 = parsedAlignment.map((alignmentItem, index) => {
    const sequenceHtml = highlightedSequences[index].map((highlight) => {
      if (showChemicalProperties.value) {
        return `<span style="color: ${residueTypeColorMap[highlight.color]}">${highlight.residue}</span>`;
      }
      return `<span>${highlight.residue}</span>`;
    }).join('');
    return `<span class="${style.sequence}">${sequenceHtml}</span>`;
  }).join('');

  return `<div>${col1}</div><div class="pl-scrollable">${col2}</div>`;
});

const runAlignment = () => {
  exec(props.sequenceRows).then((result) => {
    output.value = result;
  });
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
    <div :class="[$style.output]" v-html="computedOutput" />
    <div>
      <PlCheckbox v-model="showChemicalProperties">Show chemical properties</PlCheckbox>
      <div
        v-for="type in residueType"
        :key="type"
      >
        <span :class="[$style.colorSample]" :style="{ backgroundColor: residueTypeColorMap[type] }" />
        {{ residueTypeLabels[type] }}
      </div>
    </div>
  </PlSlideModal>
</template>

<style module>
.output {
  white-space: pre;
  font-family: monospace;
  outline: 1px solid #ccc;
  padding: 24px 0;
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
    border: 1px solid #ccc;
  }
  > div:last-child {
    border: 1px solid #ccc;
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
