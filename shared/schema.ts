import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  learningGoals: text("learning_goals"),
  preferredCategories: text("preferred_categories").array(),
  reviewFrequency: varchar("review_frequency").default("daily"),
  notificationSettings: jsonb("notification_settings").default({
    quizReminders: true,
    newVideoAnalysis: true,
    weeklyProgress: false,
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Videos table for storing analyzed video data
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  youtubeId: varchar("youtube_id").notNull(),
  title: text("title").notNull(),
  channelName: varchar("channel_name").notNull(),
  duration: integer("duration"), // in seconds
  thumbnail: text("thumbnail"),
  transcript: text("transcript"),
  category: varchar("category"),
  processedAt: timestamp("processed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Questions generated for videos
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().notNull(),
  videoId: varchar("video_id").references(() => videos.id).notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  difficulty: varchar("difficulty").default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User quiz sessions and responses
export const quizSessions = pgTable("quiz_sessions", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  videoId: varchar("video_id").references(() => videos.id).notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  score: real("score"),
  totalQuestions: integer("total_questions"),
  correctAnswers: integer("correct_answers"),
});

// Individual question responses
export const questionResponses = pgTable("question_responses", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").references(() => quizSessions.id).notNull(),
  questionId: varchar("question_id").references(() => questions.id).notNull(),
  userAnswer: integer("user_answer"),
  isCorrect: boolean("is_correct"),
  responseTime: integer("response_time"), // in seconds
  answeredAt: timestamp("answered_at").defaultNow(),
});

// Spaced repetition schedule
export const reviewSchedule = pgTable("review_schedule", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  questionId: varchar("question_id").references(() => questions.id).notNull(),
  nextReview: timestamp("next_review").notNull(),
  interval: integer("interval").default(1), // days
  easeFactor: real("ease_factor").default(2.5),
  repetitions: integer("repetitions").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  processedAt: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  createdAt: true,
});

export const insertQuizSessionSchema = createInsertSchema(quizSessions).omit({
  startedAt: true,
});

export const insertQuestionResponseSchema = createInsertSchema(questionResponses).omit({
  answeredAt: true,
});

export const insertReviewScheduleSchema = createInsertSchema(reviewSchedule).omit({
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuizSession = z.infer<typeof insertQuizSessionSchema>;
export type QuizSession = typeof quizSessions.$inferSelect;
export type InsertQuestionResponse = z.infer<typeof insertQuestionResponseSchema>;
export type QuestionResponse = typeof questionResponses.$inferSelect;
export type InsertReviewSchedule = z.infer<typeof insertReviewScheduleSchema>;
export type ReviewSchedule = typeof reviewSchedule.$inferSelect;
