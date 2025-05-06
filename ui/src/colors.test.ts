import { test } from 'vitest';
import { highlightAlignment } from './utils/colors';

test('highlightAlignment correctly assigns colors to columns in an alignment', ({ expect }) => {
  const sequences = [
    'ARK-G',
    'AKK-A',
    'RRK-G',
  ];
  const expectedHighlight = [
    // Sequence 1: 'ARK-G'
    [
      { residue: 'A', position: 0, color: 'blue' },
      { residue: 'R', position: 1, color: 'red' },
      { residue: 'K', position: 2, color: 'red' },
      { residue: '-', position: 3, color: 'black' },
      { residue: 'G', position: 4, color: 'orange' },
    ],
    // Sequence 2: 'AKK-A'
    [
      { residue: 'A', position: 0, color: 'blue' },
      { residue: 'K', position: 1, color: 'red' },
      { residue: 'K', position: 2, color: 'red' },
      { residue: '-', position: 3, color: 'black' },
      { residue: 'A', position: 4, color: 'black' },
    ],
    // Sequence 3: 'RRK-G'
    [
      { residue: 'R', position: 0, color: 'black' },
      { residue: 'R', position: 1, color: 'red' },
      { residue: 'K', position: 2, color: 'red' },
      { residue: '-', position: 3, color: 'black' },
      { residue: 'G', position: 4, color: 'orange' },
    ],
  ];
  expect(highlightAlignment(sequences)).toEqual(expectedHighlight);
});
