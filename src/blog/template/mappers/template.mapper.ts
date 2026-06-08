import { Prisma } from '@prisma/client';

import { TemplateBlockResponse, TemplateResponse } from '../responses';

export const TEMPLATE_INCLUDE = {
  blocks: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.BlogSectionTemplateInclude;

export type TemplateWithBlocks = Prisma.BlogSectionTemplateGetPayload<{
  include: typeof TEMPLATE_INCLUDE;
}>;
type TemplateBlock = TemplateWithBlocks['blocks'][number];

export class TemplateMapper {
  static toResponse(template: TemplateWithBlocks): TemplateResponse {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description,
      icon: template.icon,
      group: template.group,
      isSystem: template.isSystem,
      order: template.order,
      blocks: template.blocks.map((b) => this.toBlock(b)),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  static toBlock(block: TemplateBlock): TemplateBlockResponse {
    return {
      id: block.id,
      templateId: block.templateId,
      type: block.type,
      order: block.order,
      headingLevel: block.headingLevel,
      calloutVariant: block.calloutVariant,
      galleryLayout: block.galleryLayout,
      mediaPosition: block.mediaPosition,
      mediaSplit: block.mediaSplit,
      mobileStackOrder: block.mobileStackOrder,
      imageSize: block.imageSize,
      aspectRatio: block.aspectRatio,
      overlayPosition: block.overlayPosition,
      placeholderTitle: block.placeholderTitle,
      placeholderBody: block.placeholderBody,
    };
  }
}
