import { normalizeReceiptText } from './normalize-receipt.util';

export type InvoiceItem = {
  name: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  vatRate?: string; // e.g. "23%", "0", "np."
  lineNet?: number;
  lineVat?: number;
  lineGross?: number;
};

export type InvoiceParsed = {
  type: 'invoice';
  number?: string;
  issueDate?: string; // ISO yyyy-mm-dd
  sellDate?: string; // ISO
  dueDate?: string; // ISO
  currency?: string; // PLN/EUR/...
  seller?: { name?: string; nip?: string; vatId?: string; address?: string };
  buyer?: { name?: string; nip?: string; vatId?: string; address?: string };
  totals?: { net?: number; vat?: number; gross?: number };
  vatSummary?: Array<{
    rate: string;
    net?: number;
    vat?: number;
    gross?: number;
  }>;
  items: InvoiceItem[];
  raw: string; // normalized text
};

const dec = (s: string) =>
  Number(s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
const allMoneyRE = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,\.]\d{2}\b/g;

const toISO = (d?: string) => {
  if (!d) return undefined;
  // dd-mm-yyyy / dd.mm.yyyy / yyyy-mm-dd
  const m1 = d.match(/^(\d{2})[-./](\d{2})[-./](\d{2,4})$/);
  const m2 = d.match(/^(\d{4})[-./](\d{2})[-./](\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  if (!m1) return undefined;
  const [, dd, mm, yyRaw] = m1;
  const yy =
    yyRaw.length === 2 ? (Number(yyRaw) > 60 ? '19' : '20') + yyRaw : yyRaw;
  return `${yy}-${mm}-${dd}`;
};

export function parseInvoice(rawText: string): InvoiceParsed {
  const text = normalizeReceiptText(rawText);
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // Number
  const number =
    (text.match(/\b(nr|no)[\s.:]*faktury[\s.:]*([A-Z0-9\-\/]+)/i) || [])[2] ||
    (text.match(/\bfaktura[\s.:]*(nr|no)[\s.:]*([A-Z0-9\-\/]+)/i) || [])[2] ||
    (text.match(/\b(invoice\s*(no|nr))[\s.:]*([A-Z0-9\-\/]+)/i) || [])[3];

  // Dates
  const issueDate =
    toISO((text.match(/data\s*wystawienia[\s.:]*([0-9./-]+)/i) || [])[1]) ||
    toISO((text.match(/\bissue\s*date[\s.:]*([0-9./-]+)/i) || [])[1]) ||
    toISO((text.match(/\b(\d{2}[-./]\d{2}[-./]\d{2,4})\b/) || [])[1]);

  const sellDate =
    toISO((text.match(/data\s*sprzeda[żyz][\s.:]*([0-9./-]+)/i) || [])[1]) ||
    toISO((text.match(/\bsale\s*date[\s.:]*([0-9./-]+)/i) || [])[1]);

  const dueDate =
    toISO((text.match(/termin\s*płatności[\s.:]*([0-9./-]+)/i) || [])[1]) ||
    toISO((text.match(/\bdue\s*date[\s.:]*([0-9./-]+)/i) || [])[1]);

  // Currency (simple)
  const currency = /\bPLN\b|zł/i.test(text)
    ? 'PLN'
    : /\bEUR\b|€/.test(text)
      ? 'EUR'
      : /\bUSD\b|\$/.test(text)
        ? 'USD'
        : undefined;

  // Seller/Buyer blocks
  const sellerBlock =
    (text.match(/sprzedawc[ae][\s:]*([\s\S]{0,400})\n/i) || [])[1] || '';
  const buyerBlock =
    (text.match(/nabywc[ae][\s:]*([\s\S]{0,400})\n/i) || [])[1] || '';

  const pullName = (blk: string) =>
    (blk.split('\n')[0] || '')
      .replace(/^(sprzedawca|nabywca)[:\s-]*/i, '')
      .trim() || undefined;

  const nipRe = /\bNIP[:\s-]*([0-9]{10})\b/i;
  const euVatRe =
    /\b(VAT\s*ID|VAT\s*UE|UE\s*VAT|PL[0-9]{10}|[A-Z]{2}[A-Z0-9]{8,14})\b/i;

  const seller: InvoiceParsed['seller'] = {
    name: pullName(sellerBlock) || lines[0] || undefined,
    nip: (sellerBlock.match(nipRe) || text.match(nipRe) || [])[1],
    vatId: (sellerBlock.match(euVatRe) || text.match(euVatRe) || [])[0],
    address: sellerBlock.split('\n').slice(1, 4).join(', ') || undefined,
  };

  const buyer: InvoiceParsed['buyer'] = {
    name: pullName(buyerBlock),
    nip: (buyerBlock.match(nipRe) || [])[1],
    vatId: (buyerBlock.match(euVatRe) || [])[0],
    address: buyerBlock.split('\n').slice(1, 4).join(', ') || undefined,
  };

  // Totals block (look for lines near "Razem/Suma/Do zapłaty/Total")
  const totalsCand = lines.filter((l) =>
    /\b(razem|suma|do zapłaty|total|amount due|brutto|netto|vat)\b/i.test(l),
  );

  const findAmount = (re: RegExp) => {
    for (const l of totalsCand) {
      const m = l.match(re);
      if (m) return dec(m[1]);
    }
    return undefined;
  };

  const gross = findAmount(
    /(?:brutto|gross|do zapłaty|total|amount due).{0,20}?((?:\d{1,3}(?:[.\s]\d{3})*|\d+)[,\.]\d{2})/i,
  );
  const net = findAmount(
    /(?:netto|net).{0,20}?((?:\d{1,3}(?:[.\s]\d{3})*|\d+)[,\.]\d{2})/i,
  );
  const vat = findAmount(
    /(?:vat|podatek).{0,20}?((?:\d{1,3}(?:[.\s]\d{3})*|\d+)[,\.]\d{2})/i,
  );

  // VAT summary table (very light)
  const vatSummary: InvoiceParsed['vatSummary'] = [];
  const vatArea = text.match(/(VAT|PTU)[\s\S]{0,400}/i)?.[0] || text;
  const vatRows = vatArea
    .split('\n')
    .filter((l) => /\b\d{1,2}(?:[.,]\d)?%?\b/.test(l) && allMoneyRE.test(l));
  for (const r of vatRows) {
    const rate =
      (r.match(/\b(\d{1,2}(?:[.,]\d)?%?)\b/) || [])[1]?.replace(',', '.') || '';
    const nums = [...r.matchAll(allMoneyRE)].map((m) => dec(m[0]));
    if (!rate) continue;
    // try to map 2–3 numbers to net/vat/gross
    let netR: number | undefined,
      vatR: number | undefined,
      grR: number | undefined;
    if (nums.length >= 3) [netR, vatR, grR] = nums.slice(-3);
    else if (nums.length === 2) [netR, vatR] = nums;
    else if (nums.length === 1) netR = nums[0];
    vatSummary.push({ rate, net: netR, vat: vatR, gross: grR });
  }

  // Items: try to find a block between headers and totals.
  // Heuristic: lines with at least one amount; skip obvious totals.
  const skipTotals = (l: string) =>
    /\b(razem|suma|do zapłaty|total|vat|brutto|netto)\b/i.test(l);
  const itemLines = lines.filter((l) => allMoneyRE.test(l) && !skipTotals(l));

  const items: InvoiceItem[] = [];
  for (const ln of itemLines) {
    const firstNumIdx = ln.search(/\d/);
    const name = (firstNumIdx > 0 ? ln.slice(0, firstNumIdx) : ln)
      .replace(/[.,:+-]\s*$/, '')
      .trim();
    if (!name || /^sprzedawca|nabywca|nip|adres|faktura/i.test(name)) continue;

    const nums = [...ln.matchAll(allMoneyRE)].map((m) => dec(m[0]));
    const rate =
      (ln.match(/\b(23|8|5|0|np|zw|oo|oo0)[%]?\b/i) || [])[1]
        ?.toLowerCase()
        ?.replace('oo', '0') || undefined;

    let qty: number | undefined, unit: string | undefined;
    const qtyRe = ln.match(
      /\b(\d+(?:[.,]\d+)?)\s*(szt|kg|l|op|m2|m3|h|km|mb|kpl|pcs|pkg|pack|unit)\b/i,
    );
    if (qtyRe) {
      qty = dec(qtyRe[1]);
      unit = qtyRe[2];
    }

    // try to assign net/vat/gross from rightmost numbers
    let lineGross: number | undefined,
      lineVat: number | undefined,
      lineNet: number | undefined,
      unitPrice: number | undefined;
    if (nums.length >= 3) {
      [lineNet, lineVat, lineGross] = nums.slice(-3);
    } else if (nums.length === 2) {
      [lineNet, lineGross] = nums.slice(-2);
      if (!lineGross || lineNet > lineGross)
        [lineNet, lineGross] = [undefined, nums[nums.length - 1]];
    } else if (nums.length === 1) {
      lineGross = nums[0];
    }

    // unit price candidate: first number that isn't the last (gross)
    if (nums.length >= 2) {
      unitPrice = nums.find((n) => n !== lineGross);
    }

    items.push({
      name,
      qty,
      unit,
      unitPrice,
      vatRate: rate,
      lineNet,
      lineVat,
      lineGross,
    });
  }

  return {
    type: 'invoice',
    number,
    issueDate,
    sellDate,
    dueDate,
    currency,
    seller,
    buyer,
    totals: { net, vat, gross },
    vatSummary,
    items,
    raw: text,
  };
}
