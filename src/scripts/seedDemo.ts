import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import logger from '../lib/logger.js';

import Subject from '../models/Subject.js';
import Admin from '../models/Admin.js';
import Owner from '../models/Owner.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Webinar from '../models/Webinar.js';
import TeacherReview from '../models/TeacherReview.js';
import CoachingCenterReview from '../models/CoachingCenterReview.js';
import StudentBookmark from '../models/StudentBookmark.js';
import Enquiry from '../models/Enquiry.js';

// Comprehensive demo seeder. Wipes the seeded collections and inserts a fresh,
// coherent, fully-linked dataset so EVERY API returns real data (auth, profiles,
// subjects, search, dashboard, webinars, reviews, bookmarks, enquiries).
//
// Constraints honoured (see model files):
//  - Password models (Owner/Teacher/Student/Admin) MUST go through .save() so the
//    bcrypt pre-save hook fires — never insertMany. We use `new Model({...}).save()`
//    (reliable hydrated-doc return type, unlike Mongoose v9's array .create overload).
//  - Slugs (CoachingCenter/Subject) auto-generate in pre-validate — never set manually.
//  - Review post-save hooks denormalise averageRating/totalReviews onto Teacher/Center,
//    so reviews are created AFTER teachers/centers exist.
//  - GeoJSON coordinates are [longitude, latitude].

const PASSWORD = 'Password123';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const BOARDS = ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'Other'] as const;
type Board = (typeof BOARDS)[number];

// [lng, lat] per city (GeoJSON order).
const CITY_GEO: Record<string, [number, number]> = {
  Kolkata: [88.3639, 22.5726],
  Mumbai: [72.8777, 19.076],
  Delhi: [77.209, 28.6139],
  Bangalore: [77.5946, 12.9716],
};
const CITY_STATE: Record<string, string> = {
  Kolkata: 'West Bengal',
  Mumbai: 'Maharashtra',
  Delhi: 'Delhi',
  Bangalore: 'Karnataka',
};
const point = (city: string) => ({ type: 'Point' as const, coordinates: CITY_GEO[city]! });

async function wipe(): Promise<void> {
  await Promise.all([
    Subject.deleteMany({}),
    Admin.deleteMany({}),
    Owner.deleteMany({}),
    Teacher.deleteMany({}),
    Student.deleteMany({}),
    CoachingCenter.deleteMany({}),
    Webinar.deleteMany({}),
    TeacherReview.deleteMany({}),
    CoachingCenterReview.deleteMany({}),
    StudentBookmark.deleteMany({}),
    Enquiry.deleteMany({}),
  ]);
}

