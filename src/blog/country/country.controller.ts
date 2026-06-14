import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { CountryService } from './country.service';
import {
  CreateBlogCountryDto,
  PatchBlogCountryDto,
  UpsertCountryTranslationDto,
} from './dto';
import { BlogCountryAdminResponse, BlogCountryListResponse } from './responses';

@Controller('blog/countries/manage')
@ApiTags('Blog · Countries (admin)')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Post()
  @ApiOkResponse({ type: BlogCountryAdminResponse })
  create(@Body() dto: CreateBlogCountryDto): Promise<BlogCountryAdminResponse> {
    return this.countryService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: BlogCountryListResponse })
  list(): Promise<BlogCountryListResponse> {
    return this.countryService.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: BlogCountryAdminResponse })
  getById(@Param('id') id: string): Promise<BlogCountryAdminResponse> {
    return this.countryService.getById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: BlogCountryAdminResponse })
  patch(
    @Param('id') id: string,
    @Body() dto: PatchBlogCountryDto,
  ): Promise<BlogCountryAdminResponse> {
    return this.countryService.patch(id, dto);
  }

  @Put(':id/translations/:locale')
  @ApiOkResponse({ type: BlogCountryAdminResponse })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertCountryTranslationDto,
  ): Promise<BlogCountryAdminResponse> {
    return this.countryService.upsertTranslation(id, locale, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: BlogCountryAdminResponse })
  delete(@Param('id') id: string): Promise<BlogCountryAdminResponse> {
    return this.countryService.delete(id);
  }
}
