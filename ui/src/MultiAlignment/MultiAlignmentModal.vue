<script lang="ts" setup>
import { PlSlideModal } from '@platforma-sdk/ui-vue';
import Aioli from '@biowasm/aioli';
import { useCssModule } from 'vue';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, onMounted, computed } from 'vue';
import { parseBiowasmAlignment } from '../utils/alignment';
import { highlightAlignment } from '../utils/colors';
const output = ref('');

const style = useCssModule();

const computedOutput = computed(() => {
  const parsedAlignment = parseBiowasmAlignment(output.value);
  if (parsedAlignment.length === 0) {
    return '';
  }
  const sequences = parsedAlignment.map((item) => item.sequence);
  const highlightedSequences = highlightAlignment(sequences);

  return parsedAlignment.map((alignmentItem, index) => {
    const sequenceHtml = highlightedSequences[index].map((highlight) => {
      return `<span style="color: ${highlight.color}">${highlight.residue}</span>`;
    }).join('');
    return `<span class="${style.header}">${alignmentItem.name}</span><span class="${style.sequence}">${sequenceHtml}</span>`;
  }).join('\n');
});

const data = `>1aab_
GKGDPKKPRGKMSSYAFFVQTSREEHKKKHPDASVNFSEFSKKCSERWKT
MSAKEKGKFEDMAKADKARYEREMKTYIPPKGE
>1j46_A
MQDRVKRPMNAFIVWSRDQRRKMALENPRMRNSEISKQLGYQWKMLTEAE
KWPFFQEAQKLQAMHREKYPNYKYRPRRKAKMLPK
>1k99_A
MKKLKKHPDFPKKPLTPYFRFFMEKRAKYAKLHPEMSNLDLTKILSKKYK
ELPEKKKMKYIQDFQREKQEFERNLARFREDHPDLIQNAKK
>2lef_A
MHIKKPLNAFMLYMKEMRANVVAESTLKESAAINQILGRRWHALSREEQA
KYYELARKERQLHMQLYPGWSARDNYGKKKKRKREK`;

const exec = async () => {
  const CLI = await new Aioli(['kalign/3.3.1']);
  // Create sample data (source: https://github.com/TimoLassmann/kalign/blob/master/dev/data/BB11001.tfa)
  await CLI.mount({
    name: 'input.fa',
    data,
  });

  await CLI.exec('kalign input.fa -f fasta -o result.fasta');
  const result = await CLI.cat('result.fasta');

  output.value = result;
};

onMounted(async () => {
  await exec();
});
</script>

<template>
  <PlSlideModal v-model="isOpen" width="80%" :close-on-outside-click="false">
    <template #title>Multi Alignment</template>
    <div>
      <div :class="$style.output" v-html="computedOutput" />
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
}

.header {
  color: #000;
  min-width: 100px;
  display: inline-block;
}

.sequence {
  > span {
    width: 14px;
    padding: 0 2px;
    display: inline-block;
  }
}
</style>
