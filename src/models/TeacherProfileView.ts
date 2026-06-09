import { Schema, model, type InferSchemaType, type Model, type HydratedDocument } from 'mongoose';

// One document per teacher-profile view. Mirrors ProfileView (which tracks
// coaching-center views) — the repo keeps parallel per-entity models (cf.
// TeacherReview vs CoachingCenterReview). Powers the teacher dashboard's total
// profile-view count. Raw events, no dedupe.
const teacherProfileViewSchema = new Schema(
  {
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    // Polymorphic viewer — students and coaching-center owners/admins may record
    // a view. refPath resolves to the right collection on populate (same pattern
    // as StudentBookmark / ProfileView.viewer).
    viewerType: { type: String, enum: ['Student', 'Owner', 'Admin'], required: true },
    viewer: { type: Schema.Types.ObjectId, refPath: 'viewerType', required: true },
    viewedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// Newest-first scan per teacher.
teacherProfileViewSchema.index({ teacher: 1, viewedAt: -1 });

export type TeacherProfileViewAttrs = InferSchemaType<typeof teacherProfileViewSchema>;
export type TeacherProfileViewDoc = HydratedDocument<TeacherProfileViewAttrs>;
export type TeacherProfileViewModel = Model<TeacherProfileViewAttrs>;

const TeacherProfileView: TeacherProfileViewModel = model<TeacherProfileViewAttrs>(
  'TeacherProfileView',
  teacherProfileViewSchema,
);
export default TeacherProfileView;
