type ResidueColor =
  | 'blue' // Hydrophobic
  | 'red' // Positive charge
  | 'magenta' // Negative charge
  | 'green' // Polar
  | 'pink' // Cysteine
  | 'orange' // Glycine
  | 'yellow' // Proline
  | 'cyan' // Aromatic
  | 'black'; // Unconserved or not matching any threshold

interface HighlightedResidue {
  residue: string;
  position: number;
  color: ResidueColor;
}

function getColumnCounts(column: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const res of column) {
    const r = res.toUpperCase();
    if (r === '-') continue;
    counts[r] = (counts[r] || 0) + 1;
  }
  return counts;
}

function getColorForResidue(residue: string, column: string[]): ResidueColor {
  residue = residue.toUpperCase();
  if (residue === '-') return 'black';

  const total = column.filter((r) => r !== '-').length;
  const counts = getColumnCounts(column);
  const percent = (group: string[]) =>
    group.reduce((sum, r) => sum + (counts[r] || 0), 0) / total;

  // Group checks in Clustal X order
  const WLVIMAFCYHP = ['W', 'L', 'V', 'I', 'M', 'A', 'F', 'C', 'Y', 'H', 'P'];
  const KR = ['K', 'R'];
  const QE = ['Q', 'E'];
  const ED = ['E', 'D'];
  const EQD = ['E', 'Q', 'D'];
  const DEN = ['D', 'E', 'N'];
  const ST = ['S', 'T'];
  const QT = ['Q', 'T'];
  const WYA = ['W', 'Y', 'A', 'C', 'P', 'Q', 'F', 'H', 'I', 'L', 'M', 'V'];

  if (['A', 'C', 'I', 'L', 'M', 'F', 'W', 'V'].includes(residue) && percent(WLVIMAFCYHP) > 0.6)
    return 'blue';

  if (residue === 'C' && percent(WLVIMAFCYHP) > 0.6)
    return 'blue';

  if (['K', 'R'].includes(residue) && (percent(KR) > 0.6 || percent([...KR, 'Q']) > 0.85))
    return 'red';

  if (residue === 'E' && (
    percent(KR) > 0.6 || percent(QE) > 0.5 || percent(ED) > 0.5 || percent(EQD) > 0.85))
    return 'magenta';

  if (residue === 'D' && (
    percent(KR) > 0.6 || percent(DEN) > 0.85 || percent(ED) > 0.5))
    return 'magenta';

  if (residue === 'N' && (
    percent(['N']) > 0.5 || percent(DEN) > 0.85))
    return 'green';

  if (residue === 'Q' && (
    percent(KR) > 0.6 || percent(QE) > 0.5 || percent([...QT, ...KR]) > 0.85))
    return 'green';

  if (['S', 'T'].includes(residue) && (
    percent(WLVIMAFCYHP) > 0.6 || percent(ST) > 0.5 || percent(ST) > 0.85))
    return 'green';

  if (residue === 'C' && percent(['C']) > 0.85)
    return 'pink';

  if (residue === 'G')
    return 'orange';

  if (residue === 'P')
    return 'yellow';

  if (['H', 'Y'].includes(residue) && (
    percent(WLVIMAFCYHP) > 0.6 || percent(WYA) > 0.85))
    return 'cyan';

  return 'black';
}

export function highlightAlignment(sequences: string[]): HighlightedResidue[][] {
  const alignmentLength = sequences[0].length;
  const result: HighlightedResidue[][] = sequences.map(() => []);

  for (let i = 0; i < alignmentLength; i++) {
    const column = sequences.map((seq) => seq[i]);
    sequences.forEach((seq, j) => {
      const res = seq[i];
      const color = getColorForResidue(res, column);
      result[j].push({ residue: res, position: i, color });
    });
  }

  return result;
}

// Example usage:
const sequences = [
  'GKGDPKKPRG-KMSSYAFFVQTSREEHKKKHPDASVNFSEFSKKCSERWKTMSAKEKGKF',
  '-----MQDRV-KRPMNAFIVWSRDQRRKMALENPRMRNSEISKQLGYQWKMLTEAEKWPF',
  'MKKLKKHPDFPKKPLTPYFRFFMEKRAKYAKLHPEMSNLDLTKILSKKYKELPEKKKMKY',
  '-----MHI---KKPLNAFMLYMKEMRANVVAESTLKESAAINQILGRRWHALSREEQAKY',
];

const highlighted = highlightAlignment(sequences);
console.log(highlighted);
