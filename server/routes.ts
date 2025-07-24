import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// DISABLED FOR RAILWAY: import { setupAuth, isAuthenticated } from "./replitAuth";
import { YouTubeService } from "./services/youtube";
import { AnthropicService } from "./services/anthropic";
import { SpacedRepetitionService } from "./services/spaced-repetition";
import { GoogleDriveService } from "./services/google-drive";
import { insertVideoSchema, insertQuizSessionSchema, insertQuestionResponseSchema } from "../shared/schema";
import { nanoid } from "nanoid";

// Mock authentication middleware for Railway deployment
const mockAuth = async (req: any, res: any, next: any) => {
  // Create a consistent test user
  req.user = {
    claims: {
      sub: "railway-test-user",
      email: "test@railway.app",
      first_name: "Railway",
      last_name: "User"
    }
  };
  req.isAuthenticated = () => true;
  
  // Ensure the test user exists in the database
  try {
    await storage.upsertUser({
      id: req.user.claims.sub,
      email: req.user.claims.email,
      firstName: req.user.claims.first_name,
      lastName: req.user.claims.last_name,
    });
  } catch (error) {
    console.error("Error creating mock user:", error);
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // DISABLED FOR RAILWAY: Auth middleware
  // await setupAuth(app);

  const youtubeService = new YouTubeService();
  const anthropicService = new AnthropicService();
  const spacedRepetitionService = new SpacedRepetitionService();
  const googleDriveService = new GoogleDriveService();

  // Auth routes - using mock auth
  app.get('/api/auth/user', mockAuth, async (req: any, res) => {
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
  app.put('/api/user/preferences', mockAuth, async (req: any, res) => {
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

  // Clear user library
  app.delete('/api/user/library', mockAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearUserLibrary(userId);
      res.json({ message: "Library cleared successfully" });
    } catch (error) {
      console.error("Error clearing library:", error);
      res.status(500).json({ message: "Failed to clear library" });
    }
  });

  // Video analysis
  app.post('/api/videos/analyze', mockAuth, async (req: any, res) => {
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

      // Validate video for processing (comprehensive check)
      const validationResult = await youtubeService.validateVideoForProcessing(videoId);
      
      if (!validationResult.isValid) {
        return res.status(400).json({ 
          message: `Video cannot be processed: ${validationResult.rejectionReason}`,
          rejectionReason: validationResult.rejectionReason
        });
      }

      // Create video record with validated data
      const videoData = insertVideoSchema.parse({
        userId,
        youtubeId: videoId,
        title: validationResult.videoInfo!.title,
        channelName: validationResult.videoInfo!.channelTitle,
        duration: youtubeService.parseDuration(validationResult.videoInfo!.duration),
        thumbnail: validationResult.videoInfo!.thumbnails.medium.url,
        transcript: validationResult.cleanTranscript,
        category: validationResult.category,
      });

      // Generate questions using Claude-optimized content BEFORE saving video
      const generatedQuestions = await anthropicService.generateQuestions(
        validationResult.videoInfo!.title,
        validationResult.claudeOptimizedContent!,
        validationResult.category!,
        5
      );


      // Only create video if questions were successfully generated
      const video = await storage.createVideo(videoData);

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

      res.json({ 
        video, 
        questions,
        message: `Generated ${generatedQuestions.length} questions for video: ${validationResult.videoInfo!.title}`,
        validationInfo: {
          transcriptLength: validationResult.cleanTranscript!.length,
          category: validationResult.category,
          hasEducationalContent: true
        }
      });
    } catch (error) {
      console.error("Error analyzing video:", error);
      res.status(500).json({ message: "Failed to analyze video" });
    }
  });

  // Get user videos with quiz completion status
  app.get('/api/videos', mockAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videos = await storage.getUserVideos(userId);
      
      // Get completion status for each video
      const videosWithCompletion = await Promise.all(
        videos.map(async (video) => {
          const sessions = await storage.getUserQuizSessions(userId);
          const completedSession = sessions.find(
            s => s.videoId === video.id && s.completedAt !== null
          );
          
          const questions = await storage.getVideoQuestions(video.id);
          
          const videoWithCompletion = {
            ...video,
            hasQuiz: questions.length > 0,
            quizCompleted: !!completedSession,
            lastScore: completedSession?.score || null,
            questionCount: questions.length,
          };
          
          // Debug logging
          if (completedSession) {
            console.log(`Video ${video.title} has completed session:`, {
              sessionId: completedSession.id,
              completedAt: completedSession.completedAt,
              score: completedSession.score
            });
          }
          
          return videoWithCompletion;
        })
      );
      
      res.json(videosWithCompletion);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Start quiz session
  app.post('/api/quiz/start', mockAuth, async (req: any, res) => {
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
  app.post('/api/quiz/answer', mockAuth, async (req: any, res) => {
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
  app.post('/api/quiz/complete', mockAuth, async (req: any, res) => {
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
  app.get('/api/reviews/due', mockAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dueReviews = await storage.getDueReviews(userId);
      res.json(dueReviews);
    } catch (error) {
      console.error("Error fetching due reviews:", error);
      res.status(500).json({ message: "Failed to fetch due reviews" });
    }
  });

  // Generate more questions for a video
  app.post('/api/videos/:videoId/generate-questions', mockAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { videoId } = req.params;
      const { count = 5 } = req.body;
      
      // Ensure we always generate exactly 5 questions
      const targetCount = 5;

      // Verify video belongs to user
      const video = await storage.getVideo(videoId);
      if (!video || video.userId !== userId) {
        return res.status(404).json({ message: "Video not found" });
      }

      // Get existing questions to avoid duplicates
      const existingQuestions = await storage.getVideoQuestions(videoId);
      const existingQuestionTexts = existingQuestions.map(q => q.question.toLowerCase());

      // Generate new questions (always generate exactly 5)
      const generatedQuestions = await anthropicService.generateQuestions(
        video.title,
        video.transcript || '',
        video.category || 'general',
        targetCount + 2, // Generate extra to account for potential duplicates
        existingQuestionTexts
      );

      // Filter out duplicates based on question text similarity
      const newQuestions = generatedQuestions.filter(q => 
        !existingQuestionTexts.some(existing => 
          existing.includes(q.question.toLowerCase().substring(0, 50)) ||
          q.question.toLowerCase().includes(existing.substring(0, 50))
        )
      ).slice(0, targetCount);

      if (newQuestions.length === 0) {
        return res.status(400).json({ message: "No new questions could be generated" });
      }

      // Save new questions
      const questionsData = newQuestions.map(q => ({
        id: nanoid(),
        videoId: video.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));

      const questions = await storage.createQuestions(questionsData);

      res.json({ 
        message: `Generated ${questions.length} new questions`,
        questions: questions.length,
        video: video.title
      });
    } catch (error) {
      console.error("Error generating more questions:", error);
      res.status(500).json({ message: "Failed to generate more questions" });
    }
  });

  // Get user analytics
  app.get('/api/analytics', mockAuth, async (req: any, res) => {
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
  app.post('/api/import-watch-history', mockAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { watchHistory } = req.body;

      if (!Array.isArray(watchHistory)) {
        return res.status(400).json({ message: "Invalid watch history format" });
      }

      const processedVideos = [];

      const skippedVideos = [];
      const failedVideos = [];

      // Process each video from watch history
      for (const historyItem of watchHistory.slice(0, 50)) { // Process up to 50 videos
        try {
          // Extract video ID from URL
          const videoId = youtubeService.extractVideoId(historyItem.url);
          if (!videoId) {
            skippedVideos.push({ reason: 'Invalid URL', url: historyItem.url });
            continue;
          }

          // Check if video already exists for this user
          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) {
            skippedVideos.push({ reason: 'Already processed', url: historyItem.url });
            continue; // Skip if already processed
          }

          // Validate video for processing (includes transcript check, duration check, etc.)
          const validationResult = await youtubeService.validateVideoForProcessing(videoId);
          
          if (!validationResult.isValid) {
            console.log(`Skipping video ${videoId}: ${validationResult.rejectionReason}`);
            skippedVideos.push({ 
              reason: validationResult.rejectionReason, 
              url: historyItem.url, 
              title: historyItem.title 
            });
            continue;
          }

          // Video passed validation - create record with validated data
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: validationResult.videoInfo!.title,
            channelName: validationResult.videoInfo!.channelTitle,
            duration: youtubeService.parseDuration(validationResult.videoInfo!.duration),
            thumbnail: validationResult.videoInfo!.thumbnails.medium?.url,
            transcript: validationResult.cleanTranscript,
            category: validationResult.category,
          });

          // Generate questions using Claude-optimized content BEFORE saving video
          const generatedQuestions = await anthropicService.generateQuestions(
            validationResult.videoInfo!.title,
            validationResult.claudeOptimizedContent!,
            validationResult.category!,
            5 // Generate 5 questions per video for bulk import
          );


          // Only create video if questions were successfully generated
          const video = await storage.createVideo(videoData);

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
          processedVideos.push({
            ...video,
            questionsGenerated: generatedQuestions.length,
            hasTranscript: true
          });

        } catch (error) {
          console.error(`Error processing video ${historyItem.url}:`, error);
          failedVideos.push({ 
            url: historyItem.url, 
            title: historyItem.title,
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          // Continue with next video on error
        }
      }

      res.json({ 
        message: `Successfully imported ${processedVideos.length} videos from watch history`,
        processedCount: processedVideos.length,
        skippedCount: skippedVideos.length,
        failedCount: failedVideos.length,
        totalAttempted: watchHistory.slice(0, 50).length,
        videos: processedVideos,
        skipped: skippedVideos.slice(0, 10), // Show first 10 skipped for debugging
        failed: failedVideos.slice(0, 10) // Show first 10 failed for debugging
      });

    } catch (error) {
      console.error("Error importing watch history:", error);
      res.status(500).json({ message: "Failed to import watch history" });
    }
  });

  // Import watch history from HTML file (Google Takeout format)
  app.post('/api/import/html', mockAuth, async (req: any, res) => {
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
      const skippedVideos = [];
      const failedVideos = [];

      // Process videos in batches to avoid overloading APIs
      for (const historyItem of videos.slice(0, 50)) { // Limit to first 50 videos
        try {
          const videoId = historyItem.videoId;
          
          // Check if video already exists
          const existingVideos = await storage.getUserVideos(userId);
          if (existingVideos.some(v => v.youtubeId === videoId)) {
            skippedVideos.push({ reason: 'Already processed', title: historyItem.title });
            continue; // Skip if already processed
          }

          // Validate video for processing
          const validationResult = await youtubeService.validateVideoForProcessing(videoId);
          
          if (!validationResult.isValid) {
            console.log(`Skipping video ${videoId}: ${validationResult.rejectionReason}`);
            skippedVideos.push({ 
              reason: validationResult.rejectionReason, 
              title: historyItem.title 
            });
            continue;
          }

          // Create video record with validated data
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: validationResult.videoInfo!.title,
            channelName: validationResult.videoInfo!.channelTitle,
            duration: youtubeService.parseDuration(validationResult.videoInfo!.duration),
            thumbnail: validationResult.videoInfo!.thumbnails.medium.url,
            transcript: validationResult.cleanTranscript,
            category: validationResult.category,
          });

          // Generate questions using Claude-optimized content BEFORE saving video
          const generatedQuestions = await anthropicService.generateQuestions(
            validationResult.videoInfo!.title,
            validationResult.claudeOptimizedContent!,
            validationResult.category!,
            5 // Generate 5 questions per video for bulk import
          );


          // Only create video if questions were successfully generated
          const video = await storage.createVideo(videoData);

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
          processedVideos.push({
            ...video,
            questionsGenerated: generatedQuestions.length,
            hasTranscript: true
          });

        } catch (error) {
          console.error(`Error processing video ${historyItem.videoId}:`, error);
          failedVideos.push({ 
            title: historyItem.title, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          // Continue with next video on error
        }
      }

      res.json({ 
        message: `Successfully imported ${processedVideos.length} videos from HTML watch history`,
        processedCount: processedVideos.length,
        skippedCount: skippedVideos.length,
        failedCount: failedVideos.length,
        totalFound: videos.length,
        totalAttempted: videos.slice(0, 50).length,
        videos: processedVideos,
        skipped: skippedVideos.slice(0, 10),
        failed: failedVideos.slice(0, 10)
      });

    } catch (error) {
      console.error("Error importing HTML watch history:", error);
      res.status(500).json({ message: "Failed to import HTML watch history" });
    }
  });

  // Import structured educational video data (JSON format)
  app.post('/api/import/educational-videos', mockAuth, async (req: any, res) => {
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

          // Try to get enhanced content for question generation BEFORE creating video
          let generatedQuestions = [];
          
          try {
            console.log(`Fetching enhanced content for: ${videoItem.title}`);
            const validationResult = await youtubeService.validateVideoForProcessing(videoId);
            
            if (validationResult.isValid && validationResult.claudeOptimizedContent) {
              console.log(`Got enhanced content for: ${videoItem.title}, length: ${validationResult.claudeOptimizedContent.length} chars`);
              // Generate questions using AI with the enhanced content
              console.log(`Generating questions for: ${videoItem.title}`);
              generatedQuestions = await anthropicService.generateQuestions(
                videoItem.title,
                validationResult.claudeOptimizedContent,
                getCategoryName(videoItem.category_id),
                5 // Generate 5 questions per video
              );
              console.log(`Generated ${generatedQuestions.length} questions for: ${videoItem.title}`);
            } else {
              console.log(`Insufficient content for: ${videoItem.title} - skipping video entirely. Reason: ${validationResult.rejectionReason}`);
              skippedVideos.push({ reason: validationResult.rejectionReason || 'No valid transcript', title: videoItem.title });
              continue;
            }


            // Only create video if questions were successfully generated
            const videoData = insertVideoSchema.parse({
              userId,
              youtubeId: videoId,
              title: videoItem.title || 'Educational Video',
              channelName: videoItem.channel_name || 'Unknown Channel',
              duration: videoItem.duration_seconds || 0,
              thumbnail: videoItem.thumbnail_url || '',
              transcript: validationResult.cleanTranscript || '',
              category: getCategoryName(videoItem.category_id),
            });

            const video = await storage.createVideo(videoData);
            console.log(`Created video record for: ${videoItem.title}`);
            
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
            console.log(`Saved ${questionsData.length} questions for: ${videoItem.title}`);
            
            processedVideos.push({
              ...video,
              questionsGenerated: generatedQuestions.length,
              hasTranscript: true
            });
            
          } catch (error) {
            console.error(`Error processing video ${videoItem.title}:`, error);
            skippedVideos.push({ reason: 'Processing error', title: videoItem.title });
            continue;
          }

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
  app.post('/api/automation/create-drive-folder', mockAuth, async (req: any, res) => {
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

  app.get('/api/automation/drive-files/:folderId?', mockAuth, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const files = await googleDriveService.listTakeoutFiles(folderId);
      res.json({ files });
    } catch (error) {
      console.error("Error listing drive files:", error);
      res.status(500).json({ message: "Failed to list drive files" });
    }
  });

  app.post('/api/automation/process-drive-file', mockAuth, async (req: any, res) => {
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
          const validationResult = await youtubeService.validateVideoForProcessing(videoId);
          
          // Validate video passed validation and has content
          if (!validationResult.isValid || !validationResult.claudeOptimizedContent) {
            console.log(`Skipping video ${videoId}: ${validationResult.rejectionReason || 'No valid content'}`);
            continue;
          }

          // Generate questions BEFORE saving video
          const generatedQuestions = await anthropicService.generateQuestions(
            videoInfo.title,
            validationResult.claudeOptimizedContent,
            videoInfo.channelTitle,
            5
          );

          // Validate that exactly 5 questions were generated
          if (!generatedQuestions || generatedQuestions.length !== 5) {
            console.log(`Skipping video ${videoId}: Failed to generate exactly 5 questions. Generated: ${generatedQuestions?.length || 0}`);
            continue;
          }

          // Only create video if questions were successfully generated
          const videoData = insertVideoSchema.parse({
            userId,
            youtubeId: videoId,
            title: videoInfo.title,
            channelName: videoInfo.channelTitle,
            duration: youtubeService.parseDuration(videoInfo.duration),
            thumbnail: videoInfo.thumbnails.medium?.url,
            transcript: validationResult.cleanTranscript || '',
            category: youtubeService.categorizeContent(videoInfo.title, videoInfo.description),
          });

          const video = await storage.createVideo(videoData);

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
