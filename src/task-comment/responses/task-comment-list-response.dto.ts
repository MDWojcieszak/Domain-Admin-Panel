import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { TaskCommentResponseDto } from './task-comment-response.dto';

export class TaskCommentListResponseDto {
  @IsNested({ type: TaskCommentResponseDto, isArray: true })
  comments: TaskCommentResponseDto[];

  @IsNumber()
  total: number;
}
