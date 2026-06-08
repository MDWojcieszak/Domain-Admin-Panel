import { Prisma } from '@prisma/client';

import { EditorialCommentResponse } from '../responses';

export const COMMENT_INCLUDE = {
  author: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} satisfies Prisma.BlogEditorialCommentInclude;

export type CommentWithAuthor = Prisma.BlogEditorialCommentGetPayload<{
  include: typeof COMMENT_INCLUDE;
}>;

export class CommentMapper {
  static toResponse(comment: CommentWithAuthor): EditorialCommentResponse {
    return {
      id: comment.id,
      postId: comment.postId,
      sectionId: comment.sectionId,
      anchorStart: comment.anchorStart,
      anchorEnd: comment.anchorEnd,
      quote: comment.quote,
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        email: comment.author.email,
        firstName: comment.author.firstName,
        lastName: comment.author.lastName,
      },
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
