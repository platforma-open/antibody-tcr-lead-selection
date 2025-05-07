import Aioli from '@biowasm/aioli';

export const exec = async (labelsToRecords: [string, string][] | undefined) => {
  if (!labelsToRecords) {
    return '';
  }

  if (labelsToRecords.length === 0) {
    return '';
  }

  const data = labelsToRecords.map(([label, record]) => `>${label}\n${record}`).join('\n') + '\n';

  const CLI = await new Aioli(['kalign/3.3.1']);
  // Create sample data (source: https://github.com/TimoLassmann/kalign/blob/master/dev/data/BB11001.tfa)
  await CLI.mount({
    name: 'input.fa',
    data,
  });

  await CLI.exec('kalign input.fa -f fasta -o result.fasta');
  return await CLI.cat('result.fasta');
};
