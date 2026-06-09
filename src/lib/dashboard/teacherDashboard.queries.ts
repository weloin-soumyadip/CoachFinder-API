import type { Types } from 'mongoose';
import TeacherProfileView from '../../models/TeacherProfileView.js';
import Enrollment from '../../models/Enrollment.js';
import Session from '../../models/Session.js';
import Enquiry from '../../models/Enquiry.js';
import type { TeacherRecentEnquiry } from '../../types/dashboard.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TodayWindow {
  start: Date; // inclusive — UTC midnight of today
  end: Date; //   exclusive — UTC midnight of tomorrow
}

// today's [start, end) in UTC. Mirrors getLast7DayWindow's boundary convention
// in ownerDashboard.queries.ts so "today" is consistent across dashboards.
export function getTodayWindow(now: Date = new Date()): TodayWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
}

// Total profile views for the teacher's own profile (all-time).
export async function getTeacherProfileViewCount(teacherId: Types.ObjectId): Promise<number> {
  return TeacherProfileView.countDocuments({ teacher: teacherId });
}

// Distinct students with a currently-active enrollment under this teacher.
// Mirrors getActiveStudentCount (owner dashboard) — de-dupes via $addToSet.
export async function getTeacherStudentCount(teacherId: Types.ObjectId): Promise<number> {
  const rows = await Enrollment.aggregate<{ count: number }>([
    { $match: { teacher: teacherId, status: 'active' } },
    { $group: { _id: null, students: { $addToSet: '$student' } } },
    { $project: { _id: 0, count: { $size: '$students' } } },
  ]);
  return rows[0]?.count ?? 0;
}

// Sessions scheduled for today (status 'scheduled', not soft-deleted).
export async function getTodaySessionCount(
  teacherId: Types.ObjectId,
  window: TodayWindow,
): Promise<number> {
  return Session.countDocuments({
    teacher: teacherId,
    isActive: true,
    status: 'scheduled',
    scheduledAt: { $gte: window.start, $lt: window.end },
  });
}

type PopulatedEnquiryStudent = { name?: string; phone?: string } | null;

// Latest 5 enquiries addressed to this teacher, newest first, student contact
// populated. ownerNotes is never included (allow-listed projection below).
export async function getRecentTeacherEnquiries(
  teacherId: Types.ObjectId,
): Promise<TeacherRecentEnquiry[]> {
  const rows = await Enquiry.find({ teacher: teacherId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('student', 'name phone')
    .lean();

  return rows.map((e) => {
    const student = e.student as PopulatedEnquiryStudent;
    return {
      enquiryId: String(e._id),
      studentName: student?.name ?? '',
      phone: student?.phone ?? '',
      message: e.message,
      createdAt: e.createdAt as Date,
      status: e.status ?? 'new',
    };
  });
}
