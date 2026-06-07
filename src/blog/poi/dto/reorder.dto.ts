import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class OrderItemDto {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  order: number;
}

export class ReorderDto {
  @IsNested({ type: OrderItemDto, isArray: true })
  items: OrderItemDto[];
}
