import { normalizeReceiptText } from './normalize-receipt.util';

export type ReceiptItem = {
  name: string;
  qty?: number; // e.g. 0.500 (kg) or 1 (szt.)
  unit?: 'kg' | 'szt' | 'op' | 'l' | string;
  unitPrice?: number; // price per unit
  lineTotal?: number; // line amount
};

export type ReceiptParsed = {
  type: 'receipt';
  merchant?: string;
  nip?: string;
  date?: string; // ISO yyyy-mm-dd
  currency?: 'PLN' | 'EUR' | 'USD' | string;
  total?: number;
  vatSummary?: { rate: string; amount: number }[];
  items: ReceiptItem[];
  raw: string; // normalized text
};

const dec = (s: string) =>
  Number(s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); // 1 234,56 -> 1234.56
const moneyRE = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,\.]\d{2}\b/g;

function firstIsoLike(text: string): string | undefined {
  // 14-08-2018 / 14.08.2018 / 2018-08-14
  const m = text.match(
    /(\d{2})[-./](\d{2})[-./](\d{2,4})|(\d{4})[-./](\d{2})[-./](\d{2})/,
  );
  if (!m) return;
  if (m[4]) {
    // yyyy-mm-dd
    return `${m[4]}-${m[5]}-${m[6]}`;
  }
  // dd-mm-yyyy
  let [, dd, mm, yy] = m as unknown as [string, string, string, string];
  if (yy.length === 2) yy = (Number(yy) > 60 ? '19' : '20') + yy;
  return `${yy}-${mm}-${dd}`;
}

function looksLikeHeader(line: string) {
  return /paragon|fiskal|niefiskal|market|sklep|serwis|kasa|sprzeda|rachunek|nip|ul\.|adres/i.test(
    line,
  );
}

export function parseReceipt(raw: string): ReceiptParsed {
  const text = normalizeReceiptText(raw);
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // Merchant: we try first few non-empty lines that look like a header/name
  const merchant =
    lines.slice(0, 6).find(looksLikeHeader) ||
    lines.slice(0, 3).join(' ').slice(0, 80);

  // NIP (PL 10 digits)
  const nip = (text.match(/\bNIP[:\s-]*([0-9]{10})\b/i) || [])[1];

  // Date
  const date = firstIsoLike(text);

  // Currency
  const currency: ReceiptParsed['currency'] = /\bPLN\b|zł/i.test(text)
    ? 'PLN'
    : /\bEUR\b|€/.test(text)
      ? 'EUR'
      : /\bUSD\b|\$/.test(text)
        ? 'USD'
        : 'PLN';

  // Total guess = max amount in the document
  const allAmounts = [...text.matchAll(moneyRE)]
    .map((m) => dec(m[0]))
    .filter((n) => !Number.isNaN(n));
  const total = allAmounts.length ? Math.max(...allAmounts) : undefined;

  // VAT (very light heuristic)
  const vatSummary: { rate: string; amount: number }[] = [];
  const vatBlock = text.match(/(PTU|VAT)[\s\S]{0,200}/i)?.[0] || '';
  const vatPairs = [
    ...vatBlock.matchAll(/(\b\d{1,2}[.,]?\d?%?\b)[^\d]{0,10}(\d+[.,]\d{2})/g),
  ];
  for (const p of vatPairs) {
    const rate = p[1].replace(',', '.');
    const amount = dec(p[2]);
    if (!Number.isNaN(amount)) vatSummary.push({ rate, amount });
  }

  // Items detection:
  // Heuristic: lines with at least one money token, but not obvious totals/vat lines.
  const skipLine = (ln: string) =>
    /\b(suma|razem|ptu|vat|sprzedaż|należność|do zapłaty|sumy)\b/i.test(ln);

  const itemLines = lines.filter((ln) => !skipLine(ln) && moneyRE.test(ln));

  const items: ReceiptItem[] = [];
  for (const lnRaw of itemLines) {
    const ln = lnRaw.trim();

    // name: text up to first number
    const numIdx = ln.search(/\d/);
    const name = (numIdx > 0 ? ln.slice(0, numIdx) : ln)
      .replace(/[.,:+-]\s*$/, '')
      .trim();

    const nums = [...ln.matchAll(moneyRE)].map((m) => dec(m[0]));
    if (!nums.length) continue;

    // qty/unit hints
    let qty: number | undefined;
    let unit: ReceiptItem['unit'];
    let lineTotal: number | undefined;
    let unitPrice: number | undefined;

    const kg = ln.match(/(\d+(?:[.,]\d+))\s*kg\b/i);
    const szt = ln.match(/\b(\d+)\s*(szt|x)\b/i);
    const lit = ln.match(/(\d+(?:[.,]\d+))\s*l\b/i);

    if (kg) {
      qty = dec(kg[1]);
      unit = 'kg';
    } else if (lit) {
      qty = dec(lit[1]);
      unit = 'l';
    } else if (szt) {
      qty = Number(szt[1]);
      unit = 'szt';
    }

    // amount assignment
    if (nums.length === 1) {
      lineTotal = nums[0];
    } else {
      lineTotal = nums[nums.length - 1]; // last number tends to be line total
      // choose another as unit price if plausible
      const candidate = nums.find((n) => Math.abs(n - lineTotal!) > 0.001);
      if (candidate) unitPrice = candidate;
    }

    // filter obvious headers that slipped through
    if (
      !name ||
      /^(ul\.|nip\b|data\b|paragon|faktura|kasa|sprzedawca|nabywca)/i.test(name)
    )
      continue;

    items.push({ name, qty, unit, unitPrice, lineTotal });
  }

  return {
    type: 'receipt',
    merchant: merchant?.trim(),
    nip,
    date,
    currency,
    total,
    vatSummary,
    items,
    raw: text,
  };
}
