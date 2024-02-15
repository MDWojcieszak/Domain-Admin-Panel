import { Body, Controller, Get, Post } from '@nestjs/common';
import { SessionService } from './session.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SessionDto } from './dto/session.dto';
import { GetCurrentUser, GetCurrentUserId } from '../common/decorators';

@ApiBearerAuth()
@ApiTags('Session')
@Controller('session')
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get('all')
  getAllForUser(@GetCurrentUserId() userId: string) {
    return this.sessionService.getAllForUser(userId);
  }

  @Get('current')
  getCurrent(@GetCurrentUser('sessionId') sessionId: string) {
    return this.sessionService.getCurrent(sessionId);
  }

  @Post('logout')
  removeSession(@Body() dto: SessionDto) {
    return this.sessionService.removeSession(dto);
  }
}
