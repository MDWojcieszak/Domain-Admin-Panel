import { Injectable } from '@nestjs/common';
import { OllamaClient } from '../ai/clients';
import { OcrStructuredResponseDto } from './responses/ocr-structured-response.dto';

@Injectable()
export class CleanerService {
  constructor(private readonly ollama: OllamaClient) {}

  private preClean(s: string) {
    return s
      .replace(/\s{2,}/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/([:.])(?!\s)/g, '$1 ')
      .replace(/([0-9])(kg|g|ml|l)\b/gi, '$1 $2')
      .trim();
  }

  async structureFromOcrText(raw: string): Promise<OcrStructuredResponseDto> {
    const input = this.preClean(raw);

    const schema = `{
      "type": "object",
      "properties": {
        "cleanedText": { "type": "string" },
        "header": {
          "type": "object",
          "properties": {
            "sellerName": { "type": "string" },
            "sellerTaxId": { "type": "string" },
            "date": { "type": "string" },
            "document_number": { "type": "string" },
            "buyerName": { "type": "string" },
            "buyerTaxId": { "type": "string" }
          },
          "additionalProperties": false
        },
        "items": {
          "type": "array",
          "items": {
            "type":"object",
            "properties": {
              "name": { "type": "string" },
              "quantity": { "type": "number" },
              "unit": { "type": "string" },
              "unitPrice": { "type": "number" },
              "lineTotal": { "type": "number" },
              "vatRate": { "type": "number" },
              "currency": { "type": "string" }
            },
            "required": ["name"],
            "additionalProperties": false
          }
        },
        "totals": {
          "type":"object",
          "properties": {
            "subtotal": { "type": "number" },
            "vatTotal": { "type": "number" },
            "total": { "type": "number" },
            "currency": { "type": "string" }
          },
          "additionalProperties": false
        },
        "warnings": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["docType","cleanedText","header","items","totals"],
      "additionalProperties": false
    }`;

    const prompt = `
You are a post-OCR structuring tool for receipts and invoices.

Rules:
- DO NOT change any numbers or numeric punctuation (quantities, prices, totals, dates, tax IDs).
- You MAY correct spelling and Polish diacritics in TEXTUAL FIELDS ONLY:
  - item "name"
  - header fields like seller_name, buyer_name
  Example corrections: "Jabtka" → "Jabłka", "Gotouka" → "Gotówka", "Ser 2otty" → "Ser żółty".
- Insert missing spaces between glued words/digits.
- Create a logically formatted "cleaned_text" (headers, items, totals).
- Set "doc_type" to "receipt" | "invoice" | "other".
- Extract line "items". If unsure about quantity or unit_price, omit rather than guessing.
- Extract "totals" (subtotal, vat_total, total, currency) when present.
- Put any doubts in "warnings".
- Output STRICT JSON ONLY matching the schema below. No extra fields, no comments.

IMPORTANT:
- Preserve every numeric token exactly as in OCR (including decimal commas/points).
- When correcting words, keep them semantically equivalent (e.g., only spelling/diacritics), never invent brand-new items.

JSON-SCHEMA:
${schema}

Examples of TEXT-ONLY fixes (numbers unchanged):
- "Jabtka 3.000*4.40 13.200" → item.name = "Jabłka", quantity = 3.000, unit_price = 4.40, line_total = 13.200
- "Ser 2otty 0.500 kg * 11.90 5.95" → item.name = "Ser żółty", quantity = 0.500, unit = "kg", unit_price = 11.90, line_total = 5.95

OCR_TEXT:
"""${input}"""
`;

    const json = await this.ollama.generate(prompt, {
      format: 'json',
      options: { temperature: 0.2 },
    });

    try {
      const parsed = JSON.parse(json);
      const dto: OcrStructuredResponseDto = {
        cleanedText: parsed.cleaned_text ?? input,
        header: parsed.header ?? {},
        items: Array.isArray(parsed.items) ? parsed.items : [],
        totals: parsed.totals ?? {},
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      };
      return dto;
    } catch {
      return {
        cleanedText: input,
        header: {},
        items: [],
        totals: {},
        warnings: ['LLM_JSON_PARSE_FAILED'],
      };
    }
  }
}
