import { parseBiowasmAlignment } from '../utils/alignment';
import { exec } from './exec';
import { highlightAlignment } from '../utils/colors';
import type { AlignmentRow, SequenceRow } from '../types';
import type { Message } from './wm';

onmessage = async (event: MessageEvent<Message<{ sequenceRows: SequenceRow[] }>>) => {
  try {
    const t1 = performance.now();
    const { sequenceRows } = event.data.data;
    const stdout = await exec(sequenceRows);
    const t2 = performance.now();
    console.log(`Time taken to run biowasm: ${t2 - t1} milliseconds`);
    const parsed = parseBiowasmAlignment(stdout);

    const t3 = performance.now();
    const highlighted = highlightAlignment(parsed.map((row) => row.sequence));
    const t4 = performance.now();
    console.log(`Time taken to highlight: ${t4 - t3} milliseconds`);

    const result: AlignmentRow[] = parsed.map((row, index) => ({
      ...row,
      label: sequenceRows.find((r) => r.header === row.header)?.label,
      highlighted: highlighted[index],
    }));

    postMessage({ id: event.data.id, data: { result } });
  } catch (error) {
    postMessage({ id: event.data.id, error });
  }
};

onerror = (event) => {
  console.error('Error in worker', event);
  return true;
};
