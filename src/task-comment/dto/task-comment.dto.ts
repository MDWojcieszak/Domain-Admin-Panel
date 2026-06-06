import { IsString } from 'nestjs-swagger-dto';

export class TaskCommentCreateDto {
  @IsString()
  taskId: string;

  @IsString()
  comment: string;
}
