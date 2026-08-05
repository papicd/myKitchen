import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async notifyCommentOnRecipe(input: {
    userId: string;
    actorUserId: string;
    recipeId: string;
    recipeTitle: string;
    commentText: string;
  }) {
    if (input.userId === input.actorUserId) {
      return;
    }

    await this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: 'comment',
      actorUserId: new Types.ObjectId(input.actorUserId),
      recipeId: new Types.ObjectId(input.recipeId),
      recipeTitle: input.recipeTitle.trim(),
      commentText: input.commentText.trim(),
      isRead: false,
      readAt: null,
    });
  }

  async notifyFollowedAuthorPost(input: {
    actorUserId: string;
    followerIds: string[];
    recipeId: string;
    recipeTitle: string;
  }) {
    const followerIds = Array.from(
      new Set(
        input.followerIds
          .filter((id) => id && id !== input.actorUserId)
          .map((id) => id.trim()),
      ),
    );

    if (followerIds.length === 0) {
      return;
    }

    await this.notificationModel.insertMany(
      followerIds.map((userId) => ({
        userId: new Types.ObjectId(userId),
        type: 'followed_author_post',
        actorUserId: new Types.ObjectId(input.actorUserId),
        recipeId: new Types.ObjectId(input.recipeId),
        recipeTitle: input.recipeTitle.trim(),
        commentText: '',
        isRead: false,
        readAt: null,
      })),
    );
  }

  async findByUser(userId: string, limit = 50) {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(100, Math.floor(limit))));
  }

  async getUnreadCount(userId: string) {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
  }

  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    return { success: true };
  }
}

