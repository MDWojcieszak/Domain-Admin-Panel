import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class OcrStructuredTotalsDto {
  @IsNumber({
    description: 'Subtotal amount before taxes (if present)',
    example: 32.37,
    optional: true,
  })
  subtotal?: number;

  @IsNumber({
    description: 'Total VAT amount (if present)',
    example: 1.78,
    optional: true,
  })
  vatTotal?: number;

  @IsNumber({
    description: 'Grand total amount',
    example: 34.15,
    optional: true,
  })
  total?: number;

  @IsString({
    description: 'Currency code inferred from the document',
    example: 'PLN',
    optional: true,
  })
  currency?: string;
}
