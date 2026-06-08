import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class HomeBlockPostInputDto {
  @IsString()
  postId: string;

  @IsNumber({ type: 'integer' })
  order: number;
}

export class SetHomeBlockPostsDto {
  @IsNested({ type: HomeBlockPostInputDto, isArray: true })
  posts: HomeBlockPostInputDto[];
}

export class ReorderHomeBlockPostsDto {
  @IsNested({ type: HomeBlockPostInputDto, isArray: true })
  posts: HomeBlockPostInputDto[];
}

export class AddHomeBlockPostDto {
  @IsString()
  postId: string;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}
