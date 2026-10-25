import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, open, readFile, rename, rm } from 'fs/promises';
import { dirname } from 'path';
import * as sharp from 'sharp';

import { PrismaService } from '../prisma/prisma.service';
import {
  ProjectAccess,
  ProjectAccessService,
} from '../project/project-access.service';
import { taskKey } from '../project/project-defaults';
import { ProjectEventsService } from '../project/project-events.service';
import { USER_SELECT } from '../project/project.service';
import {
  classifyDocument,
  contentDisposition,
  deriveDocumentSecret,
  DocumentVariant,
  documentUrlExpiry,
  isInlineSafe,
  PREVIEW_WIDTH,
  signDocument,
  SNIFF_BYTES,
  titleFromName,
  verifyDocument,
} from './document-rules';
import { documentPath } from './document-storage';
import {
  CreateDocumentLinkDto,
  DocumentFileQueryDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
  UploadDocumentDto,
} from './dto';
import {
  DocumentLinkResponse,
  DocumentResponse,
  UploadDocumentResponse,
} from './responses';

/** Larger images keep no preview: decoding them is not worth the memory. */
const PREVIEW_MAX_BYTES = 100 * 1024 * 1024;

/** The projects an account can see: its own, and those it was invited to. */
const visibleTo = (userId: string): Prisma.ProjectWhereInput => ({
  OR: [{ ownerId: userId }, { members: { some: { userId } } }],
});

const LINK_INCLUDE = {
  project: { select: { id: true, title: true, key: true } },
  task: {
    select: {
      id: true,
      number: true,
      title: true,
      project: { select: { id: true, title: true, key: true } },
    },
  },
  addedBy: { select: USER_SELECT },
} satisfies Prisma.DocumentLinkInclude;

type LinkRow = Prisma.DocumentLinkGetPayload<{ include: typeof LINK_INCLUDE }>;

const documentInclude = (userId: string) =>
  ({
    owner: { select: USER_SELECT },
    // Only pins in places the reader can see: a document in someone else's
    // private project does not reveal that project.
    links: {
      where: {
        OR: [
          { project: visibleTo(userId) },
          { task: { project: visibleTo(userId) } },
        ],
      },
      include: LINK_INCLUDE,
      orderBy: { createdAt: 'asc' },
    },
  }) satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{
  include: ReturnType<typeof documentInclude>;
}>;

export interface ServedDocument {
  path: string;
  contentType: string;
  disposition: string;
}

