import {
  Schema,
  model,
  type InferSchemaType,
  type Model,
  type HydratedDocument,
} from "mongoose";

// Single source of truth for the enquiry lifecycle — shared by the model enum
// and the Zod request schemas (mirrors ENROLLMENT_STATUSES on Enrollment).
export const ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const;

const enquirySchema = new Schema(
  {
    // Optional — a center enquiry sets this; a teacher-targeted enquiry does not.
    coachingCenter: {
      type: Schema.Types.ObjectId,
      ref: "CoachingCenter",
    },
    // Optional — a teacher-targeted enquiry sets this. Powers the teacher
    // dashboard's "recent enquiries". A center enquiry leaves it unset.
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher" },
    // Phase 1 requires login — anonymous enquiries are out of scope.
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subject: { type: Schema.Types.ObjectId, ref: "Subject" },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ENQUIRY_STATUSES,
      default: "new",
    },
    ownerNotes: { type: String, trim: true }, // private — only center owner sees
  },
  { timestamps: true },
);

enquirySchema.index({ student: 1 });
enquirySchema.index({ coachingCenter: 1, status: 1 });
// Teacher dashboard "recent enquiries" scan, newest-first.
enquirySchema.index({ teacher: 1, status: 1 });

export type EnquiryAttrs = InferSchemaType<typeof enquirySchema>;
export type EnquiryDoc = HydratedDocument<EnquiryAttrs>;
export type EnquiryModel = Model<EnquiryAttrs>;

const Enquiry: EnquiryModel = model<EnquiryAttrs>("Enquiry", enquirySchema);
export default Enquiry;
