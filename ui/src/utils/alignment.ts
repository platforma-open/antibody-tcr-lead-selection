export function parseBiowasmAlignment(alignment: string): { name: string; sequence: string }[] {
  const lines = alignment.split('\n');
  const sequences = [];

  let currentSequence: { name: string; sequence: string } | undefined = undefined;

  for (const line of lines) {
    if (line.startsWith('>')) {
      if (currentSequence) {
        sequences.push(currentSequence);
      }
      currentSequence = {
        name: line.slice(1),
        sequence: '',
      };
    } else {
      currentSequence!.sequence += line;
    }
  }

  if (currentSequence) {
    sequences.push(currentSequence);
  }

  return sequences;
}
