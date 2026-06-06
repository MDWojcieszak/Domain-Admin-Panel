export type DocType = 'receipt' | 'invoice' | 'other';

export type DocSignal = {
  key: string;
  weight: number;
  matched: boolean;
};

export type DocClassification = {
  type: DocType;
  confidence: number;
  signals: Record<string, boolean>;
};

const RE = {
  receiptHints: [
    /\bparagon\b/i,
    /\bfiskaln/i,
    /\bkas(ie|jer|a)\b/i,
    /\b(nr|id)\s*kasy\b/i,
    /\bptu\b/i,
    /\bgotówk|karta|płatno/i,
    /\brazem[: ]/i,
    /\bsuma[: ]/i,
  ],
  invoiceHints: [
    /\bfaktura\b/i,
    /\bfaktura\s*vat\b/i,
    /\binvoice\b/i,
    /\bsprzedawca\b/i,
    /\bnabywca\b/i,
    /\bnr\s*faktury\b/i,
    /\btermin\s*płat/i,
    /\bdata\s*wystaw/i,
    /\bmetoda\s*płat/i,
    /\bprzelew\b/i,
    /\biban\b|[A-Z]{2}\d{2}[A-Z0-9]{10,30}/i,
    /\brachunek\b|\bnr\s*rachunku\b/i,
  ],
  businessSignals: [/\bNIP[:\s-]*\d{10}\b/i, /\bVAT\s*ID\b/i, /\bREGON\b/i],
  priceLine: /^\s*.*?\d+[,.]\d{2}.*$/m,
};

export function classifyDocument(textRaw: string): DocClassification {
  const text = textRaw;
  const lines = text.split('\n');
  const priceLines = (text.match(new RegExp(RE.priceLine, 'g')) || []).length;

  const score = (patterns: RegExp[]) =>
    patterns.reduce((acc, r) => acc + (r.test(text) ? 1 : 0), 0);

  const receiptScore = score(RE.receiptHints) + Math.min(priceLines, 10) * 0.3;
  const invoiceScore = score(RE.invoiceHints) + score(RE.businessSignals) * 0.5;

  let type: DocType = 'other';
  if (invoiceScore >= receiptScore && invoiceScore >= 2) type = 'invoice';
  else if (receiptScore >= 2) type = 'receipt';

  const rawConf = Math.max(receiptScore, invoiceScore);
  const confidence = Math.max(0, Math.min(1, rawConf / 6));

  const signals: Record<string, boolean> = {
    hasNip: /\bNIP[:\s-]*\d{10}\b/i.test(text),
    hasInvoiceWord: /\bfaktura\b|invoice/i.test(text),
    hasReceiptWord: /\bparagon\b/i.test(text),
    hasIban: /\biban\b|[A-Z]{2}\d{2}[A-Z0-9]{10,30}/i.test(text),
    priceLines: priceLines > 0,
  };

  return { type, confidence, signals };
}
