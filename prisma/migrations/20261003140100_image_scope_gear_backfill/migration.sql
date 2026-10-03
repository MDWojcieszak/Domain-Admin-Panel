-- Move existing gear photos out of the gallery. Only images used SOLELY by gear:
-- a photo that is also in a gallery, a gallery cover, the hero or an avatar
-- stays GALLERY, since it genuinely belongs to the gallery as well.
UPDATE "Image" i
   SET "scope" = 'GEAR'
 WHERE i."scope" = 'GALLERY'
   AND (
        EXISTS (SELECT 1 FROM "GearItem"   g WHERE g."imageId" = i."id")
     OR EXISTS (SELECT 1 FROM "GearSystem" s WHERE s."imageId" = i."id")
   )
   AND NOT EXISTS (SELECT 1 FROM "GalleryImage" gi WHERE gi."imageId" = i."id")
   AND NOT EXISTS (SELECT 1 FROM "Gallery"      ga WHERE ga."coverImageId" = i."id")
   AND NOT EXISTS (SELECT 1 FROM "HeroImage"    h  WHERE h."imageId" = i."id")
   AND NOT EXISTS (SELECT 1 FROM "User"         u  WHERE u."avatarId" = i."id");
