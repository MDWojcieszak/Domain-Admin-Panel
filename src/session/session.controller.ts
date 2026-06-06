import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { SessionService } from './session.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { PaginationDto } from '../common/dto';
import { SessionListResponseDto, SessionResponseDto } from './responses';

@ApiTags('Session')
@Controller('session')
@ApiBearerAuth()
export class SessionController {
  constructor(private sessionService: SessionService) {}

  @Get('my')
  @ApiOkResponse({
    type: SessionListResponseDto,
    description: 'List of all sessions for the current user',
  })
  getAllForUser(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('sessionId') sessionId: string,
    @Query() dto: PaginationDto,
  ): Promise<SessionListResponseDto> {
    return this.sessionService.getAllForUser(dto, userId, sessionId);
  }

  @Get('user/:userId')
  @RequirePermissions(PERMISSIONS.SESSION_READ)
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
  @RequirePermissions(PERMISSIONS.SESSION_READ)
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

  @Delete('others')
  @ApiOkResponse({
    description: 'Revoke all of the current user sessions except this one',
  })
  revokeOthers(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('sessionId') sessionId: string,
  ) {
    return this.sessionService.revokeOthers(userId, sessionId);
  }

  @Delete('admin/:id')
  @RequirePermissions(PERMISSIONS.SESSION_MANAGE)
  @ApiOkResponse({ description: 'Revoke any session (admin)' })
  revokeByAdmin(@Param('id') id: string) {
    return this.sessionService.revokeByAdmin(id);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Revoke one of your own sessions' })
  revokeOwn(@GetCurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.sessionService.revokeOwn(id, userId);
  }
}
