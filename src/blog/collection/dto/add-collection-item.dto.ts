import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class AddCollectionItemDto {
  @IsString()
  poiId: string;

  @IsNumber({
    type: 'integer',
    min: 1,
    optional: true,
    description: 'Rank (1 = top). Appended to the end when omitted.',
  })
  rank?: number;
}
