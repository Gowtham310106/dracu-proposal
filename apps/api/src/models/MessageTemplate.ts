import { Schema, model, type InferSchemaType } from 'mongoose';
import { LANGUAGES, MESSAGE_TYPES } from '@acuheal/types';

const messageTemplateSchema = new Schema(
  {
    type: { type: String, enum: MESSAGE_TYPES, required: true, index: true },
    name: { type: String, required: true },
    language: { type: String, enum: LANGUAGES, default: 'English' },
    body: { type: String, required: true },
    active: { type: Boolean, default: true },
    sendOffsetHours: { type: Number, default: 24 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);

export type MessageTemplateDoc = InferSchemaType<typeof messageTemplateSchema> & { _id: Schema.Types.ObjectId };
export const MessageTemplate = model('MessageTemplate', messageTemplateSchema);
