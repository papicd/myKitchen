import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RecipeDocument = HydratedDocument<Recipe>;

@Schema({ timestamps: true })
export class Recipe {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  shortDescription: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  ingredients: string[];

  @Prop({ type: [String], default: [] })
  steps: string[];

  @Prop({ required: true })
  preparationTime: string;

  @Prop({ required: true })
  servings: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'RecipeType' }], default: [] })
  typeIds: Types.ObjectId[];

  @Prop({
    type: [
      {
        type: { type: String, enum: ['image', 'video', 'pdf'], required: true },
        url: { type: String, required: true },
      },
    ],
    default: [],
  })
  media?: Array<{ type: 'image' | 'video' | 'pdf'; url: string }>;

  @Prop({
    type: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    default: [],
  })
  links?: Array<{ label: string; url: string }>;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        value: { type: Number, min: 1, max: 5, required: true },
      },
    ],
    default: [],
  })
  ratings?: Array<{ userId: Types.ObjectId; value: number }>;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  comments?: Array<{
    _id?: Types.ObjectId;
    userId: Types.ObjectId;
    text: string;
    createdAt?: Date;
  }>;

  @Prop({ default: false })
  postedByRecommendedUser: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const RecipeSchema = SchemaFactory.createForClass(Recipe);
