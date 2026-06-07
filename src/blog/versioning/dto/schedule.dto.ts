import { IsString } from 'nestjs-swagger-dto';

export class ScheduleDto {
  @IsString({
    isDate: { format: 'date-time' },
    description:
      'When to auto-publish the current draft (must be in the future).',
  })
  scheduledFor: string;
}
