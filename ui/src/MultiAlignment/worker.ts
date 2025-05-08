import { parseBiowasmAlignment } from '../utils/alignment';
import { exec } from './exec';
import { highlightAlignment } from '../utils/colors';
import type { AlignmentRow } from '../types';

onmessage = async (event) => {
  const { sequenceRows } = event.data;
  const stdout = await exec(sequenceRows);
  const parsed = parseBiowasmAlignment(stdout);
  const highlighted = highlightAlignment(parsed.map((row) => row.sequence));

  const result: AlignmentRow[] = parsed.map((row, index) => ({
    ...row,
    highlighted: highlighted[index],
  }));

  postMessage({ result });
};
