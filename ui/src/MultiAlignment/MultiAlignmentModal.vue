<script lang="ts" setup>
import { PlSlideModal, PlCheckbox, PlBtnPrimary } from '@platforma-sdk/ui-vue';
import { useCssModule } from 'vue';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, computed } from 'vue';
import { parseBiowasmAlignment } from '../utils/alignment';
import type { ResidueType } from '../utils/colors';
import { highlightAlignment, residueType, residueTypeLabels, residueTypeColorMap } from '../utils/colors';
import { exec } from './exec';

const props = defineProps<{
  labelsToRecords: [string, string][] | undefined;
}>();

const output = ref('');

const style = useCssModule();

const enabledTypes = ref<readonly ResidueType[]>(residueType);

const toggleType = (type: ResidueType) => {
  enabledTypes.value = enabledTypes.value.includes(type)
    ? enabledTypes.value.filter((t) => t !== type)
    : [...enabledTypes.value, type];
};

const computedOutput = computed(() => {
  const parsedAlignment = parseBiowasmAlignment(output.value);
  if (parsedAlignment.length === 0) {
    return '';
  }
  const sequences = parsedAlignment.map((item) => item.sequence);
  const highlightedSequences = highlightAlignment(sequences);

  return parsedAlignment.map((alignmentItem, index) => {
    const sequenceHtml = highlightedSequences[index].map((highlight) => {
      if (enabledTypes.value.includes(highlight.color)) {
        return `<span style="color: ${residueTypeColorMap[highlight.color]}">${highlight.residue}</span>`;
      }
      return `<span>${highlight.residue}</span>`;
    }).join('');
    return `<span class="${style.header}">${alignmentItem.name}</span><span class="${style.sequence}">${sequenceHtml}</span>`;
  }).join('\n');
});

// const data = `>1aab_
// GKGDPKKPRGKMSSYAFFVQTSREEHKKKHPDASVNFSEFSKKCSERWKT
// MSAKEKGKFEDMAKADKARYEREMKTYIPPKGE
// >1j46_A
// MQDRVKRPMNAFIVWSRDQRRKMALENPRMRNSEISKQLGYQWKMLTEAE
// KWPFFQEAQKLQAMHREKYPNYKYRPRRKAKMLPK
// >1k99_A
// MKKLKKHPDFPKKPLTPYFRFFMEKRAKYAKLHPEMSNLDLTKILSKKYK
// ELPEKKKMKYIQDFQREKQEFERNLARFREDHPDLIQNAKK
// >2lef_A
// MHIKKPLNAFMLYMKEMRANVVAESTLKESAAINQILGRRWHALSREEQA
// KYYELARKERQLHMQLYPGWSARDNYGKKKKRKREK`;

const runAlignment = () => {
  exec(props.labelsToRecords).then((result) => {
    output.value = result;
  });
};

const isDisabled = computed(() => {
  const a = props.labelsToRecords ?? [];
  return a.length === 0 || a.length > 100;
});
</script>

<template>
  <PlSlideModal v-model="isOpen" width="80%" :close-on-outside-click="false">
    <template #title>Multi Alignment</template>
    <slot/>
    <PlBtnPrimary :disabled="isDisabled" @click="runAlignment">Run Alignment {{ props.labelsToRecords?.length }}</PlBtnPrimary>
    <div>
      <div :class="[$style.output, 'pl-scrollable']" v-html="computedOutput" />
    </div>
    <div>
      <PlCheckbox
        v-for="type in residueType"
        :key="type"
        :model-value="enabledTypes.includes(type)"
        @update:model-value="toggleType(type)"
      >
        <span :class="[$style.colorSample]" :style="{ backgroundColor: residueTypeColorMap[type] }" />
        {{ residueTypeLabels[type] }}
      </PlCheckbox>
    </div>
  </PlSlideModal>
</template>

<style module>
.output {
  white-space: pre;
  font-family: monospace;
  outline: 1px solid #ccc;
  overflow: auto;
  max-width: 100%;
  padding: 24px 0;
  display: grid;
  grid-template-columns: fit-content(20px) 1fr;
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
