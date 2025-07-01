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

  // Import watch history from HTML file (Google Takeout format)
  app.post('/api/import/html', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { htmlContent } = req.body;

      if (!htmlContent) {
        return res.status(400).json({ message: "HTML content is required" });
      }

      // Parse HTML to extract video data
      const videos = youtubeService.parseWatchHistoryHTML(htmlContent);
      
      if (videos.length === 0) {
        return res.status(400).json({ message: "No videos found in the HTML file" });
      }

      console.log(`Found ${videos.length} videos in HTML file`);
      const processedVideos = [];

      // Process videos in batches to avoid overloading APIs
      for (const historyItem of videos.slice(0, 50)) { // Limit to first 50 videos
        try {
          const videoId = historyItem.videoId;
          
          // Check if video already exists
          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) {
            continue; // Skip if already processed
          }

          // Get video information
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
          console.error(`Error processing video ${historyItem.videoId}:`, error);
          // Continue with next video on error
        }
      }

      res.json({ 
        message: `Successfully imported ${processedVideos.length} videos from HTML watch history`,
        processedCount: processedVideos.length,
        totalFound: videos.length,
        videos: processedVideos
      });

    } catch (error) {
      console.error("Error importing HTML watch history:", error);
      res.status(500).json({ message: "Failed to import HTML watch history" });
    }
  });

  // Import structured educational video data (JSON format)
  app.post('/api/import/educational-videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { videoData } = req.body;

      if (!videoData || !videoData.videos || !Array.isArray(videoData.videos)) {
        return res.status(400).json({ message: "Invalid video data format. Expected format with 'videos' array." });
      }

      const videos = videoData.videos;
      const metadata = videoData.metadata || {};
      
      console.log(`Processing ${videos.length} educational videos from structured data`);
      const processedVideos = [];
      const skippedVideos = [];
      const failedVideos = [];

      // Filter for high-quality educational content (score >= 0.6) and limit for performance
      const highQualityVideos = videos.filter((v: any) => v.educational_score >= 0.6);
      const videosToProcess = highQualityVideos.slice(0, 50);
      
      console.log(`Found ${highQualityVideos.length} high-quality videos, processing first ${videosToProcess.length}`);

      // Process each video from the structured data
      for (let i = 0; i < videosToProcess.length; i++) {
        const videoItem = videosToProcess[i];
        
        try {
          const videoId = videoItem.video_id;
          if (!videoId) {
            skippedVideos.push({ reason: 'No video ID', title: videoItem.title });
            continue;
          }

          // Check if video already exists for this user
          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) {
            skippedVideos.push({ reason: 'Already exists', title: videoItem.title });
            continue;
          }

          // Map category ID to a more readable category name
          const getCategoryName = (categoryId: string) => {
            const categories: Record<string, string> = {
              '1': 'Film & Animation',
              '2': 'Autos & Vehicles', 
              '10': 'Music',
              '15': 'Pets & Animals',
              '17': 'Sports',
              '19': 'Travel & Events',
              '20': 'Gaming',
              '22': 'People & Blogs',
              '23': 'Comedy',
              '24': 'Entertainment',
              '25': 'News & Politics',
              '26': 'Howto & Style',
              '27': 'Education',
              '28': 'Science & Technology',
              '29': 'Nonprofits & Activism',
            };
            return categories[categoryId] || 'Education';
          };

          // Create video record using the structured data
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: videoItem.title || 'Educational Video',
            channelName: videoItem.channel_name || 'Unknown Channel',
            duration: videoItem.duration_seconds || 0,
            thumbnail: videoItem.thumbnail_url || '',
            transcript: '', // Will be fetched later if needed for questions
            category: getCategoryName(videoItem.category_id),
          });

          const video = await storage.createVideo(videoData);

          // Try to get transcript for question generation
          let transcript = '';
          let generatedQuestions = [];
          
          try {
            transcript = await youtubeService.getVideoTranscript(videoId);
            
            if (transcript) {
              // Generate questions using AI with the transcript
              generatedQuestions = await openaiService.generateQuestions(
                videoItem.title,
                transcript,
                getCategoryName(videoItem.category_id),
                5 // Generate 5 questions per video
              );
            } else {
              // Generate questions using video metadata if no transcript
              generatedQuestions = await openaiService.generateQuestions(
                videoItem.title,
                videoItem.description || '',
                getCategoryName(videoItem.category_id),
                3 // Fewer questions without transcript
              );
            }

            // Save questions to storage
            if (generatedQuestions.length > 0) {
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
            }

          } catch (transcriptError) {
            console.log(`No transcript available for ${videoItem.title}, skipping question generation`);
          }

          processedVideos.push({
            ...video,
            questionsGenerated: generatedQuestions.length,
            hasTranscript: !!transcript
          });

        } catch (error) {
          console.error(`Error processing video ${videoItem.title}:`, error);
          failedVideos.push({ 
            title: videoItem.title, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({ 
        message: `Successfully imported ${processedVideos.length} educational videos`,
        processedCount: processedVideos.length,
        skippedCount: skippedVideos.length,
        failedCount: failedVideos.length,
        totalAttempted: videosToProcess.length,
        totalAvailable: videos.length,
        metadata: {
          importedFrom: 'structured-educational-data',
          originalMetadata: metadata,
          timestamp: new Date().toISOString()
        },
        videos: processedVideos,
        skipped: skippedVideos,
        failed: failedVideos
      });

    } catch (error) {
      console.error("Error importing educational videos:", error);
      res.status(500).json({ message: "Failed to import educational videos" });
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
