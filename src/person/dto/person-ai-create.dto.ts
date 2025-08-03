import { PersonRelation } from '@prisma/client';
import { IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';
import { AiLogFieldsDto } from '../../common/dto';

export class PersonAiCreateDto extends AiLogFieldsDto {
  @IsString()
  name: string;

  @IsString({ optional: true })
  nickname?: string;

  @IsString({ optional: true })
  email?: string;

  @IsString({ optional: true })
  phone?: string;

  @IsString({ optional: true })
  notes?: string;

  @IsDate({ format: 'date-time', optional: true })
  birthday?: string;

  @IsEnum({ enum: { PersonRelation }, optional: true })
  relation?: PersonRelation;
}
