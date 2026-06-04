import { Schema, model, type InferSchemaType, type Model, type HydratedDocument } from 'mongoose';

export const ENROLLMENT_STATUSES = ['active', 'completed', 'cancelled', 'expired'] as const;

// Links a student to a coaching center with a lifecycle status. "Active students"
// on the dashboard = distinct students whose enrollment status is 'active'.
const enrollmentSchema = new Schema(
  {
    coachingCenter: {
      type: Schema.Types.ObjectId,
      ref: 'CoachingCenter',
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    status: {
      type: String,
      enum: ENROLLMENT_STATUSES,
      default: 'active',
    },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
    enrolledAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

// Not unique — a student may re-enroll after a prior enrollment ends, so we keep
// history. The dashboard de-duplicates via $addToSet on student.
enrollmentSchema.index({ coachingCenter: 1, status: 1, student: 1 });

export type EnrollmentAttrs = InferSchemaType<typeof enrollmentSchema>;
export type EnrollmentDoc = HydratedDocument<EnrollmentAttrs>;
export type EnrollmentModel = Model<EnrollmentAttrs>;

const Enrollment: EnrollmentModel = model<EnrollmentAttrs>('Enrollment', enrollmentSchema);
export default Enrollment;
