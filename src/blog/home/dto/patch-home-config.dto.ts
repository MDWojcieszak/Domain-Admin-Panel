import { IsNumber } from 'nestjs-swagger-dto';

export class PatchHomeConfigDto {
  @IsNumber({
    type: 'integer',
    optional: true,
    min: 1,
    max: 100,
    description: 'How many posts the homepage shows.',
  })
  postCount?: number;
}
