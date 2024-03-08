import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import {
  ResetPasswordConfirmationDto,
  ResetPasswordDto,
  WelcomeEmailDto,
} from './dto';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(dto: WelcomeEmailDto) {
    const res = await this.mailerService.sendMail({
      to: dto.email,
      subject: 'Welcome to WHCP!',
      template: './welcome',
      context: dto,
    });
    return res;
  }

  async sendUserResetPassword(dto: ResetPasswordDto) {
    const res = await this.mailerService.sendMail({
      to: dto.email,
      subject: 'Reset Your password.',
      template: './reset-password',
      context: dto,
    });
    return res;
  }

  async sendUserResetPasswordConfirmation(dto: ResetPasswordConfirmationDto) {
    const res = await this.mailerService.sendMail({
      to: dto.email,
      subject: 'Password is changed.',
      template: './reset-password-confirmation',
      context: dto,
    });
    return res;
  }
}
