import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import config from './config/index.js';
import { httpLogger } from './lib/logger.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import ownersRoutes from './routes/owners.routes.js';
import teachersRoutes from './routes/teachers.routes.js';
import studentsRoutes from './routes/students.routes.js';
import webinarsRoutes from './routes/webinars.routes.js';
import teacherReviewsRoutes from './routes/teacherReviews.routes.js';
import subjectsRoutes from './routes/subjects.routes.js';
import searchRoutes from './routes/search.routes.js';
import adminsRoutes from './routes/admins.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Core middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.cors.origin.length ? config.cors.origin : '*',
    credentials: true,
  })
);
app.use(httpLogger);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Hello from coaching app!',
  });
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/owners', ownersRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/webinars', webinarsRoutes);
app.use('/api/teacher-reviews', teacherReviewsRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/admin', adminRoutes);

// 404 + central error handler — must come LAST.
app.use(notFound);
app.use(errorHandler);

export default app;
