import { IsString } from 'nestjs-swagger-dto';

export class SetPostCategoriesDto {
  @IsString({
    isArray: true,
    description:
      'Full desired set of POST category ids (SET semantics; [] clears all).',
  })
  categoryIds: string[];
}
