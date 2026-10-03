import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../blog/common/blog-common.module';
import { ThrottleGuard } from '../common/guards/throttle.guard';
import { NotificationModule } from '../notification/notification.module';
import { ContactSettingsService } from './contact-settings.service';
import {
  InquiryController,
  PublicContactController,
  PublicInquiryController,
} from './inquiry.controller';
import { InquiryService } from './inquiry.service';

/** Contact inquiries: public form under the portfolio, inbox in the panel. */
@Module({
  imports: [NotificationModule, BlogCommonModule],
  controllers: [
    PublicContactController,
    PublicInquiryController,
    InquiryController,
  ],
  providers: [InquiryService, ContactSettingsService, ThrottleGuard],
})
export class InquiryModule {}
