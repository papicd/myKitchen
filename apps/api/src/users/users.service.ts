import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipe } from '../recipes/schemas/recipe.schema';
import { buildAccentInsensitivePattern } from '../shared/search-normalization';
import { User } from './schemas/user.schema';

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  isAdmin?: boolean;
  isRecommended?: boolean;
};

export type UpdateOwnProfileInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
};

export type FindUsersInput = {
  query?: string;
  page?: number;
  limit?: number;
};

export type RecipeCollectionOutput = {
  id: string;
  name: string;
  recipeIds: string[];
};

export type ActivityFeedItem = {
  id: string;
  type: 'recipe_created' | 'recipe_rated' | 'recipe_commented';
  createdAt: string;
  actor: { id: string };
  recipe: { id: string; title: string };
  ratingValue?: number;
  commentText?: string;
};

export type UserNotificationOutput = {
  id: string;
  type:
    | 'comment'
    | 'followed_author_post'
    | 'follow'
    | 'recipe_rated'
    | 'recipe_saved'
    | 'saved_recipe_updated';
  createdAt: string;
  isRead: boolean;
  actor: { id: string };
  recipe?: { id: string; title: string };
  commentText?: string;
  ratingValue?: number;
};

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Recipe.name) private readonly recipeModel: Model<Recipe>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onApplicationBootstrap() {
    await this.userModel.updateMany(
      { isRecommended: { $exists: false } },
      { $set: { isRecommended: false } },
    );
    await this.userModel.updateMany(
      { following: { $exists: false } },
      { $set: { following: [] } },
    );
    await this.userModel.updateMany(
      { recipeCollections: { $exists: false } },
      { $set: { recipeCollections: [] } },
    );
    await this.userModel.updateMany(
      { avatarUrl: { $exists: false } },
      { $set: { avatarUrl: null } },
    );
    await this.seedUsers();
  }

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase().trim();
    const username = input.username.toLowerCase().trim();
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('Email or username is already in use');
    }

    const password = await bcrypt.hash(input.password, 10);
    const user = await this.userModel.create({
      ...input,
      email,
      username,
      password,
      isAdmin: input.isAdmin ?? false,
      isRecommended: input.isRecommended ?? false,
    });

    return this.toPublicUser(user);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }

  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      },
    );
  }

  async resetPasswordWithToken(tokenHash: string, newPassword: string) {
    const user = await this.userModel.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Reset link nije ispravan ili je istekao');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findPublicById(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return {
      ...this.toPublicUser(user),
      recipeCount: await this.recipeModel.countDocuments({ createdBy: user._id }),
      followingCount: Array.isArray(user.following) ? user.following.length : 0,
      followersCount: await this.userModel.countDocuments({ following: user._id }),
    };
  }

  async findPublicProfile(id: string, currentUserId?: string) {
    const [profile, viewer] = await Promise.all([
      this.findPublicById(id),
      currentUserId ? this.userModel.findById(currentUserId, { following: 1 }) : null,
    ]);

    return {
      ...profile,
      isFollowing: Boolean(
        viewer && Array.isArray(viewer.following)
          ? viewer.following.some((entry) => String(entry) === id)
          : false,
      ),
    };
  }

  async findPublicByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const users = await this.userModel.find({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async findAllPublic(input: FindUsersInput = {}) {
    const query = (input.query ?? '').trim();
    const page = this.normalizePage(input.page);
    const limit = this.normalizeLimit(input.limit);

    const filter = query
      ? {
          $or: [
            { firstName: { $regex: buildAccentInsensitivePattern(query), $options: 'i' } },
            { lastName: { $regex: buildAccentInsensitivePattern(query), $options: 'i' } },
            { username: { $regex: buildAccentInsensitivePattern(query), $options: 'i' } },
          ],
        }
      : {};

    const total = await this.userModel.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const userIds = users
      .map((user) => (user as User & { _id?: unknown })._id)
      .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);

    const recipeCounts = userIds.length
      ? await this.recipeModel.aggregate<{
          _id: Types.ObjectId;
          count: number;
        }>([
          { $match: { createdBy: { $in: userIds } } },
          { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        ])
      : [];

    const recipeCountByUser = new Map(
      recipeCounts.map((entry) => [String(entry._id), entry.count]),
    );

    const items = users.map((user) => ({
      ...this.toPublicUser(user),
      recipeCount: recipeCountByUser.get(String((user as User & { _id?: unknown })._id)) ?? 0,
    }));

    return {
      items,
      total,
      page: safePage,
      limit,
      totalPages,
      hasMore: safePage < totalPages,
      query,
    };
  }

  async getRecommendedUserIds() {
    const users = await this.userModel.find({ isRecommended: true }, { _id: 1 });
    return users.map((user) => String((user as User & { _id?: unknown })._id));
  }

  async getFollowerIds(userId: string) {
    const followers = await this.userModel.find(
      { following: new Types.ObjectId(userId) },
      { _id: 1 },
    );
    return followers.map((user) => String((user as User & { _id?: unknown })._id));
  }

  async getFollowingUserIds(userId: string) {
    const user = await this.userModel.findById(userId, { following: 1 });

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return (user.following ?? []).map((id) => String(id));
  }

  async getFollowingUsers(userId: string) {
    return this.findPublicByIds(await this.getFollowingUserIds(userId));
  }

  async getSavedRecipeIds(userId: string) {
    const user = await this.userModel.findById(userId, { savedRecipes: 1 });

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return (user.savedRecipes ?? []).map((id) => String(id));
  }

  async getUserIdsWithSavedRecipe(recipeId: string) {
    const users = await this.userModel.find(
      { savedRecipes: new Types.ObjectId(recipeId) },
      { _id: 1 },
    );
    return users.map((user) => String((user as User & { _id?: unknown })._id));
  }

  async toggleSavedRecipe(userId: string, recipeId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const exists = (user.savedRecipes ?? []).some((id) => String(id) === recipeId);

    if (exists) {
      if (Array.isArray(user.recipeCollections)) {
        for (const collection of user.recipeCollections) {
          collection.recipeIds = (collection.recipeIds ?? []).filter(
            (id) => String(id) !== recipeId,
          );
        }
        await user.save();
      }

      await this.userModel.updateOne(
        { _id: user._id },
        { $pull: { savedRecipes: new Types.ObjectId(recipeId) } },
      );
      return { saved: false };
    }

    await this.userModel.updateOne(
      { _id: user._id },
      { $addToSet: { savedRecipes: new Types.ObjectId(recipeId) } },
    );
    return { saved: true };
  }

  async updateOwnProfile(userId: string, input: UpdateOwnProfileInput) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const firstName = this.optionalTrim(input.firstName);
    const lastName = this.optionalTrim(input.lastName);
    const username = this.optionalTrim(input.username)?.toLowerCase();
    const email = this.optionalTrim(input.email)?.toLowerCase();
    const avatarUrl = this.normalizeAvatarUrl(input.avatarUrl);
    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';

    if (firstName !== undefined && firstName.length === 0) {
      throw new BadRequestException('Ime je obavezno');
    }

    if (lastName !== undefined && lastName.length === 0) {
      throw new BadRequestException('Prezime je obavezno');
    }

    if (username !== undefined && username.length === 0) {
      throw new BadRequestException('Korisnicko ime je obavezno');
    }

    if (email !== undefined) {
      if (email.length === 0) {
        throw new BadRequestException('Email je obavezan');
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new BadRequestException('Email nije ispravan');
      }
    }

    if (newPassword) {
      if (newPassword.length < 2) {
        throw new BadRequestException('Nova lozinka mora imati najmanje 2 karaktera');
      }

      const passwordMatches = await bcrypt.compare(currentPassword, user.password);

      if (!passwordMatches) {
        throw new UnauthorizedException('Trenutna lozinka nije ispravna');
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    if (email || username) {
      const duplicateConditions: Record<string, string>[] = [];

      if (email) duplicateConditions.push({ email });
      if (username) duplicateConditions.push({ username });

      const existingUser = await this.userModel.findOne({
        _id: { $ne: user._id },
        $or: duplicateConditions,
      });

      if (existingUser) {
        throw new ConflictException('Email ili korisnicko ime je vec u upotrebi');
      }
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (input.avatarUrl !== undefined) user.avatarUrl = avatarUrl ?? null;

    await user.save();
    return this.toPublicUser(user);
  }

  async toggleFollow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new ForbiddenException('Ne mozete pratiti sopstveni nalog');
    }

    const [currentUser, targetUser] = await Promise.all([
      this.userModel.findById(currentUserId),
      this.userModel.findById(targetUserId),
    ]);

    if (!currentUser || !targetUser) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const isFollowing = (currentUser.following ?? []).some((id) => String(id) === targetUserId);

    currentUser.following = isFollowing
      ? (currentUser.following ?? []).filter((id) => String(id) !== targetUserId)
      : [...(currentUser.following ?? []), new Types.ObjectId(targetUserId)];

    await currentUser.save();

    if (!isFollowing) {
      await this.notificationsService.notifyUserFollowed({
        userId: targetUserId,
        actorUserId: currentUserId,
      });
    }

    return {
      following: !isFollowing,
      user: await this.findPublicProfile(targetUserId, currentUserId),
    };
  }

  async getRecipeCollections(userId: string) {
    const user = await this.userModel.findById(userId, { recipeCollections: 1 });

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return (user.recipeCollections ?? []).map((collection) => this.toRecipeCollection(collection));
  }

  async createRecipeCollection(userId: string, name?: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const normalizedName = this.normalizeCollectionName(name);
    this.ensureUniqueCollectionName(user.recipeCollections ?? [], normalizedName);

    user.recipeCollections = [
      ...(user.recipeCollections ?? []),
      { name: normalizedName, recipeIds: [] } as User['recipeCollections'][number],
    ];

    await user.save();
    return this.toRecipeCollection(user.recipeCollections[user.recipeCollections.length - 1]);
  }

  async renameRecipeCollection(userId: string, collectionId: string, name?: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const collection = this.findCollectionOrThrow(user, collectionId);
    const normalizedName = this.normalizeCollectionName(name);
    this.ensureUniqueCollectionName(
      (user.recipeCollections ?? []).filter(
        (entry) => String((entry as { _id?: unknown })._id) !== collectionId,
      ),
      normalizedName,
    );
    collection.name = normalizedName;
    await user.save();
    return this.toRecipeCollection(collection);
  }

  async deleteRecipeCollection(userId: string, collectionId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const exists = (user.recipeCollections ?? []).some(
      (entry) => String((entry as { _id?: unknown })._id) === collectionId,
    );

    if (!exists) {
      throw new NotFoundException('Kolekcija nije pronadjena');
    }

    user.recipeCollections = (user.recipeCollections ?? []).filter(
      (entry) => String((entry as { _id?: unknown })._id) !== collectionId,
    );
    await user.save();
    return { success: true };
  }

  async addRecipeToCollection(userId: string, collectionId: string, recipeId: string) {
    const [user, recipe] = await Promise.all([
      this.userModel.findById(userId),
      this.recipeModel.findById(recipeId, { _id: 1 }),
    ]);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    if (!recipe) {
      throw new NotFoundException('Recept nije pronadjen');
    }

    const collection = this.findCollectionOrThrow(user, collectionId);
    const hasRecipe = (collection.recipeIds ?? []).some((id) => String(id) === recipeId);

    if (!hasRecipe) {
      collection.recipeIds = [...(collection.recipeIds ?? []), new Types.ObjectId(recipeId)];
    }

    if (!(user.savedRecipes ?? []).some((id) => String(id) === recipeId)) {
      user.savedRecipes = [...(user.savedRecipes ?? []), new Types.ObjectId(recipeId)];
    }

    await user.save();
    return this.toRecipeCollection(collection);
  }

  async removeRecipeFromCollection(userId: string, collectionId: string, recipeId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const collection = this.findCollectionOrThrow(user, collectionId);
    collection.recipeIds = (collection.recipeIds ?? []).filter((id) => String(id) !== recipeId);
    await user.save();
    return this.toRecipeCollection(collection);
  }

  async getActivityFeed(userId: string, limit = 40) {
    const followedUserIds = await this.getFollowingUserIds(userId);

    if (followedUserIds.length === 0) {
      return [];
    }

    const followedSet = new Set(followedUserIds);
    const followedObjectIds = followedUserIds.map((id) => new Types.ObjectId(id));
    const recipes = await this.recipeModel.find({
      $or: [
        { createdBy: { $in: followedObjectIds } },
        { 'ratings.userId': { $in: followedObjectIds } },
        { 'comments.userId': { $in: followedObjectIds } },
      ],
    });

    const items = recipes.flatMap((recipe) => {
      const recipeId = String((recipe as Recipe & { _id?: unknown })._id);
      const recipeTitle = recipe.title;
      const events: ActivityFeedItem[] = [];

      if (followedSet.has(String(recipe.createdBy))) {
        const createdAt = (recipe as Recipe & { createdAt?: Date }).createdAt;
        events.push({
          id: `recipe:${recipeId}`,
          type: 'recipe_created',
          createdAt: (createdAt ?? new Date()).toISOString(),
          actor: { id: String(recipe.createdBy) },
          recipe: { id: recipeId, title: recipeTitle },
        });
      }

      for (const rating of (recipe.ratings ?? []) as Array<{
        userId: Types.ObjectId;
        value: number;
        createdAt?: Date;
      }>) {
        if (!followedSet.has(String(rating.userId))) {
          continue;
        }

        events.push({
          id: `rating:${recipeId}:${String(rating.userId)}`,
          type: 'recipe_rated',
          createdAt: (rating.createdAt ?? (recipe as Recipe & { updatedAt?: Date }).updatedAt ?? new Date()).toISOString(),
          actor: { id: String(rating.userId) },
          recipe: { id: recipeId, title: recipeTitle },
          ratingValue: rating.value,
        });
      }

      for (const comment of (recipe.comments ?? []) as Array<{
        _id?: Types.ObjectId;
        userId: Types.ObjectId;
        text: string;
        createdAt?: Date;
      }>) {
        if (!followedSet.has(String(comment.userId))) {
          continue;
        }

        events.push({
          id: `comment:${recipeId}:${String(comment._id ?? comment.userId)}`,
          type: 'recipe_commented',
          createdAt: (comment.createdAt ?? new Date()).toISOString(),
          actor: { id: String(comment.userId) },
          recipe: { id: recipeId, title: recipeTitle },
          commentText: comment.text,
        });
      }

      return events;
    });

    const sorted = items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(100, Math.floor(limit))));

    return this.attachActors(sorted);
  }

  async getNotifications(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.notificationsService.findByUser(userId),
      this.notificationsService.getUnreadCount(userId),
    ]);

    return {
      items: await this.attachActors(
        items.map((item) => ({
          id: String((item as { _id?: unknown })._id),
          type: item.type,
          createdAt: ((item as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
          isRead: Boolean(item.isRead),
          actor: { id: String(item.actorUserId) },
          ...(item.recipeId ? { recipe: { id: String(item.recipeId), title: item.recipeTitle } } : {}),
          ...(item.commentText ? { commentText: item.commentText } : {}),
          ...(typeof item.ratingValue === 'number' ? { ratingValue: item.ratingValue } : {}),
        })),
      ),
      unreadCount,
    };
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationsService.markAsRead(notificationId, userId);

    if (!notification) {
      throw new NotFoundException('Obavestenje nije pronadjeno');
    }

    const [item] = await this.attachActors([
      {
        id: String((notification as { _id?: unknown })._id),
        type: notification.type,
        createdAt: ((notification as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
        isRead: Boolean(notification.isRead),
        actor: { id: String(notification.actorUserId) },
        ...(notification.recipeId
          ? { recipe: { id: String(notification.recipeId), title: notification.recipeTitle } }
          : {}),
        ...(notification.commentText ? { commentText: notification.commentText } : {}),
        ...(typeof notification.ratingValue === 'number'
          ? { ratingValue: notification.ratingValue }
          : {}),
      },
    ]);

    return item;
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  async setAdminStatus(targetUserId: string, actorUserId: string, isAdmin: boolean) {
    if (targetUserId === actorUserId) {
      throw new ForbiddenException('Admin ne moze menjati sopstveni admin status');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      targetUserId,
      { isAdmin },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return {
      ...this.toPublicUser(updatedUser),
      recipeCount: await this.recipeModel.countDocuments({ createdBy: updatedUser._id }),
    };
  }

  async setRecommendationStatus(targetUserId: string, actorUserId: string, isRecommended: boolean) {
    if (targetUserId === actorUserId) {
      throw new ForbiddenException('Admin ne moze preporuciti sopstveni nalog');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      targetUserId,
      { isRecommended },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    await this.recipeModel.updateMany(
      { createdBy: updatedUser._id },
      { $set: { postedByRecommendedUser: isRecommended } },
    );

    return {
      ...this.toPublicUser(updatedUser),
      recipeCount: await this.recipeModel.countDocuments({ createdBy: updatedUser._id }),
    };
  }

  toPublicUser(user: User & { _id?: unknown }) {
    return {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isRecommended: user.isRecommended ?? false,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  private async seedUsers() {
    await this.ensureSeedUser({
      firstName: 'Dragan',
      lastName: 'Papic',
      username: 'dragan.papic1996',
      email: 'dragan.papic1996@gmail.com',
      password: '12',
      isAdmin: true,
    });

    await this.ensureSeedUser({
      firstName: 'Test',
      lastName: 'Korisnik',
      username: 'test.korisnik',
      email: 'a@a.a',
      password: '12',
      isAdmin: false,
    });
  }

  private async ensureSeedUser(input: CreateUserInput) {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: input.email }, { username: input.username }],
    });

    if (!existingUser) {
      await this.create(input);
    }
  }

  private optionalTrim(value?: string) {
    return typeof value === 'string' ? value.trim() : undefined;
  }

  private normalizeAvatarUrl(value?: string) {
    const trimmed = this.optionalTrim(value);

    if (trimmed === undefined) {
      return undefined;
    }

    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported');
      }
      return parsed.toString();
    } catch {
      throw new BadRequestException('Avatar URL nije ispravan');
    }
  }

  private normalizeCollectionName(name?: string) {
    const value = this.optionalTrim(name);

    if (!value) {
      throw new BadRequestException('Naziv kolekcije je obavezan');
    }

    if (value.length > 80) {
      throw new BadRequestException('Naziv kolekcije moze imati najvise 80 karaktera');
    }

    return value;
  }

  private ensureUniqueCollectionName(
    collections: Array<{ name?: string }> = [],
    candidateName: string,
  ) {
    const normalizedCandidate = candidateName.toLocaleLowerCase();
    const duplicate = collections.some(
      (collection) => collection.name?.trim().toLocaleLowerCase() === normalizedCandidate,
    );

    if (duplicate) {
      throw new ConflictException('Kolekcija sa ovim nazivom vec postoji');
    }
  }

  private findCollectionOrThrow(user: User, collectionId: string) {
    const collection = (user.recipeCollections ?? []).find(
      (entry) => String((entry as { _id?: unknown })._id) === collectionId,
    );

    if (!collection) {
      throw new NotFoundException('Kolekcija nije pronadjena');
    }

    return collection;
  }

  private toRecipeCollection(collection: {
    _id?: unknown;
    name: string;
    recipeIds?: Types.ObjectId[];
  }): RecipeCollectionOutput {
    return {
      id: String(collection._id),
      name: collection.name,
      recipeIds: (collection.recipeIds ?? []).map((id) => String(id)),
    };
  }

  private async attachActors<
    T extends {
      actor: { id: string };
    },
  >(items: T[]) {
    const actors = await this.findPublicByIds(Array.from(new Set(items.map((item) => item.actor.id))));
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    return items.map((item) => ({
      ...item,
      actor:
        actorMap.get(item.actor.id) ?? {
          id: item.actor.id,
          firstName: 'Nepoznat',
          lastName: '',
          username: 'korisnik',
          email: '',
          isAdmin: false,
          isRecommended: false,
          avatarUrl: null,
        },
    }));
  }

  private normalizePage(page?: number) {
    if (!Number.isFinite(page)) {
      return 1;
    }

    return Math.max(1, Math.floor(page ?? 1));
  }

  private normalizeLimit(limit?: number) {
    if (!Number.isFinite(limit)) {
      return 10;
    }

    return Math.min(50, Math.max(1, Math.floor(limit ?? 10)));
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
