import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PostOrderInputDto {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  order: number;
}

export class ReorderPostsDto {
  @IsNested({ type: PostOrderInputDto, isArray: true })
  items: PostOrderInputDto[];
}
