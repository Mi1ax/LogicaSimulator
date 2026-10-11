export function parseJedec(jedecString: string, maxFuses: number = 5828): boolean[] {
  const fuses = new Array(maxFuses).fill(false);

  // Default fuse state (F0* or F1*)
  const fMatch = jedecString.match(/F(\d)\s*\*/);
  const defaultState = fMatch ? fMatch[1] === '1' : false;
  fuses.fill(defaultState);

  // Find all L fields: L<address> <data>*
  const lRegex = /L(\d+)\s+([01\s]+)\*/g;
  let match;
  while ((match = lRegex.exec(jedecString)) !== null) {
    let index = parseInt(match[1], 10);
    const data = match[2].replace(/\s/g, '');
    for (let i = 0; i < data.length; i++) {
      if (index < maxFuses) {
        fuses[index] = data[i] === '1';
      }
      index++;
    }
  }

  return fuses;
}
