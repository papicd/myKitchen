import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export type NotificationType =
  | 'comment'
  | 'followed_author_post'
  | 'follow'
  | 'recipe_rated'
  | 'recipe_saved'
  | 'saved_recipe_updated';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'comment',
      'followed_author_post',
      'follow',
      'recipe_rated',
      'recipe_saved',
      'saved_recipe_updated',
    ],
    required: true,
  })
  type: NotificationType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Recipe', default: null })
  recipeId: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: '' })
  recipeTitle: string;

  @Prop({ type: String, trim: true, default: '' })
  commentText: string;

  @Prop({ type: Number, default: null })
  ratingValue: number | null;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });

