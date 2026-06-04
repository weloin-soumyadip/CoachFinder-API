import type { Types } from 'mongoose';
import ProfileView from '../../models/ProfileView.js';
import Enrollment from '../../models/Enrollment.js';
import Enquiry from '../../models/Enquiry.js';
import type { ProfileViewStat, RecentEnquiry } from '../../types/dashboard.js';

// Single timezone used for BOTH the JS window boundaries and the $dateToString
// bucketing, so the 7 day-keys line up exactly with the aggregated buckets.
// Flip to e.g. 'Asia/Kolkata' if "today" should follow IST instead of the
// server clock.
const DASHBOARD_TZ = 'UTC';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DayWindow {
  rangeStart: Date; // inclusive — UTC midnight of (today - 6 days)
  rangeEnd: Date; //   exclusive — UTC midnight of (today + 1 day)
  dateKeys: string[]; // 7 'YYYY-MM-DD' strings, ascending
}

// today + previous 6 days. rangeEnd is exclusive (start of tomorrow) so the
// filter `{ $gte: rangeStart, $lt: rangeEnd }` captures all of today.
export function getLast7DayWindow(now: Date = new Date()): DayWindow {
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const rangeStart = new Date(startOfToday.getTime() - 6 * MS_PER_DAY);
  const rangeEnd = new Date(startOfToday.getTime() + MS_PER_DAY);

  const dateKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(rangeStart.getTime() + i * MS_PER_DAY);
    dateKeys.push(d.toISOString().slice(0, 10)); // 'YYYY-MM-DD' (UTC)
  }
  return { rangeStart, rangeEnd, dateKeys };
}

export interface ProfileViewSeries {
  total: number;
  stats: ProfileViewStat[];
}

// Sections #1 (weeklyProfileViews) and #5 (profileViewStats) from ONE aggregation.
// Always returns all 7 days ascending, filling 0 for days with no views.
export async function getProfileViewSeries(
  centerId: Types.ObjectId,
  window: DayWindow,
): Promise<ProfileViewSeries> {
  const rows = await ProfileView.aggregate<{ _id: string; views: number }>([
    {
      $match: {
        coachingCenter: centerId,
        viewedAt: { $gte: window.rangeStart, $lt: window.rangeEnd },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$viewedAt', timezone: DASHBOARD_TZ },
        },
        views: { $sum: 1 },
      },
    },
  ]);

  const byDate = new Map(rows.map((r) => [r._id, r.views]));
  const stats: ProfileViewStat[] = window.dateKeys.map((date) => ({
    date,
    views: byDate.get(date) ?? 0,
  }));
  const total = stats.reduce((sum, s) => sum + s.views, 0);
  return { total, stats };
}

// Section #4 — distinct students whose enrollment is currently 'active'.
export async function getActiveStudentCount(centerId: Types.ObjectId): Promise<number> {
  const rows = await Enrollment.aggregate<{ count: number }>([
    { $match: { coachingCenter: centerId, status: 'active' } },
    { $group: { _id: null, students: { $addToSet: '$student' } } },
    { $project: { _id: 0, count: { $size: '$students' } } },
  ]);
  return rows[0]?.count ?? 0;
}

// Section #2 — new enquiries received in the 7-day window.
export async function getWeeklyEnquiryCount(
  centerId: Types.ObjectId,
  window: DayWindow,
): Promise<number> {
  return Enquiry.countDocuments({
    coachingCenter: centerId,
    createdAt: { $gte: window.rangeStart, $lt: window.rangeEnd },
  });
}

type PopulatedEnquiryStudent = { name?: string; phone?: string; email?: string } | null;

// Section #6 — latest 5 enquiries, newest first, with student contact populated.
export async function getRecentEnquiries(centerId: Types.ObjectId): Promise<RecentEnquiry[]> {
  const rows = await Enquiry.find({ coachingCenter: centerId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('student', 'name phone email')
    .lean();

  return rows.map((e) => {
    const student = e.student as PopulatedEnquiryStudent;
    return {
      enquiryId: String(e._id),
      studentName: student?.name ?? '',
      phone: student?.phone ?? '',
      email: student?.email ?? '',
      message: e.message,
      createdAt: e.createdAt as Date,
    };
  });
}
