import type { HighlightedResidue } from './utils/colors';

export type SequenceRow = {
  label: string;
  sequence: string;
  header: string;
};

export type AlignmentRow = {
  header: string;
  sequence: string;
  highlighted: HighlightedResidue[];
};
