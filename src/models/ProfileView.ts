import { Schema, model, type InferSchemaType, type Model, type HydratedDocument } from 'mongoose';

// One document per coaching-center profile view. The dashboard aggregates these
// into weekly totals and a per-day graph series, so we keep raw events (no
// dedupe) rather than a single counter — a counter can't produce daily buckets.
const profileViewSchema = new Schema(
  {
    coachingCenter: {
      type: Schema.Types.ObjectId,
      ref: 'CoachingCenter',
      required: true,
    },
    // Optional — anonymous views are allowed.
    viewer: { type: Schema.Types.ObjectId, ref: 'Student' },
    viewedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// Powers the dashboard 7-day window scan, newest-first.
profileViewSchema.index({ coachingCenter: 1, viewedAt: -1 });

export type ProfileViewAttrs = InferSchemaType<typeof profileViewSchema>;
export type ProfileViewDoc = HydratedDocument<ProfileViewAttrs>;
export type ProfileViewModel = Model<ProfileViewAttrs>;

const ProfileView: ProfileViewModel = model<ProfileViewAttrs>('ProfileView', profileViewSchema);
export default ProfileView;
