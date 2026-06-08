import { BlogFeedbackRating } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

/** A recent feedback row (INTERNAL — only on the analytics route). */
export class RecentFeedbackResponse {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  userId: string | null;

  @IsEnum({ enum: { BlogFeedbackRating } })
  rating: BlogFeedbackRating;

  @IsString({ optional: true, nullable: true })
  comment: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

/** Staff analytics for a post (BLOG_ANALYTICS only). */
export class InsightsResponse {
  @IsString()
  postId: string;

  @IsNumber({ type: 'integer' })
  viewCount: number;

  @IsNumber({ type: 'integer' })
  likeCount: number;

  @IsNumber({ type: 'integer' })
  helpfulCount: number;

  @IsNumber({ type: 'integer' })
  notHelpfulCount: number;

  /** Distinct logged-in viewers (anonymous views excluded). */
  @IsNumber({ type: 'integer' })
  uniqueViewerCount: number;

  @IsNested({ type: RecentFeedbackResponse, isArray: true })
  recentFeedback: RecentFeedbackResponse[];
}
