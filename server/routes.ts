import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { YouTubeService } from "./services/youtube";
import { OpenAIService } from "./services/openai";
import { SpacedRepetitionService } from "./services/spaced-repetition";
import { GoogleDriveService } from "./services/google-drive";
import { insertVideoSchema, insertQuizSessionSchema, insertQuestionResponseSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  const youtubeService = new YouTubeService();
  const openaiService = new OpenAIService();
  const spacedRepetitionService = new SpacedRepetitionService();
  const googleDriveService = new GoogleDriveService();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User preferences
  app.put('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { learningGoals, preferredCategories, reviewFrequency, notificationSettings } = req.body;
      
      const updatedUser = await storage.updateUserPreferences(userId, {
        learningGoals,
        preferredCategories,
        reviewFrequency,
        notificationSettings,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Video analysis
  app.post('/api/videos/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ message: "Video URL is required" });
      }

      // Extract video ID
      const videoId = youtubeService.extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Check if video already exists
      const userVideos = await storage.getUserVideos(userId);
      const existingVideo = userVideos.find(v => v.youtubeId === videoId);
      if (existingVideo) {
        return res.json({ video: existingVideo, questions: await storage.getVideoQuestions(existingVideo.id) });
      }

      // Get video info and transcript
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      const transcript = await youtubeService.getVideoTranscript(videoId);
      const category = youtubeService.categorizeContent(videoInfo.title, videoInfo.description);

      // Create video record
      const videoData = insertVideoSchema.parse({
        userId,
        youtubeId: videoId,
        title: videoInfo.title,
        channelName: videoInfo.channelTitle,
        duration: youtubeService.parseDuration(videoInfo.duration),
        thumbnail: videoInfo.thumbnails.medium.url,
        transcript,
        category,
      });

      const video = await storage.createVideo(videoData);

      // Generate questions
      const generatedQuestions = await openaiService.generateQuestions(
        videoInfo.title,
        transcript,
        category,
        10
      );

      // Save questions
      const questionsData = generatedQuestions.map(q => ({
        id: nanoid(),
        videoId: video.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));

      const questions = await storage.createQuestions(questionsData);

      res.json({ video, questions });
    } catch (error) {
      console.error("Error analyzing video:", error);
      res.status(500).json({ message: "Failed to analyze video" });
    }
  });

  // Get user videos
  app.get('/api/videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videos = await storage.getUserVideos(userId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Start quiz session
  app.post('/api/quiz/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { videoId } = req.body;

      if (!videoId) {
        return res.status(400).json({ message: "Video ID is required" });
      }

      const video = await storage.getVideo(videoId);
      if (!video || video.userId !== userId) {
        return res.status(404).json({ message: "Video not found" });
      }

      const questions = await storage.getVideoQuestions(videoId);
      if (questions.length === 0) {
        return res.status(400).json({ message: "No questions available for this video" });
      }

      const sessionData = insertQuizSessionSchema.parse({
        id: nanoid(),
        userId,
        videoId,
        totalQuestions: questions.length,
      });

      const session = await storage.createQuizSession(sessionData);
      
      // Return session with questions (without correct answers)
      const questionsForQuiz = questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      }));

      res.json({ session, questions: questionsForQuiz, video });
    } catch (error) {
      console.error("Error starting quiz:", error);
      res.status(500).json({ message: "Failed to start quiz" });
    }
  });

  // Submit quiz answer
  app.post('/api/quiz/answer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId, questionId, userAnswer, responseTime } = req.body;

      // Validate session belongs to user
      const session = await storage.getUserQuizSessions(userId);
      const currentSession = session.find(s => s.id === sessionId);
      if (!currentSession) {
        return res.status(404).json({ message: "Quiz session not found" });
      }

      // Get the question to check correct answer
      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      const isCorrect = question.correctAnswer === userAnswer;

      // Create response record
      const responseData = insertQuestionResponseSchema.parse({
        id: nanoid(),
        sessionId,
        questionId,
        userAnswer,
        isCorrect,
        responseTime,
      });

      await storage.createQuestionResponse(responseData);

      // Update or create spaced repetition schedule
      const quality = spacedRepetitionService.calculateQuality(isCorrect, responseTime);
      const nextReview = spacedRepetitionService.calculateNextReview(2.5, 0, quality);

      await storage.createReviewSchedule({
        id: nanoid(),
        userId,
        questionId,
        nextReview: nextReview.nextReview,
        interval: nextReview.interval,
        easeFactor: nextReview.easeFactor,
        repetitions: nextReview.repetitions,
      });

      res.json({
        correct: isCorrect,
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
      });
    } catch (error) {
      console.error("Error submitting answer:", error);
      res.status(500).json({ message: "Failed to submit answer" });
    }
  });

  // Complete quiz session
  app.post('/api/quiz/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;

      // Get session responses to calculate score
      const responses = await storage.getSessionResponses(sessionId);
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const score = responses.length > 0 ? correctAnswers / responses.length : 0;

      const updatedSession = await storage.updateQuizSession(sessionId, {
        completedAt: new Date(),
        score,
        correctAnswers,
      });

      res.json(updatedSession);
    } catch (error) {
      console.error("Error completing quiz:", error);
      res.status(500).json({ message: "Failed to complete quiz" });
    }
  });

  // Get due reviews
  app.get('/api/reviews/due', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dueReviews = await storage.getDueReviews(userId);
      res.json(dueReviews);
    } catch (error) {
      console.error("Error fetching due reviews:", error);
      res.status(500).json({ message: "Failed to fetch due reviews" });
    }
  });

  // Get user analytics
  app.get('/api/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      const sessions = await storage.getUserQuizSessions(userId);
      const videos = await storage.getUserVideos(userId);
      
      // Group sessions by category for subject performance
      const categoryPerformance = videos.reduce((acc, video) => {
        const videoSessions = sessions.filter(s => s.videoId === video.id && s.completedAt);
        if (videoSessions.length > 0) {
          const avgScore = videoSessions.reduce((sum, s) => sum + (s.score || 0), 0) / videoSessions.length;
          acc[video.category || 'general'] = (acc[video.category || 'general'] || 0) + avgScore;
        }
        return acc;
      }, {} as Record<string, number>);

      res.json({
        ...stats,
        categoryPerformance,
        recentSessions: sessions.slice(-10),
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Watch history import endpoint
  app.post('/api/import-watch-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { watchHistory } = req.body;

      if (!Array.isArray(watchHistory)) {
        return res.status(400).json({ message: "Invalid watch history format" });
      }

      const processedVideos = [];

      // Process each video from watch history
      for (const historyItem of watchHistory.slice(0, 20)) { // Limit to 20 videos for performance
        try {
          // Extract video ID from URL
          const videoId = youtubeService.extractVideoId(historyItem.url);
          if (!videoId) continue;

          // Check if video already exists for this user
          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) {
            continue; // Skip if already processed
          }

          // Get video info and transcript
          const videoInfo = await youtubeService.getVideoInfo(videoId);
          const transcript = await youtubeService.getVideoTranscript(videoId);
          
          // Create video record
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: videoInfo.title,
            channelName: videoInfo.channelTitle,
            duration: youtubeService.parseDuration(videoInfo.duration),
            thumbnail: videoInfo.thumbnails.medium?.url,
            transcript: transcript,
            category: youtubeService.categorizeContent(videoInfo.title, videoInfo.description),
          });

          const video = await storage.createVideo(videoData);

          // Generate questions using AI
          const generatedQuestions = await openaiService.generateQuestions(
            videoInfo.title,
            transcript,
            videoInfo.channelTitle,
            5 // Generate 5 questions per video for bulk import
          );

          // Save questions to storage
          const questionsData = generatedQuestions.map(q => ({
            id: nanoid(),
            videoId: video.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
          }));

          await storage.createQuestions(questionsData);
          processedVideos.push(video);

        } catch (error) {
          console.error(`Error processing video ${historyItem.url}:`, error);
          // Continue with next video on error
        }
      }

      res.json({ 
        message: `Successfully imported ${processedVideos.length} videos from watch history`,
        processedCount: processedVideos.length,
        videos: processedVideos
      });

    } catch (error) {
      console.error("Error importing watch history:", error);
      res.status(500).json({ message: "Failed to import watch history" });
    }
  });

  // Google Drive automation endpoints
  app.post('/api/automation/create-drive-folder', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const folder = await googleDriveService.createTakeoutFolder(user.email);
      res.json({
        message: "Shared folder created successfully",
        folderId: folder.folderId,
        shareUrl: folder.shareUrl,
        instructions: [
          "1. Click the link to access your shared folder",
          "2. Upload your Google Takeout ZIP file to this folder",
          "3. The system will automatically process new files",
          "4. You'll receive notifications when processing is complete"
        ]
      });
    } catch (error) {
      console.error("Error creating drive folder:", error);
      res.status(500).json({ message: "Google Drive integration requires service account setup" });
    }
  });

  app.get('/api/automation/drive-files/:folderId?', isAuthenticated, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const files = await googleDriveService.listTakeoutFiles(folderId);
      res.json({ files });
    } catch (error) {
      console.error("Error listing drive files:", error);
      res.status(500).json({ message: "Failed to list drive files" });
    }
  });

  app.post('/api/automation/process-drive-file', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fileId } = req.body;

      if (!fileId) {
        return res.status(400).json({ message: "File ID is required" });
      }

      // Download and parse watch history from Google Drive
      const watchHistoryData = await googleDriveService.downloadWatchHistory(fileId);
      
      // Process the watch history (same logic as manual import)
      const processedVideos = [];
      for (const historyItem of watchHistoryData.slice(0, 20)) {
        try {
          const videoId = youtubeService.extractVideoId(historyItem.titleUrl);
          if (!videoId) continue;

          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) continue;

          const videoInfo = await youtubeService.getVideoInfo(videoId);
          const transcript = await youtubeService.getVideoTranscript(videoId);
          
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: videoInfo.title,
            channelName: videoInfo.channelTitle,
            duration: youtubeService.parseDuration(videoInfo.duration),
            thumbnail: videoInfo.thumbnails.medium?.url,
            transcript: transcript,
            category: youtubeService.categorizeContent(videoInfo.title, videoInfo.description),
          });

          const video = await storage.createVideo(videoData);

          const generatedQuestions = await openaiService.generateQuestions(
            videoInfo.title,
            transcript,
            videoInfo.channelTitle,
            5
          );

          const questionsData = generatedQuestions.map(q => ({
            id: nanoid(),
            videoId: video.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
          }));

          await storage.createQuestions(questionsData);
          processedVideos.push(video);

        } catch (error) {
          console.error(`Error processing video ${historyItem.titleUrl}:`, error);
        }
      }

      res.json({ 
        message: `Automatically processed ${processedVideos.length} videos from Google Drive`,
        processedCount: processedVideos.length,
        videos: processedVideos
      });

    } catch (error) {
      console.error("Error processing drive file:", error);
      res.status(500).json({ message: "Failed to process drive file" });
    }
  });

  // Webhook endpoint for Google Drive notifications
  app.post('/api/webhooks/drive-update', async (req, res) => {
    try {
      // This endpoint would be called by Google Drive when files are added
      // For security, you'd want to verify the webhook signature
      const { fileId, folderId } = req.body;
      
      // You could store this notification and process it asynchronously
      console.log(`Received Drive webhook: file ${fileId} in folder ${folderId}`);
      
      res.status(200).json({ message: "Webhook received" });
    } catch (error) {
      console.error("Error handling drive webhook:", error);
      res.status(500).json({ message: "Webhook error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
