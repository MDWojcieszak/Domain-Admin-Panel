import { Injectable } from '@nestjs/common';
import { OllamaClient } from '../ai/clients/ollama.client';
import {
  CuisineType,
  DishType,
  DocumentType,
  PaymentMethod,
  PurchaseCategory,
  PurchasePurpose,
  VenueType,
} from './enums';
import { ClassificationResponseDto } from './dto';

type StructuredOCR = {
  cleanedText: string;
  header?: {
    sellerName?: string;
    sellerTaxId?: string;
    date?: string;
    document_number?: string;
    buyerName?: string;
    buyerTaxId?: string;
  };
  items?: Array<{
    name?: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
  }>;
  totals?: {
    subtotal?: number | string | null;
    vatTotal?: number | string | null;
    total?: number | string | null;
    currency?: string | null;
  };
  warnings?: string[];
};

const enums = {
  DOCS: Object.values(DocumentType),
  VENUES: Object.values(VenueType),
  CUISINES: Object.values(CuisineType),
  CATS: Object.values(PurchaseCategory),
  DISHES: Object.values(DishType),
  PAYMENTS: Object.values(PaymentMethod),
  PURPOSES: Object.values(PurchasePurpose),
};

function normEnum<T extends string>(
  v: any,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof v !== 'string') return fallback;
  const low = v.toLowerCase();
  const hit = allowed.find((a) => a.toLowerCase() === low);
  return (hit ?? fallback) as T;
}

function toNum(n: unknown): number | undefined {
  if (n === null || n === undefined || n === '') return undefined;
  const x = Number(String(n).replace(',', '.'));
  return Number.isFinite(x) ? x : undefined;
}

@Injectable()
export class ClassificationService {
  constructor(private readonly ollama: OllamaClient) {}

  async classify(struct: StructuredOCR): Promise<ClassificationResponseDto> {
    const merchant = struct.header?.sellerName ?? '';
    const paymentHint = /KARTA|CARD/i.test(struct.cleanedText)
      ? 'card'
      : /GOTÓWKA|GOTOWKA|CASH/i.test(struct.cleanedText)
        ? 'cash'
        : undefined;

    const itemsPreview = (struct.items ?? [])
      .map(
        (i) =>
          `- ${i.name ?? ''} | qty:${i.quantity ?? ''} unitPrice:${i.unitPrice ?? ''} total:${i.lineTotal ?? ''}`,
      )
      .join('\n');

    const schema = `{
      "type":"object",
      "properties":{
        "document_type":{"type":"string","enum":${JSON.stringify(enums.DOCS)}},
        "venue_type":{"type":"string","enum":${JSON.stringify(enums.VENUES)}},
        "payment_method":{"type":"string","enum":${JSON.stringify(enums.PAYMENTS)}},
        "purpose":{"type":"string","enum":${JSON.stringify(enums.PURPOSES)}},
        "cuisine_type":{"type":"string","enum":${JSON.stringify(enums.CUISINES)}},
        "items":{"type":"array","items":{
          "type":"object",
          "properties":{
            "name":{"type":"string"},
            "category":{"type":"string","enum":${JSON.stringify(enums.CATS)}},
            "dish_type":{"type":"string","enum":${JSON.stringify(enums.DISHES)}}
          },
          "required":["name","category"],
          "additionalProperties":false
        }},
        "warnings":{"type":"array","items":{"type":"string"}}
      },
      "required":["document_type","venue_type","items"],
      "additionalProperties":false
    }`;

    const prompt = `
You classify purchases from a structured OCR document for budgeting.

STRICT rules:
- NEVER change any numbers (quantities, unitPrice, lineTotal, totals, dates, tax IDs).
- You MAY fix spelling/diacritics in TEXT ONLY (names).
- Use ONLY the provided English enums exactly:
  - document_type: ${enums.DOCS.join(', ')}
  - venue_type: ${enums.VENUES.join(', ')}
  - payment_method: ${enums.PAYMENTS.join(', ')}
  - purpose: ${enums.PURPOSES.join(', ')}
  - category: ${enums.CATS.join(', ')}
  - cuisine_type: ${enums.CUISINES.join(', ')}
  - dish_type: ${enums.DISHES.join(', ')}
- If unclear, choose "other" (or "mixed" for purpose).
- Return STRICT JSON matching the JSON schema below (no comments, no extra fields).

JSON-SCHEMA:
${schema}

EVIDENCE:
Merchant: "${merchant}"
Items:
${itemsPreview}

CLEANED TEXT:
"""${struct.cleanedText}"""

HINTS:
- If the merchant or items look like a ramen/sushi place, venue_type=restaurant, cuisine_type=japanese, item dish_type could be ramen/sushi.
- If you see explicit "KARTA"/"CARD" -> payment_method=card; "GOTÓWKA"/"CASH" -> payment_method=cash.
- If the document looks like a small sales slip -> document_type=receipt; invoices have invoice numbers/tax sections.`;

    const json = await this.ollama.generate(prompt, {
      format: 'json',
      options: { temperature: 0.1, num_ctx: 8192 },
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = {};
    }

    const documentType = normEnum(
      parsed.document_type,
      enums.DOCS,
      DocumentType.OTHER,
    );
    const venueType = normEnum(
      parsed.venue_type,
      enums.VENUES,
      VenueType.OTHER,
    );
    const paymentMethod = parsed.payment_method
      ? normEnum(parsed.payment_method, enums.PAYMENTS, PaymentMethod.OTHER)
      : paymentHint
        ? normEnum(paymentHint, enums.PAYMENTS, PaymentMethod.OTHER)
        : undefined;
    const purpose = parsed.purpose
      ? normEnum(parsed.purpose, enums.PURPOSES, PurchasePurpose.PERSONAL)
      : undefined;
    const cuisineType = parsed.cuisine_type
      ? normEnum(parsed.cuisine_type, enums.CUISINES, CuisineType.OTHER)
      : undefined;

    const items = (struct.items ?? []).map((row, idx) => {
      const lbl = (parsed.items ?? [])[idx] ?? {};
      return {
        name: String(lbl.name ?? row.name ?? '').trim(),
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        lineTotal: row.lineTotal,
        category: normEnum(lbl.category, enums.CATS, PurchaseCategory.OTHER),
        dishType: lbl.dish_type
          ? normEnum(lbl.dish_type, enums.DISHES, DishType.OTHER)
          : undefined,
      };
    });

    const out: ClassificationResponseDto = {
      documentType,
      venueType,
      paymentMethod,
      purpose,
      cuisineType,
      header: {
        merchantName: struct.header?.sellerName,
        merchantTaxId: struct.header?.sellerTaxId,
        documentNumber: struct.header?.document_number,
        date: struct.header?.date,
      },
      totals: {
        total: toNum(struct.totals?.total),
        vatTotal: toNum(struct.totals?.vatTotal),
        currency: struct.totals?.currency ?? undefined,
      },
      items,
      cleanedText: struct.cleanedText,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };

    return out;
  }
}
