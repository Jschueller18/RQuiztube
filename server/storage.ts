import {
  users,
  videos,
  questions,
  quizSessions,
  questionResponses,
  reviewSchedule,
  type User,
  type UpsertUser,
  type Video,
  type InsertVideo,
  type Question,
  type InsertQuestion,
  type QuizSession,
  type InsertQuizSession,
  type QuestionResponse,
  type InsertQuestionResponse,
  type ReviewSchedule,
  type InsertReviewSchedule,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lte, isNotNull, count } from "drizzle-orm";

// Simple ID generation utility
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(id: string, preferences: Partial<User>): Promise<User>;
  
  // Video operations
  createVideo(video: InsertVideo): Promise<Video>;
  getUserVideos(userId: string): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  
  // Question operations
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  getVideoQuestions(videoId: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  
  // Quiz session operations
  createQuizSession(session: InsertQuizSession): Promise<QuizSession>;
  updateQuizSession(id: string, updates: Partial<QuizSession>): Promise<QuizSession>;
  getUserQuizSessions(userId: string): Promise<QuizSession[]>;
  
  // Question response operations
  createQuestionResponse(response: InsertQuestionResponse): Promise<QuestionResponse>;
  getSessionResponses(sessionId: string): Promise<QuestionResponse[]>;
  
  // Spaced repetition operations
  createReviewSchedule(schedule: InsertReviewSchedule): Promise<ReviewSchedule>;
  updateReviewSchedule(id: string, updates: Partial<ReviewSchedule>): Promise<ReviewSchedule>;
  getDueReviews(userId: string): Promise<(ReviewSchedule & { question: Question; video: Video })[]>;
  getUserStats(userId: string): Promise<{
    totalVideos: number;
    totalQuizzes: number;
    averageScore: number;
    streakDays: number;
    retentionRate: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private videos: Map<string, Video> = new Map();
  private questions: Map<string, Question> = new Map();
  private quizSessions: Map<string, QuizSession> = new Map();
  private questionResponses: Map<string, QuestionResponse> = new Map();
  private reviewSchedules: Map<string, ReviewSchedule> = new Map();
  private currentId = 1;

  private generateId(): string {
    return (this.currentId++).toString();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id);
    const user: User = {
      ...userData,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      learningGoals: userData.learningGoals || null,
      preferredCategories: userData.preferredCategories || null,
      reviewFrequency: userData.reviewFrequency || null,
      notificationSettings: userData.notificationSettings || null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
  }

  async updateUserPreferences(id: string, preferences: Partial<User>): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error("User not found");
    }
    const updatedUser = { ...existingUser, ...preferences, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createVideo(videoData: InsertVideo): Promise<Video> {
    const id = this.generateId();
    const video: Video = {
      ...videoData,
      id,
      duration: videoData.duration || null,
      thumbnail: videoData.thumbnail || null,
      transcript: videoData.transcript || null,
      category: videoData.category || null,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    this.videos.set(id, video);
    return video;
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    return Array.from(this.videos.values()).filter(video => video.userId === userId);
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async createQuestions(questionsData: InsertQuestion[]): Promise<Question[]> {
    const questions: Question[] = [];
    for (const questionData of questionsData) {
      const id = this.generateId();
      const question: Question = {
        ...questionData,
        id,
        explanation: questionData.explanation || null,
        difficulty: questionData.difficulty || null,
        createdAt: new Date(),
      };
      this.questions.set(id, question);
      questions.push(question);
    }
    return questions;
  }

  async getVideoQuestions(videoId: string): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(q => q.videoId === videoId);
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async createQuizSession(sessionData: InsertQuizSession): Promise<QuizSession> {
    const id = this.generateId();
    const session: QuizSession = {
      ...sessionData,
      id,
      completedAt: sessionData.completedAt || null,
      score: sessionData.score || null,
      totalQuestions: sessionData.totalQuestions || null,
      correctAnswers: sessionData.correctAnswers || null,
      startedAt: new Date(),
    };
    this.quizSessions.set(id, session);
    return session;
  }

  async updateQuizSession(id: string, updates: Partial<QuizSession>): Promise<QuizSession> {
    const existing = this.quizSessions.get(id);
    if (!existing) {
      throw new Error("Quiz session not found");
    }
    const updated = { ...existing, ...updates };
    this.quizSessions.set(id, updated);
    return updated;
  }

  async getUserQuizSessions(userId: string): Promise<QuizSession[]> {
    return Array.from(this.quizSessions.values()).filter(s => s.userId === userId);
  }

  async createQuestionResponse(responseData: InsertQuestionResponse): Promise<QuestionResponse> {
    const id = this.generateId();
    const response: QuestionResponse = {
      ...responseData,
      id,
      userAnswer: responseData.userAnswer || null,
      isCorrect: responseData.isCorrect || null,
      responseTime: responseData.responseTime || null,
      answeredAt: new Date(),
    };
    this.questionResponses.set(id, response);
    return response;
  }

  async getSessionResponses(sessionId: string): Promise<QuestionResponse[]> {
    return Array.from(this.questionResponses.values()).filter(r => r.sessionId === sessionId);
  }

  async createReviewSchedule(scheduleData: InsertReviewSchedule): Promise<ReviewSchedule> {
    const id = this.generateId();
    const schedule: ReviewSchedule = {
      ...scheduleData,
      id,
      interval: scheduleData.interval || null,
      easeFactor: scheduleData.easeFactor || null,
      repetitions: scheduleData.repetitions || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reviewSchedules.set(id, schedule);
    return schedule;
  }

  async updateReviewSchedule(id: string, updates: Partial<ReviewSchedule>): Promise<ReviewSchedule> {
    const existing = this.reviewSchedules.get(id);
    if (!existing) {
      throw new Error("Review schedule not found");
    }
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.reviewSchedules.set(id, updated);
    return updated;
  }

  async getDueReviews(userId: string): Promise<(ReviewSchedule & { question: Question; video: Video })[]> {
    const now = new Date();
    const dueSchedules = Array.from(this.reviewSchedules.values()).filter(
      s => s.userId === userId && s.nextReview <= now
    );
    
    const result = [];
    for (const schedule of dueSchedules) {
      const question = this.questions.get(schedule.questionId);
      const video = question ? this.videos.get(question.videoId) : undefined;
      if (question && video) {
        result.push({ ...schedule, question, video });
      }
    }
    return result;
  }

  async getUserStats(userId: string): Promise<{
    totalVideos: number;
    totalQuizzes: number;
    averageScore: number;
    streakDays: number;
    retentionRate: number;
  }> {
    const userVideos = await this.getUserVideos(userId);
    const userSessions = await this.getUserQuizSessions(userId);
    const completedSessions = userSessions.filter(s => s.completedAt);
    
    const totalVideos = userVideos.length;
    const totalQuizzes = completedSessions.length;
    const averageScore = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length 
      : 0;
    
    // Calculate streak (simplified - consecutive days with completed sessions)
    const sessionDates = completedSessions
      .map(s => s.completedAt!)
      .sort((a, b) => b.getTime() - a.getTime());
    
    let streakDays = 0;
    if (sessionDates.length > 0) {
      const today = new Date();
      const todayStr = today.toDateString();
      const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString();
      
      if (sessionDates.some(d => d.toDateString() === todayStr || d.toDateString() === yesterdayStr)) {
        streakDays = 1;
        // Simplified streak calculation
        const uniqueDays = new Set(sessionDates.map(d => d.toDateString()));
        streakDays = Math.min(uniqueDays.size, 30); // Cap at 30 days for demo
      }
    }
    
    // Simplified retention rate calculation
    const retentionRate = totalQuizzes > 0 ? Math.min(averageScore * 100, 95) : 0;
    
    return {
      totalVideos,
      totalQuizzes,
      averageScore,
      streakDays,
      retentionRate,
    };
  }
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPreferences(id: string, preferences: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Video operations
  async createVideo(videoData: InsertVideo): Promise<Video> {
    const [video] = await db
      .insert(videos)
      .values({ ...videoData, id: generateId() })
      .returning();
    return video;
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    return await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, id));
    return video;
  }

  // Question operations
  async createQuestions(questionsData: InsertQuestion[]): Promise<Question[]> {
    if (questionsData.length === 0) return [];
    const questionsWithIds = questionsData.map(q => ({ ...q, id: generateId() }));
    return await db
      .insert(questions)
      .values(questionsWithIds)
      .returning();
  }

  async getVideoQuestions(videoId: string): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .where(eq(questions.videoId, videoId));
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id));
    return question;
  }

  // Quiz session operations
  async createQuizSession(sessionData: InsertQuizSession): Promise<QuizSession> {
    const [session] = await db
      .insert(quizSessions)
      .values({ ...sessionData, id: generateId() })
      .returning();
    return session;
  }

  async updateQuizSession(id: string, updates: Partial<QuizSession>): Promise<QuizSession> {
    const [session] = await db
      .update(quizSessions)
      .set(updates)
      .where(eq(quizSessions.id, id))
      .returning();
    return session;
  }

  async getUserQuizSessions(userId: string): Promise<QuizSession[]> {
    return await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.userId, userId));
  }

  // Question response operations
  async createQuestionResponse(responseData: InsertQuestionResponse): Promise<QuestionResponse> {
    const [response] = await db
      .insert(questionResponses)
      .values({ ...responseData, id: generateId() })
      .returning();
    return response;
  }

  async getSessionResponses(sessionId: string): Promise<QuestionResponse[]> {
    return await db
      .select()
      .from(questionResponses)
      .where(eq(questionResponses.sessionId, sessionId));
  }

  // Spaced repetition operations
  async createReviewSchedule(scheduleData: InsertReviewSchedule): Promise<ReviewSchedule> {
    const [schedule] = await db
      .insert(reviewSchedule)
      .values({ ...scheduleData, id: generateId() })
      .returning();
    return schedule;
  }

  async updateReviewSchedule(id: string, updates: Partial<ReviewSchedule>): Promise<ReviewSchedule> {
    const [schedule] = await db
      .update(reviewSchedule)
      .set(updates)
      .where(eq(reviewSchedule.id, id))
      .returning();
    return schedule;
  }

  async getDueReviews(userId: string): Promise<(ReviewSchedule & { question: Question; video: Video })[]> {
    const now = new Date();
    const results = await db
      .select()
      .from(reviewSchedule)
      .innerJoin(questions, eq(reviewSchedule.questionId, questions.id))
      .innerJoin(videos, eq(questions.videoId, videos.id))
      .where(
        and(
          eq(reviewSchedule.userId, userId),
          lte(reviewSchedule.nextReview, now)
        )
      );
    
    return results.map(row => ({
      ...row.review_schedule,
      question: row.questions,
      video: row.videos
    }));
  }

  async getUserStats(userId: string): Promise<{
    totalVideos: number;
    totalQuizzes: number;
    averageScore: number;
    streakDays: number;
    retentionRate: number;
  }> {
    const [videoCount] = await db
      .select({ count: count() })
      .from(videos)
      .where(eq(videos.userId, userId));

    const [quizCount] = await db
      .select({ count: count() })
      .from(quizSessions)
      .where(eq(quizSessions.userId, userId));

    const completedQuizzes = await db
      .select({ score: quizSessions.score })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          isNotNull(quizSessions.score)
        )
      );

    const averageScore = completedQuizzes.length > 0 
      ? completedQuizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0) / completedQuizzes.length
      : 0;

    // Calculate streak days (simplified - can be enhanced later)
    const streakDays = 0;

    // Calculate retention rate (simplified - can be enhanced later)
    const retentionRate = completedQuizzes.length > 0 ? averageScore : 0;

    return {
      totalVideos: videoCount.count,
      totalQuizzes: quizCount.count,
      averageScore: Math.round(averageScore),
      streakDays,
      retentionRate: Math.round(retentionRate)
    };
  }
}

export const storage = new DatabaseStorage();
