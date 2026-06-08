import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { EditorialCommentResponse } from './comment.response';

export class CommentListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: EditorialCommentResponse, isArray: true })
  comments: EditorialCommentResponse[];
}
