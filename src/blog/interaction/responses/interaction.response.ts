import { BlogFeedbackRating } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/** Viewer's own engagement state + public counters. */
export class InteractionStateResponse {
  @IsString()
  postId: string;

  @IsBoolean()
  liked: boolean;

  @IsEnum({ enum: { BlogFeedbackRating }, optional: true, nullable: true })
  feedbackRating: BlogFeedbackRating | null;

  @IsNumber({ type: 'integer' })
  viewCount: number;

  @IsNumber({ type: 'integer' })
  likeCount: number;

  @IsNumber({ type: 'integer' })
  helpfulCount: number;

  @IsNumber({ type: 'integer' })
  notHelpfulCount: number;
}

export class LikeToggleResponse {
  @IsBoolean()
  liked: boolean;

  @IsNumber({ type: 'integer' })
  likeCount: number;
}

export class ViewResultResponse {
  /** True when this request counted a new view (false = deduped within window). */
  @IsBoolean()
  counted: boolean;

  @IsNumber({ type: 'integer' })
  viewCount: number;
}

/**
 * Post-level feedback aggregate + the caller's own rating. The comment is NOT
 * echoed here — feedback comments are only surfaced on the analytics route
 * (BLOG_ANALYTICS), never on a BLOG_READ response.
 */
export class FeedbackResponse {
  @IsString()
  postId: string;

  @IsEnum({ enum: { BlogFeedbackRating }, optional: true, nullable: true })
  rating: BlogFeedbackRating | null;

  @IsNumber({ type: 'integer' })
  helpfulCount: number;

  @IsNumber({ type: 'integer' })
  notHelpfulCount: number;
}
