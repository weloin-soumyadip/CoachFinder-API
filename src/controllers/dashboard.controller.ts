import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import Teacher from '../models/Teacher.js';
import CoachingCenter from '../models/CoachingCenter.js';
import Webinar from '../models/Webinar.js';
import ApiError from '../utils/ApiError.js';
import {
  getLast7DayWindow,
  getProfileViewSeries,
  getActiveStudentCount,
  getWeeklyEnquiryCount,
  getRecentEnquiries,
} from '../lib/dashboard/ownerDashboard.queries.js';
import type { OwnerDashboardData } from '../types/dashboard.js';
// Side-effect import: registers the Subject schema so Teacher.populate('subjects')
// works even though no Subject route is mounted yet (Phase 2.2).
import '../models/Subject.js';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

type PopulatedSubject = { name?: string };
type PopulatedTeacher = {
  name?: string;
  profileImage?: string;
  totalReviews?: number;
  averageRating?: number;
};

// GET /api/students/dashboard — aggregated student landing data.
// Read-only; all fields below are public-safe (no email/phone/password).
export async function getStudentDashboard(_req: Request, res: Response): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + TWO_DAYS_MS);

  const [teachers, centers, webinars] = await Promise.all([
    // Top 5 teachers by rating.
    Teacher.find({ isActive: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .populate('subjects', 'name')
      .lean(),
    // Top 3 coaching centers by rating.
    CoachingCenter.find({ isActive: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(3)
      .lean(),
    // Webinars scheduled within the next 2 days. Ordered below by the hosting
    // teacher's review count (sort key lives on the populated Teacher, so we
    // sort in JS and take the top 3).
    Webinar.find({
      isActive: true,
      status: 'scheduled',
      scheduledAt: { $gte: now, $lte: windowEnd },
    })
      .populate('teacher', 'name profileImage totalReviews averageRating')
      .lean(),
  ]);

  const topTeachers = teachers.map((t) => ({
    _id: t._id,
    name: t.name,
    profileImage: t.profileImage ?? '',
    subjects: (t.subjects as PopulatedSubject[] | undefined)?.map((s) => s.name).filter(Boolean) ?? [],
    averageRating: t.averageRating ?? 0,
    totalReviews: t.totalReviews ?? 0,
  }));

  const topCenters = centers.map((c) => ({
    _id: c._id,
    name: c.name,
    image: c.profileImage ?? '',
    averageRating: c.averageRating ?? 0,
    totalReviews: c.totalReviews ?? 0,
    city: c.city,
    area: c.area ?? '',
  }));

  // Rank by the hosting teacher's review count (most-reviewed first), then by
  // rating, then soonest. Take the top 3.
  const upcomingWebinars = webinars
    .map((w) => ({ w, t: w.teacher as PopulatedTeacher | null }))
    .sort((a, b) => {
      const reviews = (b.t?.totalReviews ?? 0) - (a.t?.totalReviews ?? 0);
      if (reviews !== 0) return reviews;
      const rating = (b.t?.averageRating ?? 0) - (a.t?.averageRating ?? 0);
      if (rating !== 0) return rating;
      return new Date(a.w.scheduledAt).getTime() - new Date(b.w.scheduledAt).getTime();
    })
    .slice(0, 3)
    .map(({ w, t }) => ({
      _id: w._id,
      title: w.title,
      teacher: {
        name: t?.name ?? '',
        profileImage: t?.profileImage ?? '',
        totalReviews: t?.totalReviews ?? 0,
      },
      scheduledAt: w.scheduledAt,
      thumbnail: w.thumbnail ?? '',
      joinUrl: w.joinUrl ?? '',
    }));

  res.status(200).json({
    success: true,
    dashboard: { topTeachers, topCenters, upcomingWebinars },
  });
}

// GET /api/owners/dashboard — aggregated metrics for the calling owner's
// coaching center (one owner = one center). Owner-only.
export async function getOwnerDashboard(req: Request, res: Response): Promise<void> {
  if (req.auth?.type !== 'owner') {
    throw new ApiError(401, 'Not authenticated as owner');
  }

  const center = await CoachingCenter.findOne({ owner: req.auth.doc._id }).lean();
  if (!center) {
    // Owner hasn't created a coaching center yet — return an empty dashboard
    // (zeroed metrics + empty arrays) instead of erroring, so the client can
    // render a "no center yet" state without special-casing a 404.
    const empty: OwnerDashboardData = {
      weeklyProfileViews: 0,
      weeklyEnquiries: 0,
      averageRating: 0,
      totalReviews: 0,
      activeStudents: 0,
      profileViewStats: [],
      recentEnquiries: [],
    };
    res.status(200).json({ success: true, data: empty });
    return;
  }
  const centerId = center._id as Types.ObjectId;

  const window = getLast7DayWindow();
  const [viewSeries, activeStudents, weeklyEnquiries, recentEnquiries] = await Promise.all([
    getProfileViewSeries(centerId, window),
    getActiveStudentCount(centerId),
    getWeeklyEnquiryCount(centerId, window),
    getRecentEnquiries(centerId),
  ]);

  const data: OwnerDashboardData = {
    weeklyProfileViews: viewSeries.total,
    weeklyEnquiries,
    // Rating is already denormalised onto the center by the review hooks — reuse it.
    averageRating: center.averageRating ?? 0,
    totalReviews: center.totalReviews ?? 0,
    activeStudents,
    profileViewStats: viewSeries.stats,
    recentEnquiries,
  };

  res.status(200).json({ success: true, data });
}
