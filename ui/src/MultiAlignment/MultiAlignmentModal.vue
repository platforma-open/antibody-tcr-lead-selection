<script lang="ts"  setup>
import { PlSlideModal } from '@platforma-sdk/ui-vue';
import Aioli from '@biowasm/aioli';
const isOpen = defineModel<boolean>({ required: true, default: false });
import { ref, onMounted, computed } from 'vue';

const output = ref('');

const computedOutput = computed(() => output.value.replace('\n', ''));

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
  <PlSlideModal v-model="isOpen" width="80%">
    <template #title>Multi Alignment</template>
    <div>
      <pre style="white-space: pre; font-family: monospace;">{{ data }}</pre>
    </div>
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
}
</style>
