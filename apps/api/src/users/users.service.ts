import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

  async findAllPublic() {
    const users = await this.userModel.find().sort({ createdAt: 1 });
    const recipeCounts = await this.recipeModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]);
    const recipeCountByUser = new Map(
      recipeCounts.map((entry) => [String(entry._id), entry.count]),
    );

    return users.map((user) => ({
      ...this.toPublicUser(user),
      recipeCount: recipeCountByUser.get(String((user as User & { _id?: unknown })._id)) ?? 0,
    }));
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
}
