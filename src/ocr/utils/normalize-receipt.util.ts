export function normalizeReceiptText(raw: string): string {
  let text = raw || '';

  // Usuń znaki kontrolne
  text = text.replace(/[\u0000-\u001F\u007F]/g, '');
  // Zamień dziwne kreski, podkreślenia itp. na spację
  text = text.replace(/[|¦¬`^~_]+/g, ' ');
  // Cudzysłowy na zwykły "
  text = text.replace(/[“”„"’‘]+/g, '"');
  // Myślniki na zwykły minus
  text = text.replace(/[–—−]+/g, '-');

  // Popraw polskie litery (OCR potrafi źle odczytać)
  const map: Record<string, string> = {
    'a˛': 'ą',
    'e˛': 'ę',
    '£': 'ł',
    '¢': 'ć',
    Ÿ: 'ź',
    '¤': 'ś',
    ó́: 'ó',
  };
  for (const [bad, good] of Object.entries(map)) {
    text = text.replace(new RegExp(bad, 'g'), good);
  }

  // Usuń podwójne spacje
  text = text.replace(/\s{2,}/g, ' ');

  // Zamień przecinki na kropki w liczbach
  text = text.replace(/(\d),(\d{2})\b/g, '$1.$2');

  // Trim pustych linii i spacji
  text = text.trim();

  return text;
}