async function main(): Promise<void> {
  await connectDB();
  try {
    await wipe();

    // 1. Subjects -------------------------------------------------------------
    const subjectSeed = [
      { name: 'Mathematics', category: 'Science' },
      { name: 'Physics', category: 'Science' },
      { name: 'Chemistry', category: 'Science' },
      { name: 'Biology', category: 'Science' },
      { name: 'English', category: 'Languages' },
      { name: 'Computer Science', category: 'Technology' },
      { name: 'Economics', category: 'Commerce' },
      { name: 'Accountancy', category: 'Commerce' },
      { name: 'History', category: 'Humanities' },
      { name: 'Geography', category: 'Humanities' },
      { name: 'Hindi', category: 'Languages' },
      { name: 'Political Science', category: 'Humanities' },
    ];
    const subjects = await Promise.all(subjectSeed.map((s) => new Subject(s).save()));
    const subj = Object.fromEntries(subjects.map((s) => [s.name, s._id])) as Record<
      string,
      mongoose.Types.ObjectId
    >;

    // 2. Admin ----------------------------------------------------------------
    await new Admin({
      name: 'Demo Admin',
      email: 'admin@demo.com',
      password: PASSWORD,
      phone: '+91-9000000000',
      isEmailVerified: true,
    }).save();

    // 3. Owners ---------------------------------------------------------------
    const owners = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        new Owner({
          name: `Owner ${i + 1}`,
          email: `owner${i + 1}@demo.com`,
          password: PASSWORD,
          phone: `+91-900000010${i}`,
          isEmailVerified: true,
        }).save(),
      ),
    );

    // 4. Teachers -------------------------------------------------------------
    const cities = ['Kolkata', 'Mumbai', 'Delhi', 'Bangalore'];
    const teacherSeed: Array<{ name: string; subs: string[]; boards: Board[]; fees: [number, number] }> = [
      { name: 'Anita Sharma', subs: ['Mathematics', 'Physics'], boards: ['CBSE', 'ICSE'], fees: [500, 1200] },
      { name: 'Rahul Verma', subs: ['Physics', 'Chemistry'], boards: ['CBSE'], fees: [600, 1500] },
      { name: 'Priya Das', subs: ['Chemistry', 'Biology'], boards: ['ICSE', 'State'], fees: [400, 900] },
      { name: 'Sandeep Rao', subs: ['Mathematics', 'Computer Science'], boards: ['CBSE', 'IB'], fees: [800, 2000] },
      { name: 'Meera Nair', subs: ['English', 'History'], boards: ['IGCSE', 'CBSE'], fees: [350, 800] },
      { name: 'Vikram Singh', subs: ['Economics', 'Accountancy'], boards: ['CBSE', 'State'], fees: [700, 1600] },
      { name: 'Sunita Gupta', subs: ['Biology', 'Chemistry'], boards: ['ICSE'], fees: [550, 1100] },
      { name: 'Arjun Mehta', subs: ['Computer Science', 'Mathematics'], boards: ['IB', 'IGCSE'], fees: [900, 2200] },
    ];
    const teachers = await Promise.all(
      teacherSeed.map((t, i) => {
        const city = cities[i % cities.length]!;
        return new Teacher({
          name: t.name,
          email: `teacher${i + 1}@demo.com`,
          password: PASSWORD,
          phone: `+91-980000001${i}`,
          isEmailVerified: true,
          isVerified: i % 2 === 0,
          bio: `${t.subs.join(' & ')} tutor with a focus on conceptual clarity.`,
          description: `Experienced ${t.subs[0]} educator helping students across ${city}.`,
          subjects: t.subs.map((s) => subj[s]!),
          education: [{ degree: 'M.Sc', institution: `${city} University`, year: 2010 + i, field: t.subs[0] }],
          experienceYears: 3 + i,
          feesRange: { min: t.fees[0], max: t.fees[1], currency: 'INR' },
          batches: [
            { name: 'Morning Batch', days: ['Mon', 'Wed', 'Fri'], startTime: '08:00', endTime: '09:30', capacity: 20 },
          ],
          languages: ['English', 'Hindi'],
          boards: t.boards,
          classRange: { from: 6, to: 12 },
          location: point(city),
          city,
          state: CITY_STATE[city]!,
        }).save();
      }),
    );

    // 5. Students -------------------------------------------------------------
    const genders = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
    const students = await Promise.all(
      Array.from({ length: 10 }, (_, i) => {
        const city = cities[i % cities.length]!;
        return new Student({
          name: `Student ${i + 1}`,
          email: `student${i + 1}@demo.com`,
          password: PASSWORD,
          phone: `+91-970000001${i}`,
          isEmailVerified: true,
          gender: genders[i % genders.length],
          currentClass: 6 + (i % 7),
          board: BOARDS[i % BOARDS.length],
          city,
          location: point(city),
          dateOfBirth: new Date(2008 - (i % 5), i % 12, (i % 27) + 1),
        }).save();
      }),
    );

    // 6. Coaching centers -----------------------------------------------------
    const centerSeed: Array<{ name: string; city: string; area: string; subs: string[]; boards: Board[]; fees: [number, number] }> = [
      { name: 'Bright Future Academy', city: 'Kolkata', area: 'Salt Lake', subs: ['Mathematics', 'Physics', 'Chemistry'], boards: ['CBSE', 'ICSE'], fees: [1000, 3000] },
      { name: 'Apex Learning Center', city: 'Mumbai', area: 'Andheri', subs: ['Physics', 'Chemistry', 'Biology'], boards: ['CBSE'], fees: [1500, 4000] },
      { name: 'Genius Minds Institute', city: 'Delhi', area: 'Rohini', subs: ['Mathematics', 'Computer Science'], boards: ['CBSE', 'IB'], fees: [2000, 5000] },
      { name: 'Scholars Point', city: 'Bangalore', area: 'Whitefield', subs: ['English', 'Economics', 'Accountancy'], boards: ['IGCSE', 'CBSE'], fees: [1200, 3500] },
      { name: 'Eduwave Coaching', city: 'Kolkata', area: 'Salt Lake', subs: ['Biology', 'Chemistry', 'English'], boards: ['ICSE', 'State'], fees: [800, 2500] },
    ];
    const centers = await Promise.all(
      centerSeed.map((c, i) => {
        const slugBase = c.name.toLowerCase().replace(/[^a-z]+/g, '');
        return new CoachingCenter({
          name: c.name,
          description: `${c.name} — quality coaching for ${c.subs.join(', ')} in ${c.city}.`,
          owner: owners[i % owners.length]!._id,
          address: `${10 + i} Main Road`,
          location: point(c.city),
          area: c.area,
          city: c.city,
          state: CITY_STATE[c.city]!,
          pincode: `7000${i}${i}`,
          phone: `+91-334000001${i}`,
          email: `info@${slugBase}.com`,
          website: `https://${slugBase}.example.com`,
          subjectsOffered: c.subs.map((s) => subj[s]!),
          boards: c.boards,
          classRange: { from: 5, to: 12 },
          fees: { min: c.fees[0], max: c.fees[1], currency: 'INR' },
          timings: [
            { day: 'Mon', openTime: '09:00', closeTime: '19:00', closed: false },
            { day: 'Sun', openTime: '00:00', closeTime: '00:00', closed: true },
          ],
          isVerified: i % 2 === 0,
        }).save();
      }),
    );

    // 7. Webinars -------------------------------------------------------------
    const now = Date.now();
    const webinarSeed = [
      { title: 'Physics Crash Course: Mechanics', off: 6 * HOUR, status: 'scheduled', dur: 60 },
      { title: 'Mathematics: Mastering Trigonometry', off: 30 * HOUR, status: 'scheduled', dur: 90 },
      { title: 'Chemistry Doubt-Clearing Live', off: 2 * DAY + 2 * HOUR, status: 'scheduled', dur: 75 },
      { title: 'Biology: Genetics Deep Dive', off: 4 * DAY, status: 'scheduled', dur: 60 },
      { title: 'English Grammar Bootcamp', off: 6 * DAY, status: 'scheduled', dur: 45 },
      { title: 'Computer Science: Intro to Algorithms', off: 8 * DAY, status: 'scheduled', dur: 120 },
      { title: 'Economics: Microeconomics Basics', off: 10 * DAY, status: 'scheduled', dur: 60 },
      { title: 'Board Exam Strategy Session', off: 14 * DAY, status: 'scheduled', dur: 50 },
      { title: 'Physics: Past Paper Walkthrough', off: -3 * DAY, status: 'completed', dur: 90 },
      { title: 'Mathematics: Algebra Recap', off: -7 * DAY, status: 'completed', dur: 60 },
    ] as const;
    const webinars = await Promise.all(
      webinarSeed.map((w, i) =>
        new Webinar({
          title: w.title,
          teacher: teachers[i % teachers.length]!._id,
          description: `${w.title} — interactive live session.`,
          scheduledAt: new Date(now + w.off),
          durationMinutes: w.dur,
          thumbnail: `https://picsum.photos/seed/webinar${i + 1}/400/225`,
          joinUrl: `https://meet.example.com/demo-webinar-${i + 1}`,
          status: w.status,
        }).save(),
      ),
    );

    // 8. Teacher reviews (denormalise rating onto Teacher) --------------------
    // Each teacher reviewed by 3 distinct students; sequential await so the
    // recalcStats post-save hook isn't racing concurrent writes for the same teacher.
    const comments = [
      'Excellent teacher!',
      'Very helpful and patient.',
      'Concepts explained clearly.',
      'Good but fast-paced.',
      'Highly recommended.',
    ];
    let teacherReviewCount = 0;
    for (let ti = 0; ti < teachers.length; ti++) {
      for (let k = 0; k < 3; k++) {
        const student = students[(ti + k) % students.length]!;
        await new TeacherReview({
          teacher: teachers[ti]!._id,
          student: student._id,
          rating: ((ti + k) % 5) + 1,
          comment: comments[(ti + k) % comments.length],
        }).save();
        teacherReviewCount++;
      }
    }

    // 9. Center reviews (denormalise rating onto CoachingCenter) --------------
    let centerReviewCount = 0;
    for (let ci = 0; ci < centers.length; ci++) {
      for (let k = 0; k < 3; k++) {
        const student = students[(ci + k + 2) % students.length]!;
        await new CoachingCenterReview({
          coachingCenter: centers[ci]!._id,
          student: student._id,
          rating: ((ci + k + 2) % 5) + 1,
          comment: comments[(ci + k) % comments.length],
        }).save();
        centerReviewCount++;
      }
    }

    // 10. Bookmarks — first 5 students save a teacher + a center + a webinar ---
    const bookmarkInputs: Array<{
      student: mongoose.Types.ObjectId;
      targetType: 'Teacher' | 'CoachingCenter' | 'Webinar';
      target: mongoose.Types.ObjectId;
    }> = [];
    for (let si = 0; si < 5; si++) {
      const student = students[si]!._id;
      bookmarkInputs.push({ student, targetType: 'Teacher', target: teachers[si % teachers.length]!._id });
      bookmarkInputs.push({ student, targetType: 'CoachingCenter', target: centers[si % centers.length]!._id });
      bookmarkInputs.push({ student, targetType: 'Webinar', target: webinars[si % webinars.length]!._id });
    }
    await Promise.all(bookmarkInputs.map((b) => new StudentBookmark(b).save()));

    // 11. Enquiries — students → centers --------------------------------------
    const enquiryStatuses = ['new', 'contacted', 'closed'] as const;
    const enquiryInputs = Array.from({ length: 8 }, (_, i) => ({
      coachingCenter: centers[i % centers.length]!._id,
      student: students[i % students.length]!._id,
      subject: subjects[i % subjects.length]!._id,
      message: `Hi, I'm interested in your ${centerSeed[i % centerSeed.length]!.subs[0]} batch. Please share details.`,
      status: enquiryStatuses[i % enquiryStatuses.length],
    }));
    await Promise.all(enquiryInputs.map((e) => new Enquiry(e).save()));

    logger.info(
      {
        subjects: subjects.length,
        owners: owners.length,
        teachers: teachers.length,
        students: students.length,
        centers: centers.length,
        webinars: webinars.length,
        teacherReviews: teacherReviewCount,
        centerReviews: centerReviewCount,
        bookmarks: bookmarkInputs.length,
        enquiries: enquiryInputs.length,
        password: PASSWORD,
      },
      'demo seed complete',
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'demo seed failed');
  process.exit(1);
});
