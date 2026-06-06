import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Enquiry, { ENQUIRY_STATUSES } from '../models/Enquiry.js';
import logger from '../lib/logger.js';

// Standalone enquiry seeder. Reads the centers / students / subjects already in
// the DB (run `npm run seed:demo` first if the DB is empty) and inserts a varied
// set of enquiries that exercises every enquiry filter/search field:
//   - all three statuses (new / contacted / closed)
//   - ownerNotes present on the non-'new' ones (owner-only search by notes)
//   - createdAt spread across the last ~10 days (date-range search)
//   - keyword-rich messages + with/without a subject (q + subject search)
//   - multiple students per center (owner search by student id/name/email)
//
// It WIPES the enquiries collection first so the result is deterministic.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Rotating message templates — keyword-rich so `?q=` search has real hits.
const MESSAGES = [
  'Hi, I want to know the fees and batch timing for {subj}.',
  'Is a free demo class available for {subj}? Please share details.',
  'My child is in class 10 and needs help with {subj}. Are seats open?',
  'Please share the weekend batch schedule for {subj}.',
  'Do you provide doubt-clearing sessions for {subj} before board exams?',
];

async function main(): Promise<void> {
  await connectDB();
  try {
    const [centers, students, subjects] = await Promise.all([
      CoachingCenter.find({ isActive: true }).select('_id name').lean(),
      Student.find({ isActive: true }).select('_id name email').lean(),
      Subject.find({ isActive: true }).select('_id name').lean(),
    ]);

    if (centers.length === 0 || students.length === 0) {
      logger.warn(
        { centers: centers.length, students: students.length },
        'need at least one active center and student — run `npm run seed:demo` first',
      );
      return;
    }

    const now = Date.now();
    const subjName = (i: number) => (subjects.length ? subjects[i % subjects.length]!.name : 'your courses');

    // Build a spread: for each center, 3 enquiries from distinct students with
    // different statuses, subjects and ages — so every center (hence every owner
    // dashboard) has searchable data, with extra variety on the first center.
    type EnquiryDoc = {
      coachingCenter: mongoose.Types.ObjectId;
      student: mongoose.Types.ObjectId;
      subject?: mongoose.Types.ObjectId;
      message: string;
      status: (typeof ENQUIRY_STATUSES)[number];
      ownerNotes?: string;
      createdAt: Date;
      updatedAt: Date;
    };

    const docs: EnquiryDoc[] = [];
    let n = 0;
    for (let ci = 0; ci < centers.length; ci++) {
      for (let k = 0; k < 3; k++) {
        const status = ENQUIRY_STATUSES[n % ENQUIRY_STATUSES.length]!;
        const student = students[(ci + k) % students.length]!;
        const subject = subjects.length ? subjects[(ci + k) % subjects.length]! : undefined;
        const withSubject = (ci + k) % 4 !== 0; // ~75% carry a subject ref
        const createdAt = new Date(now - (n % 10) * DAY - (n % 5) * HOUR);
        docs.push({
          coachingCenter: centers[ci]!._id as mongoose.Types.ObjectId,
          student: student._id as mongoose.Types.ObjectId,
          ...(withSubject && subject
            ? { subject: subject._id as mongoose.Types.ObjectId }
            : {}),
          message: MESSAGES[n % MESSAGES.length]!.replace('{subj}', subjName(ci + k)),
          status,
          // Owners have followed up on the non-'new' ones.
          ...(status === 'new'
            ? {}
            : { ownerNotes: `Spoke with ${student.name} — marked ${status}.` }),
          createdAt,
          updatedAt: createdAt,
        });
        n++;
      }
    }

    const removed = await Enquiry.deleteMany({});
    // timestamps:false so our spread createdAt values are kept (not overwritten).
    const inserted = await Enquiry.insertMany(docs, { timestamps: false });

    logger.info(
      {
        removed: removed.deletedCount ?? 0,
        inserted: inserted.length,
        centers: centers.length,
        students: students.length,
        statuses: ENQUIRY_STATUSES,
      },
      'enquiries seeded',
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'enquiry seed failed');
  process.exit(1);
});
