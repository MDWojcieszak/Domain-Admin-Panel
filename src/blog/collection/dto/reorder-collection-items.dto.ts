import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CollectionItemOrderDto {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer', min: 1 })
  rank: number;
}

export class ReorderCollectionItemsDto {
  @IsNested({ type: CollectionItemOrderDto, isArray: true })
  items: CollectionItemOrderDto[];
}
