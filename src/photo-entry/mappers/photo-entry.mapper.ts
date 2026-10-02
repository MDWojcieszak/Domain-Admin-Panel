import { PhotoEntry } from '@prisma/client';
import { PhotoEntryDetailsResponse, PhotoEntryResponse } from '../responses';
import {
  isHappeningNow,
  remainingToEdit,
  wasTouched,
} from '../photo-entry-derived';

type PhotoEntryWithAstroObjects = PhotoEntry & {
  astroObjects?: Array<{
    id: string;
    photoEntryId: string;
    astroObjectId: string;
    rootPath: string | null;
    createdAt: Date;
    updatedAt: Date;
    astroObject?: {
      id: string;
      name: string;
      code: string | null;
      thumbnailUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
  _count?: {
    astroObjects: number;
  };
};

export class PhotoEntryMapper {
  static toResponse(photoEntry: PhotoEntry): PhotoEntryResponse {
    return {
      id: photoEntry.id,
      name: photoEntry.name,
      type: photoEntry.type,
      status: photoEntry.status,
      startDate: photoEntry.startDate,
      endDate: photoEntry.endDate,
      rootPath: photoEntry.rootPath,
      foldersCreated: photoEntry.foldersCreated,
      foldersCreatedAt: photoEntry.foldersCreatedAt,
      createdAt: photoEntry.createdAt,
      updatedAt: photoEntry.updatedAt,
      uploadStatus: photoEntry.uploadStatus,

      postStage: photoEntry.postStage,
      firstEditedAt: photoEntry.firstEditedAt,
      gearConfirmedAt: photoEntry.gearConfirmedAt,

      photoCount: photoEntry.photoCount,
      selectedCount: photoEntry.selectedCount,
      editedCount: photoEntry.editedCount,

      // Computed here rather than stored, so they cannot go stale (D2, D3, §7).
      isHappeningNow: isHappeningNow(photoEntry),
      wasEdited: wasTouched(photoEntry.postStage),
      remainingToEdit: remainingToEdit(
        photoEntry.selectedCount,
        photoEntry.editedCount,
      ),
    };
  }

  static toDetailsResponse(
    photoEntry: PhotoEntryWithAstroObjects,
  ): PhotoEntryDetailsResponse {
    return {
      ...this.toResponse(photoEntry),
      astroObjects: (photoEntry.astroObjects ?? []).map((item) => ({
        id: item.id,
        astroObjectId: item.astroObjectId,
        rootPath: item.rootPath,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      astroObjectsCount:
        photoEntry._count?.astroObjects ?? photoEntry.astroObjects?.length ?? 0,
    };
  }
}
