import { IsNumber } from 'nestjs-swagger-dto';

export class PatchCollectionItemDto {
  @IsNumber({ type: 'integer', min: 1, optional: true })
  rank?: number;
}
