import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import { NotificationService } from './notification.service';
import { SendTestNotificationDto } from './dto';
import { TestNotificationResultDto } from './responses';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('test')
  @ApiOkResponse({
    description: 'Send a chosen notification type to your own email (self-test)',
    type: TestNotificationResultDto,
  })
  async sendTest(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: SendTestNotificationDto,
  ): Promise<TestNotificationResultDto> {
    return this.notifications.sendTest(userId, dto.type);
  }
}
