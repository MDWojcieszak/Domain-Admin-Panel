import { PersonRelation } from '@prisma/client';
import { IsDate, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';
import { AiContextResponseDto } from '../../common/responses';

export class PersonDetailResponseDto {
  @IsString()
  id: string;

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
  birthday?: Date;

  @IsString({ optional: true })
  avatarUrl?: string;

  @IsEnum({ enum: { PersonRelation }, optional: true })
  relation?: PersonRelation;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;

  @IsNested({ type: AiContextResponseDto, optional: true })
  aiContext?: AiContextResponseDto;

  //TODO: enable whel Location done
  //   @IsNested({ type: LocationDto, optional: true })
  //   location?: LocationDto;

  //TODO: enable when Social Media done
  // @IsNested({ type: SocialMediaDto, isArray: true, optional: true })
  // socialMedia?: SocialMediaDto[];
}
