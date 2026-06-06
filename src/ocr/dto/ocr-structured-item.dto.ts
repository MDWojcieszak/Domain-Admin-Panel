import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class OcrStructuredItemDto {
  @IsString({
    description: 'Item name as seen on the document',
    example: 'Apples',
  })
  name: string;

  @IsNumber({
    description: 'Quantity (if available)',
    example: 2.0,
    optional: true,
  })
  quantity?: number;

  @IsString({
    description: 'Unit of measure (e.g., kg, pcs)',
    example: 'kg',
    optional: true,
  })
  unit?: string;

  @IsNumber({
    description: 'Unit price (if available)',
    example: 7.5,
    optional: true,
  })
  unitPrice?: number;

  @IsNumber({
    description: 'Line total (sum for this item)',
    example: 15.0,
    optional: true,
  })
  lineTotal?: number;

  @IsNumber({
    description: 'VAT rate in percent (if present)',
    example: 8,
    optional: true,
  })
  vatRate?: number;

  @IsString({
    description: 'Currency code inferred from the document',
    example: 'PLN',
    optional: true,
  })
  currency?: string;
}
