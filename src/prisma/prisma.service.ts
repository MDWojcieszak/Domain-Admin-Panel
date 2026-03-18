import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL'),
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('DB Connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('DB Disconnected');
  }
}
