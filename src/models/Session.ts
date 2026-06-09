import { Schema, model, type InferSchemaType, type Model, type HydratedDocument } from 'mongoose';

// Single source of truth for the session lifecycle — shared by the model enum
// and the Zod request schemas (mirrors ENROLLMENT_STATUSES / ENQUIRY_STATUSES).
export const SESSION_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;

// A teacher's scheduled class/session. Powers the teacher dashboard
// "today's sessions" count (sessions whose scheduledAt falls on today).
const sessionSchema = new Schema(
  {
    // Host teacher — taken from the token on create, never the body.
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    coachingCenter: { type: Schema.Types.ObjectId, ref: 'CoachingCenter' },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
    student: { type: Schema.Types.ObjectId, ref: 'Student' },
    title: { type: String, trim: true },
    scheduledAt: { type: Date, required: [true, 'scheduledAt is required'] },
    durationMinutes: { type: Number, min: 0 },
    status: { type: String, enum: SESSION_STATUSES, default: 'scheduled' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Dashboard "today" scan + per-teacher listings; status filter.
sessionSchema.index({ teacher: 1, scheduledAt: 1 });
sessionSchema.index({ teacher: 1, status: 1 });

export type SessionAttrs = InferSchemaType<typeof sessionSchema>;
export type SessionDoc = HydratedDocument<SessionAttrs>;
export type SessionModel = Model<SessionAttrs>;

const Session: SessionModel = model<SessionAttrs>('Session', sessionSchema);
export default Session;
