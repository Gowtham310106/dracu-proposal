import { Schema, model, type InferSchemaType } from 'mongoose';

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    summary: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { _id: Schema.Types.ObjectId };
export const AuditLog = model('AuditLog', auditLogSchema);
