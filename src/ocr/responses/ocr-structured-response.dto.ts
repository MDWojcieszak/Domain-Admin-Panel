import { IsNested, IsString } from 'nestjs-swagger-dto';
import { OcrStructuredHeaderDto } from '../dto/ocr-structured-header.dto';
import { OcrStructuredItemDto } from '../dto';
import { OcrStructuredTotalsDto } from '../dto/ocr-structured-totals.dto';

export class OcrStructuredResponseDto {
  @IsString({
    description: 'Cleaned, human-readable text reconstructed from OCR',
    example: 'ZETO Serwis\nul. Oleska 7\n45-052 Opole\nNIP: 7453009977\n...',
  })
  cleanedText: string;

  @IsNested({
    type: OcrStructuredHeaderDto,
    description: 'Document header fields',
  })
  header: OcrStructuredHeaderDto;

  @IsNested({
    type: OcrStructuredItemDto,
    isArray: true,
    description: 'Detected line items',
    example: [
      {
        name: 'Ser żółty',
        quantity: 0.5,
        unit: 'kg',
        unitPrice: 11.9,
        lineTotal: 5.95,
        vatRate: 8,
        currency: 'PLN',
      },
      {
        name: 'Jabłka',
        quantity: 3.0,
        unitPrice: 4.4,
        lineTotal: 13.2,
        currency: 'PLN',
      },
    ],
  })
  items: OcrStructuredItemDto[];

  @IsNested({
    type: OcrStructuredTotalsDto,
    description: 'Totals section',
    example: {
      subtotal: 32.37,
      vatTotal: 1.78,
      total: 34.15,
      currency: 'PLN',
    },
  })
  totals: OcrStructuredTotalsDto;

  @IsString({
    description: 'Non-fatal warnings the model produced while structuring',
    example: ['Uncertain currency', 'Ambiguous date format'],
    isArray: true,
    optional: true,
  })
  warnings?: string[];
}
