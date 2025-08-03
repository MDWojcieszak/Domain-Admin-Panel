import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, GetTokenUser } from '../common/decorators';
import { PersonService } from './person.service';
import { PersonDetailResponseDto, PersonListResponseDto } from './responses';
import { PaginationDto } from '../common/dto';
import { PersonCreateDto, PersonUpdateDto } from './dto';
import { AiHistoryListResponseDto } from '../common/responses';
import { PersonAiService } from './person-ai.service';

@ApiTags('Person')
@ApiBearerAuth()
@Controller('person')
export class PersonController {
  constructor(
    private readonly personService: PersonService,
    private readonly personAiService: PersonAiService,
  ) {}

  @Get('list')
  @ApiOkResponse({
    type: PersonListResponseDto,
    description: 'List all persons for the current user',
  })
  async listPersons(
    @GetCurrentUser('sub') userId: string,
    @Query() params: PaginationDto,
  ): Promise<PersonListResponseDto> {
    return this.personService.listPersons(userId, params);
  }

  @Get(':id')
  @ApiOkResponse({
    type: PersonDetailResponseDto,
    description: 'Get person details',
  })
  async getPerson(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PersonDetailResponseDto> {
    return this.personService.getPerson(userId, id);
  }

  @Get(':id/ai/history')
  @ApiOkResponse({ type: AiHistoryListResponseDto })
  async getAiHistory(
    @Param('id') personId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<AiHistoryListResponseDto> {
    return this.personAiService.getAiHistory(userId, personId);
  }

  @Post()
  @ApiOkResponse({ type: PersonDetailResponseDto })
  async createPerson(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: PersonCreateDto,
  ): Promise<PersonDetailResponseDto> {
    return this.personService.createPerson(userId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: PersonDetailResponseDto })
  async updatePerson(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PersonUpdateDto,
  ): Promise<PersonDetailResponseDto> {
    return this.personService.updatePerson(userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: PersonDetailResponseDto })
  async deletePerson(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PersonDetailResponseDto> {
    return this.personService.deletePerson(userId, id);
  }
}
