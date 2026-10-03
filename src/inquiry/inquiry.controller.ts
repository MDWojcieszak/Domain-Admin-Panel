import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '../common/acl/permissions';
import { Public, RequirePermissions } from '../common/decorators';
import { Throttle } from '../common/decorators/throttle.decorator';
import { ThrottleGuard } from '../common/guards/throttle.guard';
import {
  CreateInquiryDto,
  GetInquiriesQueryDto,
  PatchInquiryDto,
  UpdateContactSettingsDto,
} from './dto';
import { ContactSettingsService } from './contact-settings.service';
import { InquiryService } from './inquiry.service';
import {
  ContactSettingsResponse,
  InquiryListResponse,
  InquiryReceivedResponse,
  InquiryResponse,
  InquirySummaryResponse,
  PublicContactResponse,
} from './responses';

/** The contact form under the public portfolio. */
@ApiTags('Portfolio')
@Controller('portfolio/inquiries')
export class PublicInquiryController {
  constructor(private readonly inquiries: InquiryService) {}

  @Public()
  @UseGuards(ThrottleGuard)
  @Throttle(3, 10 * 60_000) // 3 messages / 10 min / IP
  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send an inquiry from the contact form',
    description:
      'No account needed. Optional galleryId / imageId say what it is about ' +
      '(must be public). acknowledgedPrivacyNotice must be true; 403 while the ' +
      'form is disabled in the panel. Keep the honeypot `website` ' +
      'field hidden and empty. The answer is the same for every accepted ' +
      'submission.',
  })
  @ApiOkResponse({ type: InquiryReceivedResponse })
  create(
    @Body() dto: CreateInquiryDto,
    @Ip() ip: string,
  ): Promise<InquiryReceivedResponse> {
    return this.inquiries.create(dto, { ip });
  }
}

/** What the public contact form shows; driven by the panel settings. */
@ApiTags('Portfolio')
@Controller('portfolio/contact')
export class PublicContactController {
  constructor(private readonly settings: ContactSettingsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Contact form configuration',
    description:
      '?locale=en picks the language (default one when missing). ' +
      'enabled=false → hide the form. Otherwise: intro, offered topics, the ' +
      'privacy notice (markdown) with its version, and the data controller.',
  })
  @ApiOkResponse({ type: PublicContactResponse })
  get(@Query('locale') locale?: string): Promise<PublicContactResponse> {
    return this.settings.getPublic(locale);
  }
}

/** Inquiries in the panel. Replies go from the owner's own mailbox. */
@ApiTags('Inquiries')
@ApiBearerAuth()
@Controller('inquiries')
export class InquiryController {
  constructor(
    private readonly inquiries: InquiryService,
    private readonly settings: ContactSettingsService,
  ) {}

  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @Get()
  @ApiOperation({
    summary: 'List inquiries',
    description:
      'Newest first. Without `status` it is the inbox: everything except ARCHIVED and SPAM.',
  })
  @ApiOkResponse({ type: InquiryListResponse })
  list(@Query() query: GetInquiriesQueryDto): Promise<InquiryListResponse> {
    return this.inquiries.list(query);
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @Get('summary')
  @ApiOkResponse({
    description: 'Counts for the navigation badge',
    type: InquirySummaryResponse,
  })
  summary(): Promise<InquirySummaryResponse> {
    return this.inquiries.summary();
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @Get('settings')
  @ApiOkResponse({
    description: 'Contact form configuration',
    type: ContactSettingsResponse,
  })
  getSettings(): Promise<ContactSettingsResponse> {
    return this.settings.get();
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_MANAGE)
  @Patch('settings')
  @ApiOperation({
    summary: 'Update the contact form configuration',
    description:
      'Enabling is refused (400) until administratorName, administratorEmail ' +
      'and privacyNotice are filled in. A real change of privacyNotice bumps ' +
      'its version; each inquiry records the version its sender confirmed.',
  })
  @ApiOkResponse({ type: ContactSettingsResponse })
  updateSettings(
    @Body() dto: UpdateContactSettingsDto,
  ): Promise<ContactSettingsResponse> {
    return this.settings.update(dto);
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_READ)
  @Get(':id')
  @ApiOkResponse({ type: InquiryResponse })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InquiryResponse> {
    return this.inquiries.get(id);
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Change status or the internal note',
    description:
      'Leaving NEW stamps readAt; ANSWERED stamps answeredAt; NEW again = mark as unread.',
  })
  @ApiOkResponse({ type: InquiryResponse })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchInquiryDto,
  ): Promise<InquiryResponse> {
    return this.inquiries.patch(id, dto);
  }

  @RequirePermissions(PERMISSIONS.INQUIRY_MANAGE)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted inquiry' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.inquiries.remove(id);
  }
}
