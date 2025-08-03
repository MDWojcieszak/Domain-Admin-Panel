import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonAiController } from './person-ai.controller';
import { PersonAiService } from './person-ai.service';
import { PersonService } from './person.service';

@Module({
  controllers: [PersonAiController, PersonController],
  providers: [PersonAiService, PersonService],
  exports: [PersonAiService, PersonService],
})
export class PersonModule {}
