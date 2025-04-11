import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { UserDocument } from '../../users/schemas/user.schema';

export type PetDocument = Pet & Document;

@Schema({ timestamps: true })
export class Pet {
  @Prop({ required: true })
  name: string;

  @Prop()
  species: string;

  @Prop()
  breed: string;

  @Prop()
  age: number;

  @Prop()
  weight: number;

  @Prop()
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  owner: UserDocument;
}

export const PetSchema = SchemaFactory.createForClass(Pet);
