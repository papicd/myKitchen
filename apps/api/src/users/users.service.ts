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
import { Recipe } from '../recipes/schemas/recipe.schema';
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
  currentPassword?: string;
  newPassword?: string;
};

export type FindUsersInput = {
  query?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Recipe.name) private readonly recipeModel: Model<Recipe>,
  ) {}

  async onApplicationBootstrap() {
    await this.userModel.updateMany(
      { isRecommended: { $exists: false } },
      { $set: { isRecommended: false } },
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
            { firstName: { $regex: this.escapeRegExp(query), $options: 'i' } },
            { lastName: { $regex: this.escapeRegExp(query), $options: 'i' } },
            { username: { $regex: this.escapeRegExp(query), $options: 'i' } },
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

  async getSavedRecipeIds(userId: string) {
    const user = await this.userModel.findById(userId, { savedRecipes: 1 });

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    return (user.savedRecipes ?? []).map((id) => String(id));
  }

  async toggleSavedRecipe(userId: string, recipeId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Korisnik nije pronadjen');
    }

    const exists = (user.savedRecipes ?? []).some((id) => String(id) === recipeId);

    if (exists) {
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

    await user.save();
    return this.toPublicUser(user);
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
