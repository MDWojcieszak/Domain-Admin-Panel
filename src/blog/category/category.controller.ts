import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { CategoryService } from './category.service';
import {
  CreateBlogCategoryDto,
  GetCategoriesQueryDto,
  GetPublicCategoriesQueryDto,
  PatchBlogCategoryDto,
  UpsertCategoryTranslationDto,
} from './dto';
import {
  CategoryListResponse,
  CategoryResponse,
  ResolvedCategoryListResponse,
} from './responses';

@Controller('blog/categories')
@ApiTags('Blog · Categories')
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get('public')
  @ApiOkResponse({
    description: 'Public category catalog (locale-resolved id → key + label)',
    type: ResolvedCategoryListResponse,
  })
  async listPublic(
    @Query() query: GetPublicCategoriesQueryDto,
  ): Promise<ResolvedCategoryListResponse> {
    return this.categoryService.listPublic(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get()
  @ApiOkResponse({ description: 'List categories', type: CategoryListResponse })
  async list(
    @Query() query: GetCategoriesQueryDto,
  ): Promise<CategoryListResponse | ResolvedCategoryListResponse> {
    return this.categoryService.list(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get(':id')
  @ApiOkResponse({ description: 'Category detail', type: CategoryResponse })
  async getById(@Param('id') id: string): Promise<CategoryResponse> {
    return this.categoryService.getById(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_CATEGORY_MANAGE)
  @Post()
  @ApiOkResponse({ description: 'Created category', type: CategoryResponse })
  async create(@Body() dto: CreateBlogCategoryDto): Promise<CategoryResponse> {
    return this.categoryService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_CATEGORY_MANAGE)
  @Patch(':id')
  @ApiOkResponse({ description: 'Patched category', type: CategoryResponse })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchBlogCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoryService.patch(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_CATEGORY_MANAGE)
  @Put(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted category translation',
    type: CategoryResponse,
  })
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertCategoryTranslationDto,
  ): Promise<CategoryResponse> {
    return this.categoryService.upsertTranslation(id, locale, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_CATEGORY_MANAGE)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted category', type: CategoryResponse })
  async delete(@Param('id') id: string): Promise<CategoryResponse> {
    return this.categoryService.delete(id);
  }
}
