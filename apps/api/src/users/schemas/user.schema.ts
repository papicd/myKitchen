import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: true })
export class RecipeCollection {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Recipe' }], default: [] })
  recipeIds: Types.ObjectId[];
}

export const RecipeCollectionSchema = SchemaFactory.createForClass(RecipeCollection);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, default: null })
  passwordResetTokenHash: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt: Date | null;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ default: false })
  isRecommended: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Recipe' }], default: [] })
  savedRecipes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  following: Types.ObjectId[];

  @Prop({ type: [RecipeCollectionSchema], default: [] })
  recipeCollections: RecipeCollection[];

  @Prop({ type: String, default: null })
  avatarUrl: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
