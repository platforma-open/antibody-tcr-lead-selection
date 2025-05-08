<script lang="ts" setup>
import { PlSlideModal, PlCheckbox, PlBtnPrimary, PlTooltip, PlIcon24, PlBtnGhost, PlAlert } from '@platforma-sdk/ui-vue';
import { useCssModule } from 'vue';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, computed, toRaw, watch } from 'vue';
import { residueType, residueTypeLabels, residueTypeColorMap } from '../utils/colors';
import type { SequenceRow, AlignmentRow } from '../types';
import { WorkerManager } from './wm';

const wm = new WorkerManager();

const props = defineProps<{
  sequenceRows: SequenceRow[] | undefined;
}>();

watch(() => props.sequenceRows, () => {
  isResolved.value = false;
}, { deep: true });

const error = ref<Error | null>(null);

const isRunning = ref(false);

const isResolved = ref(false);

const output = ref<AlignmentRow[]>([]);

const style = useCssModule();

const showChemicalProperties = ref(true);

const computedOutput = computed(() => {
  const parsedAlignment = output.value;

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

const runAlignment = async () => {
  const sequenceRows = toRaw(props.sequenceRows);

  if (!sequenceRows) {
    return;
  }

  isRunning.value = true;
  error.value = null;

  try {
    const result = await wm.align({ sequenceRows });
    output.value = result.result;
    isResolved.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
  } finally {
    isRunning.value = false;
  }
};

const hasRowsToAlign = computed(() => {
  return (props.sequenceRows ?? []).length > 0;
});

const isReady = computed(() => {
  return hasRowsToAlign.value && !isResolved.value;
});
</script>

<template>
  <PlSlideModal v-model="isOpen" width="80%" :close-on-outside-click="false">
    <template #title>Multi Alignment</template>
    <slot/>
    <PlAlert v-if="error" type="error" >
      {{ error.message }}
    </PlAlert>
    <PlAlert v-if="!hasRowsToAlign" type="warn">
      Please select at least one sequence to run alignment
    </PlAlert>
    <div v-if="output.length" :class="[$style.output]">
      <div>
        <span v-for="row in output" :key="row.header">
          {{ row.label ?? 'Not found' }}
        </span>
      </div>
      <div class="pl-scrollable" v-html="computedOutput" />
    </div>
    <div v-if="output.length" :class="[$style['checkbox-panel']]">
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
    <template #actions>
      <PlBtnPrimary
        :disabled="!isReady"
        :loading="isRunning"
        @click="runAlignment"
      >
        Run Alignment ({{ props.sequenceRows?.length }} sequences)
      </PlBtnPrimary>
      <PlBtnGhost @click="isOpen = false">Close</PlBtnGhost>
    </template>
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
  max-height: 100%;
  overflow: auto;
  padding: 4px 0;
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
