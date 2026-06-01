import {
  Schema,
  model,
  type InferSchemaType,
  type Model,
  type HydratedDocument,
} from 'mongoose';

// Polymorphic bookmark — a student saves a Teacher, Webinar, or CoachingCenter.
// `targetType` is the discriminator; `target` resolves to the matching collection
// via Mongoose `refPath` on populate.
const TARGET_TYPES = ['Teacher', 'Webinar', 'CoachingCenter'] as const;

const studentBookmarkSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    targetType: { type: String, enum: TARGET_TYPES, required: true },
    target: { type: Schema.Types.ObjectId, refPath: 'targetType', required: true },
  },
  { timestamps: true }
);

// One bookmark per student per item.
studentBookmarkSchema.index({ student: 1, targetType: 1, target: 1 }, { unique: true });
// Fast "my bookmarks, newest first".
studentBookmarkSchema.index({ student: 1, createdAt: -1 });

export type StudentBookmarkAttrs = InferSchemaType<typeof studentBookmarkSchema>;
export type StudentBookmarkDoc = HydratedDocument<StudentBookmarkAttrs>;
export type StudentBookmarkModel = Model<StudentBookmarkAttrs>;

const StudentBookmark = model<StudentBookmarkAttrs>('StudentBookmark', studentBookmarkSchema);
export default StudentBookmark;
