import { AstroObject } from '@prisma/client';
import { AstroObjectDetailsResponse, AstroObjectResponse } from '../responses';

export class AstroObjectMapper {
  static toResponse(astroObject: AstroObject): AstroObjectResponse {
    return {
      id: astroObject.id,
      name: astroObject.name,
      code: astroObject.code,
      thumbnailUrl: astroObject.thumbnailUrl,
      createdAt: astroObject.createdAt,
      updatedAt: astroObject.updatedAt,
    };
  }
  static toDetailsResponse(
    astroObject: AstroObject & { _count?: { photoLinks?: number } },
  ): AstroObjectDetailsResponse {
    return {
      id: astroObject.id,
      name: astroObject.name,
      code: astroObject.code,
      thumbnailUrl: astroObject.thumbnailUrl,
      photoEntriesCount: astroObject._count?.photoLinks ?? 0,
      createdAt: astroObject.createdAt,
      updatedAt: astroObject.updatedAt,
    };
  }
}
