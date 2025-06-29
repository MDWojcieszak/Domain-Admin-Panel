import { ServerProcessStatus } from '@prisma/client';
import { IsDate, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

class Category {
  @IsString({ optional: true })
  name?: string;
}

class User {
  @IsString()
  id: string;

  @IsString({ isEmail: true })
  email: string;

  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;
}

export class ProcessResponseDto {
  @IsString()
  id: string;

  @IsEnum({ enum: { ServerProcessStatus } })
  status?: ServerProcessStatus;

  @IsString({ optional: true })
  name?: string;

  @IsDate({ format: 'date-time' })
  startedAt: Date;

  @IsDate({ format: 'date-time', optional: true })
  stoppedAt?: Date;

  @IsNested({ type: User, optional: true })
  startedBy?: User;

  @IsNested({ type: Category, optional: true })
  category?: Category;
}
