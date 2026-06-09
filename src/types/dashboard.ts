// Response types for the coaching-center owner dashboard (GET /api/owners/dashboard).

export interface ProfileViewStat {
  date: string; // 'YYYY-MM-DD'
  views: number;
}

export interface RecentEnquiry {
  enquiryId: string;
  studentName: string;
  phone: string;
  email: string;
  message: string;
  createdAt: Date;
}

export interface OwnerDashboardData {
  weeklyProfileViews: number;
  weeklyEnquiries: number;
  averageRating: number;
  totalReviews: number;
  activeStudents: number;
  profileViewStats: ProfileViewStat[];
  recentEnquiries: RecentEnquiry[];
}

// Response types for the teacher dashboard (GET /api/teachers/dashboard).

export interface TeacherRecentEnquiry {
  enquiryId: string;
  studentName: string;
  phone: string;
  message: string;
  createdAt: Date;
  status: string;
}

export interface TeacherDashboardData {
  rating: {
    average: number;
    totalReviews: number;
  };
  profileViews: number;
  totalStudents: number;
  todaySessions: number;
  recentEnquiries: TeacherRecentEnquiry[];
}
