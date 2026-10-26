import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { GetCurrentUser, Public, Throttle } from '../../common/decorators';
import { ThrottleGuard } from '../../common/guards/throttle.guard';
import { CalendarFeedDto } from './calendar.dto';
import {
  CalendarFeedResponse,
  CreatedCalendarFeedResponse,
} from './calendar.response';
import { CalendarService } from './calendar.service';

/** Due dates as a calendar subscription for the phone. */
@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('feed')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CalendarFeedResponse })
  get(@GetCurrentUser('sub') userId: string): Promise<CalendarFeedResponse> {
    return this.calendar.get(userId);
  }

  /** Turns it on, or gives it a new address (the old one stops working). */
  @Post('feed')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CreatedCalendarFeedResponse })
  rotate(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CalendarFeedDto,
  ): Promise<CreatedCalendarFeedResponse> {
    return this.calendar.rotate(userId, dto);
  }

  @Patch('feed')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CalendarFeedResponse })
  update(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CalendarFeedDto,
  ): Promise<CalendarFeedResponse> {
    return this.calendar.update(userId, dto);
  }

  @Delete('feed')
  @ApiBearerAuth()
  remove(@GetCurrentUser('sub') userId: string): Promise<void> {
    return this.calendar.remove(userId);
  }

  /**
   * What the phone subscribes to. No account: the secret address is the key,
   * as with a public project link.
   */
  @Public()
  @UseGuards(ThrottleGuard)
  @Throttle(60, 60_000)
  @Get(':token.ics')
  @ApiProduces('text/calendar')
  @ApiOperation({ summary: 'The iCal feed behind a calendar address' })
  async feed(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const body = await this.calendar.render(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="projects.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(body);
  }
}
