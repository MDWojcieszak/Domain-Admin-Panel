import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto, PatchCommentDto } from './dto';
import { CommentListResponse, EditorialCommentResponse } from './responses';
import { COMMENT_INCLUDE, CommentMapper } from './mappers';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    postId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<EditorialCommentResponse> {
    await this.assertPostExists(postId);
    if (dto.sectionId) {
      await this.assertSectionBelongsToPost(dto.sectionId, postId);
    }

    const comment = await this.prisma.blogEditorialComment.create({
      data: {
        postId,
        sectionId: dto.sectionId ?? null,
        anchorStart: dto.anchorStart,
        anchorEnd: dto.anchorEnd,
        quote: dto.quote,
        authorId: userId,
        body: dto.body,
      },
      include: COMMENT_INCLUDE,
    });
    return CommentMapper.toResponse(comment);
  }

  async list(postId: string, sectionId?: string): Promise<CommentListResponse> {
    await this.assertPostExists(postId);
    const comments = await this.prisma.blogEditorialComment.findMany({
      where: { postId, ...(sectionId !== undefined ? { sectionId } : {}) },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return {
      total: comments.length,
      comments: comments.map((c) => CommentMapper.toResponse(c)),
    };
  }

  async get(
    postId: string,
    commentId: string,
  ): Promise<EditorialCommentResponse> {
    return CommentMapper.toResponse(
      await this.getCommentScopedToPost(postId, commentId),
    );
  }

  async patch(
    postId: string,
    commentId: string,
    userId: string,
    role: Role,
    dto: PatchCommentDto,
  ): Promise<EditorialCommentResponse> {
    const comment = await this.getCommentScopedToPost(postId, commentId);
    this.assertCanMutate(comment, userId, role);

    const updated = await this.prisma.blogEditorialComment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: COMMENT_INCLUDE,
    });
    return CommentMapper.toResponse(updated);
  }

  async delete(
    postId: string,
    commentId: string,
    userId: string,
    role: Role,
  ): Promise<EditorialCommentResponse> {
    const comment = await this.getCommentScopedToPost(postId, commentId);
    this.assertCanMutate(comment, userId, role);
    const response = CommentMapper.toResponse(comment);
    await this.prisma.blogEditorialComment.delete({ where: { id: commentId } });
    return response;
  }

  // ----- helpers -----

  private async assertPostExists(postId: string): Promise<void> {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
  }

  /** A comment may anchor to a section on ANY version of the post (not only the draft). */
  private async assertSectionBelongsToPost(
    sectionId: string,
    postId: string,
  ): Promise<void> {
    const section = await this.prisma.blogSection.findUnique({
      where: { id: sectionId },
      select: { version: { select: { postId: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.version.postId !== postId) {
      throw new BadRequestException('Section does not belong to this post');
    }
  }

  private async getCommentScopedToPost(postId: string, commentId: string) {
    const comment = await this.prisma.blogEditorialComment.findUnique({
      where: { id: commentId },
      include: COMMENT_INCLUDE,
    });
    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private assertCanMutate(
    comment: { authorId: string },
    userId: string,
    role: Role,
  ): void {
    if (comment.authorId !== userId && role !== Role.OWNER) {
      throw new ForbiddenException('Not allowed to modify this comment');
    }
  }
}
