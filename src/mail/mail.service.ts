import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation() {
    const res = await this.mailerService.sendMail({
      to: 'mateusz@wojcieszak.dev',
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to WHCP!',
      template: './welcome', // `.hbs` extension is appended automatically

      context: {
        firstName: 'Mateusz',
        accessLink: 'http://localhost:5173/sign-in',
        accessCode: '546 345',
      },
    });
    return res;
  }
}
