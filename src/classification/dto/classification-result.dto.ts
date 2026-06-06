import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import {
  CuisineType,
  DishType,
  DocumentType,
  PaymentMethod,
  PurchaseCategory,
  PurchasePurpose,
  VenueType,
} from '../enums';

export class ClassifiedItemDto {
  @IsString({
    description: 'Corrected item name (text-only fixes allowed)',
    example: 'Tantanmen',
  })
  name!: string;

  @IsNumber({
    description: 'Quantity (copied from OCR; numbers must not be altered)',
    example: 1,
    optional: true,
  })
  quantity?: number;

  @IsNumber({
    description: 'Unit price (from OCR; do not modify numerics)',
    example: 50,
    optional: true,
  })
  unitPrice?: number;

  @IsNumber({
    description: 'Line total (from OCR; do not modify numerics)',
    example: 50,
    optional: true,
  })
  lineTotal?: number;

  @IsEnum({
    enum: { PurchaseCategory },
    description: 'High-level purchase category',
    example: PurchaseCategory.FOOD,
  })
  category: PurchaseCategory;

  @IsEnum({
    enum: { DishType },
    description: 'Dish type if food-related',
    example: DishType.RAMEN,
    optional: true,
  })
  dishType?: DishType;
}

export class ClassifiedHeaderDto {
  @IsString({
    description: 'Merchant / seller name',
    example: 'YOKO Ramen',
    optional: true,
  })
  merchantName?: string;

  @IsString({
    description: 'Merchant tax identifier',
    example: '6793284626',
    optional: true,
  })
  merchantTaxId?: string;

  @IsString({
    description: 'Document number if available',
    example: '24826',
    optional: true,
  })
  documentNumber?: string;

  @IsString({
    description: 'ISO-8601 date if known (do not guess)',
    example: '2025-08-09',
    optional: true,
  })
  date?: string;
}

export class ClassifiedTotalsDto {
  @IsNumber({
    description: 'Grand total (from OCR; do not modify numerics)',
    example: 270,
    optional: true,
  })
  total?: number;

  @IsNumber({
    description: 'Total VAT amount (from OCR; do not modify numerics)',
    example: 27.68,
    optional: true,
  })
  vatTotal?: number;

  @IsString({
    description: 'Currency code',
    example: 'PLN',
    optional: true,
  })
  currency?: string;
}

export class ClassificationResponseDto {
  @IsEnum({
    enum: { DocumentType },
    description: 'Document type',
    example: DocumentType.RECEIPT,
  })
  documentType: DocumentType;

  @IsEnum({
    enum: { VenueType },
    description: 'Venue kind inferred from merchant/items',
    example: VenueType.RESTAURANT,
  })
  venueType: VenueType;

  @IsEnum({
    enum: { PaymentMethod },
    description: 'Payment method if detectable',
    example: PaymentMethod.CARD,
    optional: true,
  })
  paymentMethod?: PaymentMethod;

  @IsEnum({
    enum: { PurchasePurpose },
    description: 'Likely purpose of purchase',
    example: PurchasePurpose.PERSONAL,
    optional: true,
  })
  purpose?: PurchasePurpose;

  @IsEnum({
    enum: { CuisineType },
    description: 'Cuisine type (if venue is restaurant-like)',
    example: CuisineType.JAPANESE,
    optional: true,
  })
  cuisineType?: CuisineType;

  @IsNested({
    type: ClassifiedHeaderDto,
    description: 'Header fields copied/adapted from OCR',
  })
  header: ClassifiedHeaderDto;

  @IsNested({
    type: ClassifiedTotalsDto,
    description: 'Totals copied from OCR (numerics unmodified)',
  })
  totals!: ClassifiedTotalsDto;

  @IsNested({
    type: ClassifiedItemDto,
    isArray: true,
    description: 'Per-item classification',
    example: [
      {
        name: 'Tantanmen',
        quantity: 1,
        unitPrice: 50,
        lineTotal: 50,
        category: PurchaseCategory.FOOD,
        dishType: DishType.RAMEN,
      },
      {
        name: 'Shoyu',
        quantity: 2,
        unitPrice: 49,
        lineTotal: 98,
        category: PurchaseCategory.CHARITY,
      },
    ],
  })
  items!: ClassifiedItemDto[];

  @IsString({
    description: 'Cleaned text evidence from OCR (unchanged)',
    example: '...full cleanedText...',
  })
  cleanedText!: string;

  @IsString({
    isArray: true,
    description: 'Non-fatal warnings from classification',
    example: ['Ambiguous dessert vs drink'],
    optional: true,
  })
  warnings?: string[];
}
