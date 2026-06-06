import { IsString, IsDate, IsNested } from 'nestjs-swagger-dto';
import { TaskCommentUserResponseDto } from './task-comment-user-response.dto';

export class TaskCommentResponseDto {
  @IsString()
  id: string;

  @IsString()
  taskId: string;

  @IsNested({ type: TaskCommentUserResponseDto })
  user: TaskCommentUserResponseDto;

  @IsString()
  comment: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}
