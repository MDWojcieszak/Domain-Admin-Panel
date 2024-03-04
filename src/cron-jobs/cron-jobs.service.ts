import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { ServerService } from '../server/server.service';

@Injectable()
export class CronJobsService {
  constructor(
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
    private serverService: ServerService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    try {
      const serverStatus = await firstValueFrom(
        this.multiVerseClient.send('get_system_usage', {}),
      );

      this.serverService.updateProperties(serverStatus);
      if (serverStatus === 'ONLINE') {
        console.log('Cron job is running because server status is ONLINE');
        // Perform your cron job logic here
      } else {
        console.log('Cron job is skipped because server status is not ONLINE');
      }
    } catch (error) {
      console.error('Error executing cron job:', error);
    }
  }
}
