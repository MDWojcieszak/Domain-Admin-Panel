import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { UserResponseDto } from './user-response.dto';
import { PaginationDto } from '../../common/dto';

export class UserListResponseDto {
  @IsNested({ type: UserResponseDto, isArray: true })
  users: UserResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}
