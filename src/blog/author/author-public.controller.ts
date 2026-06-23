import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { AuthorService } from './author.service';
import { GetPublicAuthorsQueryDto } from './dto';
import { PublicAuthorListResponse } from './responses';

@Controller('blog/authors')
@ApiTags('Blog · Authors')
export class AuthorPublicController {
  constructor(private readonly authorService: AuthorService) {}

  @Public()
  @Get('public')
  @ApiOkResponse({
    description: 'Resolve post author ids → public byline (name + avatar)',
    type: PublicAuthorListResponse,
  })
  async listPublic(
    @Query() query: GetPublicAuthorsQueryDto,
  ): Promise<PublicAuthorListResponse> {
    return this.authorService.resolvePublic(query.ids);
  }
}
