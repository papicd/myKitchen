import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RecipeTypeDocument = HydratedDocument<RecipeType>;

@Schema({ timestamps: true })
export class RecipeType {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ required: true, trim: true, minlength: 4, maxlength: 7 })
  color: string;
}

export const RecipeTypeSchema = SchemaFactory.createForClass(RecipeType);

