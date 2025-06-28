import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SessionService } from './session.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SessionDto } from './dto/session.dto';
import { GetCurrentUser, Roles } from '../common/decorators';
import { PaginationDto } from '../common/dto';
import { SessionListResponseDto, SessionResponseDto } from './responses';
import { Session } from 'inspector';

@ApiBearerAuth()
@ApiTags('Session')
@Controller('session')
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get('my')
  @ApiOkResponse({
    type: SessionListResponseDto,
    description: 'List of all sessions for the current user',
  })
  getAllForUser(
    @GetCurrentUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ): Promise<SessionListResponseDto> {
    return this.sessionService.getAllForUser(dto, userId);
  }

  @Get('user/:userId')
  @Roles('OWNER')
  @ApiOkResponse({
    type: SessionListResponseDto,
    description: 'List of all sessions for a specific user',
  })
  getAllForUserByAdmin(
    @Param('userId') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.sessionService.getAllForUser(dto, userId);
  }

  @Get('all')
  @Roles('OWNER')
  @ApiOkResponse({
    type: SessionListResponseDto,
    description: 'List of all sessions',
  })
  getAll(@Query() dto: PaginationDto): Promise<SessionListResponseDto> {
    return this.sessionService.getAll(dto);
  }

  @Get('current')
  @ApiOkResponse({
    type: SessionResponseDto,
    description: 'Get current session details',
  })
  getCurrent(
    @GetCurrentUser('sessionId') sessionId: string,
  ): Promise<SessionResponseDto> {
    return this.sessionService.getCurrent(sessionId);
  }

  @Post('logout')
  @ApiOkResponse({ description: 'Session deleted' })
  removeSession(@Body() dto: SessionDto) {
    return this.sessionService.removeSession(dto);
  }
}
