const PL = 'A-Za-zĄĆĘŁŃÓŚŻŹąćęłńóśżź';

export function fixLineSpacing(line: string): string {
  let s = line;

  // spacja po kropce i dwukropku
  s = s.replace(/\.(?=[^.\s])/g, '. ');
  s = s.replace(/:(?=\S)/g, ': ');

  // litera↔cyfra i cyfra↔litera
  const pl = PL;
  s = s.replace(new RegExp(`([${pl}])([0-9])`, 'g'), '$1 $2');
  s = s.replace(new RegExp(`([0-9])([${pl}])`, 'g'), '$1 $2');

  // operatory i znaki obok cyfr
  s = s.replace(/([0-9])([*x:%+\-/])/gi, '$1 $2');
  s = s.replace(/([*x:%+\-/])([0-9])/gi, '$1 $2');

  // jednostki i waluty
  s = s.replace(/\b(kg|g|ml|l)\b/gi, ' $1'); // „0.500kg” → „0.500 kg”
  s = s.replace(/\bPLN\b/g, ' PLN ');

  // skróty CAPS przed liczbą / po liczbie
  s = s.replace(/\b([A-ZĄĆĘŁŃÓŚŻŹ]{2,})(?=[0-9])/g, '$1 ');
  s = s.replace(/([0-9])([A-ZĄĆĘŁŃÓŚŻŹ]{1,}\b)/g, '$1 $2');

  // porządkowanie wielokrotnych spacji
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}

export function linesToPlainText(
  lines: { text: string; box: number[] }[][],
): string {
  return lines
    .map((row) =>
      row
        .sort((a, b) => a.box[0] - b.box[0])
        .map((t) => t.text.trim())
        .join(' '),
    )
    .map(fixLineSpacing)
    .join('\n')
    .trim();
}