/**
 * The document library (docs/projects-design.md D8, D9, §4): any file, owned
 * by whoever uploaded it, pinned to projects and tasks. Seeing a document
 * takes owning it or seeing a project it is pinned in; its bytes only ever
 * leave through a signed, short-lived URL issued after that check.
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly secret: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
    config: ConfigService,
  ) {
    const appSecret = config.get<string>('JWT_SECRET');
    this.secret = appSecret ? deriveDocumentSecret(appSecret) : null;
  }

  // — reading —

  async list(
    userId: string,
    query: ListDocumentsQueryDto,
  ): Promise<DocumentResponse[]> {
    let where: Prisma.DocumentWhereInput;
    if (query.taskId) {
      await this.access.assertTask(userId, query.taskId, ProjectAccess.VIEW);
      where = { links: { some: { taskId: query.taskId } } };
    } else if (query.projectId) {
      await this.access.assert(userId, query.projectId, ProjectAccess.VIEW);
      where = {
        links: {
          some: {
            OR: [
              { projectId: query.projectId },
              { task: { projectId: query.projectId } },
            ],
          },
        },
      };
    } else {
      where = { ownerId: userId };
    }

    const q = query.q?.trim();
    const documents = await this.prisma.document.findMany({
      where: {
        ...where,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { originalName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: documentInclude(userId),
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return documents.map((d) => this.toResponse(d, userId));
  }

  async get(userId: string, id: string): Promise<DocumentResponse> {
    return this.toResponse(await this.findVisible(userId, id), userId);
  }

  // — writing —

  async upload(
    userId: string,
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponse> {
    if (!file?.path)
      throw new BadRequestException('Attach the file as "file".');
    try {
      if (dto.projectId && dto.taskId) {
        throw new BadRequestException(
          'Pin it to a project or a task, not both.',
        );
      }
      // Checked before any work, so a refused pin leaves nothing behind.
      const target =
        dto.projectId || dto.taskId
          ? await this.resolveTarget(userId, {
              projectId: dto.projectId,
              taskId: dto.taskId,
            })
          : null;

      const originalName = this.originalName(file.originalname);
      const [head, sha256] = await Promise.all([
        this.readHead(file.path),
        this.hashFile(file.path),
      ]);

      const existing = await this.prisma.document.findFirst({
        where: { ownerId: userId, sha256 },
        select: { id: true },
      });
      if (existing) {
        if (target) await this.pin(userId, existing.id, target, true);
        return {
          document: await this.get(userId, existing.id),
          duplicate: true,
        };
      }

      const id = randomUUID();
      const { kind, mimeType, extension } = classifyDocument(
        head,
        originalName,
      );
      const finalPath = documentPath(id, extension, 'original');
      await mkdir(dirname(finalPath), { recursive: true });
      await this.move(file.path, finalPath);

      const preview =
        kind === 'IMAGE' && file.size <= PREVIEW_MAX_BYTES
          ? await this.makePreviews(id, finalPath)
          : null;

      try {
        await this.prisma.document.create({
          data: {
            id,
            title: dto.title?.trim() || titleFromName(originalName),
            description: dto.description?.trim() || null,
            originalName,
            mimeType,
            kind,
            sizeBytes: BigInt(file.size),
            extension,
            sha256,
            hasPreview: !!preview,
            width: preview?.width ?? null,
            height: preview?.height ?? null,
            ownerId: userId,
          },
        });
      } catch (error) {
        await this.removeFiles(id, extension);
        throw error;
      }

      if (target) await this.pin(userId, id, target, true);
      return { document: await this.get(userId, id), duplicate: false };
    } finally {
      // Moved already on success; on any failure the upload goes.
      await rm(file.path, { force: true }).catch(() => undefined);
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponse> {
    await this.findOwned(userId, id);
    await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      },
    });
    const document = await this.get(userId, id);
    this.announce(userId, document.links);
    return document;
  }

  /** Gone from the library and from every place it was pinned. */
  async remove(userId: string, id: string): Promise<void> {
    const document = await this.findOwned(userId, id);
    const links = await this.prisma.documentLink.findMany({
      where: { documentId: id },
      include: LINK_INCLUDE,
    });
    await this.prisma.document.delete({ where: { id } });
    await this.removeFiles(id, document.extension);
    this.announce(
      userId,
      links.map((l) => this.toLink(l)),
    );
  }

  async link(
    userId: string,
    id: string,
    dto: CreateDocumentLinkDto,
  ): Promise<DocumentResponse> {
    await this.findVisible(userId, id);
    const target = await this.resolveTarget(userId, dto);
    await this.pin(userId, id, target, false);
    return this.get(userId, id);
  }

  /** By an editor of the place it is pinned in, or by the document's owner. */
  async unlink(
    userId: string,
    id: string,
    linkId: string,
  ): Promise<DocumentResponse | null> {
    const link = await this.prisma.documentLink.findFirst({
      where: { id: linkId, documentId: id },
      include: { ...LINK_INCLUDE, document: { select: { ownerId: true } } },
    });
    if (!link) throw new NotFoundException('No such pin.');
    const projectId = link.projectId ?? link.task!.project.id;
    if (link.document.ownerId !== userId) {
      await this.access.assert(userId, projectId, ProjectAccess.EDIT);
    }

    await this.prisma.documentLink.delete({ where: { id: linkId } });
    this.announce(userId, [this.toLink(link)]);
    // Unpinning from the last place you could see it from hides it from you.
    return this.get(userId, id).catch(() => null);
  }

  // — the bytes —

  /** Behind a signed URL only (D9): the signature is the authorisation. */
  async serve(
    id: string,
    query: DocumentFileQueryDto,
  ): Promise<ServedDocument> {
    const exp = Number(query.exp);
    if (
      !verifyDocument(this.requireSecret(), {
        id,
        variant: query.variant,
        exp,
        sig: query.sig,
      })
    ) {
      throw new ForbiddenException(
        'This link has expired; reopen the document.',
      );
    }
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');

    if (query.variant !== 'original') {
      if (!document.hasPreview)
        throw new NotFoundException('No preview for this document.');
      return {
        path: documentPath(id, null, query.variant),
        contentType: 'image/webp',
        disposition: contentDisposition('inline', `${document.title}.webp`),
      };
    }
    const inline =
      query.download !== '1' && isInlineSafe(document.kind, document.mimeType);
    return {
      path: documentPath(id, document.extension, 'original'),
      contentType: document.mimeType,
      disposition: contentDisposition(
        inline ? 'inline' : 'attachment',
        document.originalName,
      ),
    };
  }

  // — internals —

  private async findVisible(userId: string, id: string): Promise<DocumentRow> {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            links: {
              some: {
                OR: [
                  { project: visibleTo(userId) },
                  { task: { project: visibleTo(userId) } },
                ],
              },
            },
          },
        ],
      },
      include: documentInclude(userId),
    });
    // The same answer whether it does not exist or is not yours to see.
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private async findOwned(userId: string, id: string) {
    const document = await this.findVisible(userId, id);
    if (document.ownerId !== userId) {
      throw new ForbiddenException(
        'Only its owner changes or deletes a document.',
      );
    }
    return document;
  }

  private async resolveTarget(
    userId: string,
    dto: CreateDocumentLinkDto,
  ): Promise<{ projectId: string; taskId: string | null }> {
    if (!!dto.projectId === !!dto.taskId) {
      throw new BadRequestException('Pin it to exactly one project or task.');
    }
    if (dto.taskId) {
      const { task } = await this.access.assertTask(
        userId,
        dto.taskId,
        ProjectAccess.EDIT,
      );
      return { projectId: task.projectId, taskId: task.id };
    }
    await this.access.assert(userId, dto.projectId!, ProjectAccess.EDIT);
    return { projectId: dto.projectId!, taskId: null };
  }

  /**
   * Only your own documents travel between projects. Someone else's can be
   * pinned again only inside a project it is already in (from the project to
   * one of its tasks), so sharing a project never spreads its files further.
   */
  private async pin(
    userId: string,
    documentId: string,
    target: { projectId: string; taskId: string | null },
    tolerateDuplicate: boolean,
  ) {
    const document = await this.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { ownerId: true },
    });
    if (document.ownerId !== userId) {
      const inProject = await this.prisma.documentLink.count({
        where: {
          documentId,
          OR: [
            { projectId: target.projectId },
            { task: { projectId: target.projectId } },
          ],
        },
      });
      if (!inProject) {
        throw new ForbiddenException(
          'Only its owner can pin this document in another project.',
        );
      }
    }

    try {
      const link = await this.prisma.documentLink.create({
        data: target.taskId
          ? { documentId, taskId: target.taskId, addedById: userId }
          : { documentId, projectId: target.projectId, addedById: userId },
        include: LINK_INCLUDE,
      });
      this.announce(userId, [this.toLink(link)]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (tolerateDuplicate) return;
        throw new ConflictException('It is already pinned there.');
      }
      throw error;
    }
  }

  private announce(actorId: string, links: DocumentLinkResponse[]) {
    for (const projectId of new Set(links.map((l) => l.project.id))) {
      void this.events.changed({ projectId, kind: 'document', actorId });
    }
  }

  /** Thumbnail and large preview; a file sharp cannot read simply has none. */
  private async makePreviews(id: string, originalPath: string) {
    try {
      // From memory, not the path: libvips keeps files it opened, which on
      // Windows stops the original from ever being deleted.
      const original = await readFile(originalPath);
      const metadata = await sharp(original).metadata();
      const target = documentPath(id, null, 'thumb');
      await mkdir(dirname(target), { recursive: true });
      for (const variant of ['thumb', 'large'] as const) {
        await sharp(original)
          .rotate()
          .resize({
            width: PREVIEW_WIDTH[variant],
            fit: sharp.fit.inside,
            withoutEnlargement: true,
          })
          .webp({ quality: variant === 'thumb' ? 75 : 85 })
          .toFile(documentPath(id, null, variant));
      }
      const sideways = (metadata.orientation ?? 1) >= 5;
      return {
        width: (sideways ? metadata.height : metadata.width) ?? null,
        height: (sideways ? metadata.width : metadata.height) ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `No preview for document ${id}: ${(error as Error).message}`,
      );
      await rm(documentPath(id, null, 'thumb'), { force: true });
      await rm(documentPath(id, null, 'large'), { force: true });
      return null;
    }
  }

  private async removeFiles(id: string, extension: string | null) {
    for (const variant of ['original', 'thumb', 'large'] as const) {
      await rm(documentPath(id, extension, variant), { force: true }).catch(
        () => undefined,
      );
    }
  }

  private async readHead(path: string): Promise<Buffer> {
    const handle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(SNIFF_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, SNIFF_BYTES, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  private hashFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      createReadStream(path)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolve(hash.digest('hex')))
        .on('error', reject);
    });
  }

  /** Rename when on the same disk, copy when the temp dir is elsewhere. */
  private async move(from: string, to: string) {
    try {
      await rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await copyFile(from, to);
      await rm(from, { force: true });
    }
  }

  /** Multer hands the name over as latin1; browsers send UTF-8. */
  private originalName(raw: string) {
    // Above U+00FF it is already proper Unicode; latin1 cannot hold it.
    const alreadyDecoded = [...raw].some((c) => c.charCodeAt(0) > 0xff);
    const decoded = alreadyDecoded
      ? raw
      : Buffer.from(raw, 'latin1').toString('utf8');
    const name = (decoded.includes('�') ? raw : decoded)
      .replace(/[\\/\0]/g, '_')
      .trim();
    return name.slice(-255) || 'file';
  }

  private requireSecret() {
    if (!this.secret) {
      throw new ServiceUnavailableException(
        'Document links are not configured (JWT_SECRET).',
      );
    }
    return this.secret;
  }

  private url(
    id: string,
    variant: DocumentVariant,
    exp: number,
    download = false,
  ) {
    const sig = signDocument(this.requireSecret(), id, variant, exp);
    return `/documents/${id}/file?variant=${variant}&exp=${exp}&sig=${sig}${download ? '&download=1' : ''}`;
  }

  private toLink(link: LinkRow): DocumentLinkResponse {
    return {
      id: link.id,
      project: link.project ?? link.task!.project,
      task: link.task
        ? {
            id: link.task.id,
            key: taskKey(link.task.project.key, link.task.number),
            title: link.task.title,
          }
        : null,
      addedBy: link.addedBy,
      createdAt: link.createdAt,
    };
  }

  private toResponse(document: DocumentRow, userId: string): DocumentResponse {
    const exp = documentUrlExpiry();
    return {
      id: document.id,
      title: document.title,
      description: document.description,
      originalName: document.originalName,
      mimeType: document.mimeType,
      kind: document.kind,
      sizeBytes: Number(document.sizeBytes),
      extension: document.extension,
      width: document.width,
      height: document.height,
      owner: document.owner,
      isMine: document.ownerId === userId,
      inline: isInlineSafe(document.kind, document.mimeType),
      thumbUrl: document.hasPreview
        ? this.url(document.id, 'thumb', exp)
        : null,
      previewUrl: document.hasPreview
        ? this.url(document.id, 'large', exp)
        : null,
      fileUrl: this.url(document.id, 'original', exp),
      downloadUrl: this.url(document.id, 'original', exp, true),
      links: document.links.map((l) => this.toLink(l)),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
