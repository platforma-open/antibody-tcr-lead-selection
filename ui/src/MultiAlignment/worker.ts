import { parseBiowasmAlignment } from '../utils/alignment';
import { exec } from './exec';
import { highlightAlignment } from '../utils/colors';
import type { AlignmentRow, SequenceRow } from '../types';
import type { Message } from './wm';

onmessage = async (event: MessageEvent<Message<{ sequenceRows: SequenceRow[] }>>) => {
  const { sequenceRows } = event.data.data;
  const stdout = await exec(sequenceRows);
  const parsed = parseBiowasmAlignment(stdout);
  const highlighted = highlightAlignment(parsed.map((row) => row.sequence));

  const result: AlignmentRow[] = parsed.map((row, index) => ({
    ...row,
    label: sequenceRows.find((r) => r.header === row.header)?.label,
    highlighted: highlighted[index],
  }));

  postMessage({ id: event.data.id, data: { result } });
};
