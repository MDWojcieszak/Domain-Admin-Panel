import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class EditorialCommentAuthorResponse {
  @IsString()
  id: string;

  @IsString()
  email: string;

  @IsString({ optional: true, nullable: true })
  firstName: string | null;

  @IsString({ optional: true, nullable: true })
  lastName: string | null;
}

/** Internal editorial comment (pin). NEVER exposed on public endpoints. */
export class EditorialCommentResponse {
  @IsString()
  id: string;

  @IsString()
  postId: string;

  @IsString({ optional: true, nullable: true })
  sectionId: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  anchorStart: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  anchorEnd: number | null;

  @IsString({ optional: true, nullable: true })
  quote: string | null;

  @IsString()
  authorId: string;

  @IsNested({ type: EditorialCommentAuthorResponse })
  author: EditorialCommentAuthorResponse;

  @IsString()
  body: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
