import { IsString } from 'nestjs-swagger-dto';

export class OcrStructuredHeaderDto {
  @IsString({
    description: 'Seller/vendor name',
    example: 'APPLOGY',
    optional: true,
  })
  sellerName?: string;

  @IsString({
    description: 'Seller tax id (e.g., NIP/VATIN)',
    example: '1122009977',
    optional: true,
  })
  sellerTaxId?: string;

  @IsString({
    description: 'Document date (ISO-8601 if possible)',
    example: '2018-08-14',
    optional: true,
  })
  date?: string;

  @IsString({
    description: 'Document number (invoice no., receipt id, etc.)',
    example: 'H000156',
    optional: true,
  })
  documentNumber?: string;

  @IsString({
    description: 'Buyer name if present',
    example: 'ACME Sp. z o.o.',
    optional: true,
  })
  buyerName?: string;

  @IsString({
    description: 'Buyer tax id if present',
    example: '1234567890',
    optional: true,
  })
  buyerTaxId?: string;
}
