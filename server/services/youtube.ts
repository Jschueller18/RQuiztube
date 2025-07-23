interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  duration: string;
  thumbnails: {
    medium: { url: string };
  };
}

interface YouTubeTranscript {
  text: string;
  start: number;
  duration: number;
}

interface VideoValidationResult {
  isValid: boolean;
  videoInfo?: YouTubeVideoInfo;
  cleanTranscript?: string;
  claudeOptimizedContent?: string;
  category?: string;
  rejectionReason?: string;
}

export class YouTubeService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (!this.apiKey) {
      console.warn("YouTube API key not provided - using fallback mode");
    }
  }

  /**
   * Comprehensive video validation that ensures video meets all requirements before processing
   * This method should be called BEFORE any video is added to the library or sent to Claude
   */
  async validateVideoForProcessing(videoId: string): Promise<VideoValidationResult> {
    try {
      console.log(`Validating video ${videoId} for processing...`);

      // Step 1: Get video information
      const videoInfo = await this.getVideoInfo(videoId);
      
      // Step 2: Check video duration (minimum 3 minutes for educational content)
      const durationSeconds = this.parseDuration(videoInfo.duration);
      if (durationSeconds < 180) { // 3 minutes minimum
        return {
          isValid: false,
          rejectionReason: `Video too short: ${Math.floor(durationSeconds / 60)} minutes (minimum 3 minutes required for educational content)`
        };
      }

      // Step 3: Attempt to fetch transcript (REQUIRED)
      const rawTranscript = await this.getRawTranscript(videoId);
      if (!rawTranscript) {
        return {
          isValid: false,
          rejectionReason: "No transcript available - transcript is required for question generation"
        };
      }

      // Step 4: Clean and validate transcript quality
      const cleanTranscript = this.cleanTranscript(rawTranscript);
      if (cleanTranscript.length < 500) {
        return {
          isValid: false,
          rejectionReason: `Transcript too short: ${cleanTranscript.length} characters (minimum 500 characters required)`
        };
      }

      // Step 5: Check for educational content indicators
      if (!this.hasEducationalContent(videoInfo.title, videoInfo.description, cleanTranscript)) {
        return {
          isValid: false,
          rejectionReason: "Content does not appear to be educational in nature"
        };
      }

      // Step 6: Generate Claude-optimized content
      const claudeOptimizedContent = this.prepareOptimizedContentForClaude(videoInfo, cleanTranscript);
      if (!claudeOptimizedContent) {
        return {
          isValid: false,
          rejectionReason: "Failed to prepare content for AI processing"
        };
      }

      // Step 7: Categorize content
      const category = this.categorizeContent(videoInfo.title, videoInfo.description);

      console.log(`Video ${videoId} passed validation - ${cleanTranscript.length} char transcript, ${category} category`);

      return {
        isValid: true,
        videoInfo,
        cleanTranscript,
        claudeOptimizedContent,
        category
      };

    } catch (error) {
      console.error(`Error validating video ${videoId}:`, error);
      return {
        isValid: false,
        rejectionReason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Fetch raw transcript without any processing or fallbacks
   * Returns null if transcript is not available - no fallback to description
   */
  private async getRawTranscript(videoId: string): Promise<string | null> {
    try {
      console.log(`Fetching raw transcript for video: ${videoId}`);
      
      // Try to import youtube-transcript dynamically
      let YoutubeTranscript;
      try {
        const module = await import('youtube-transcript');
        YoutubeTranscript = module.YoutubeTranscript;
      } catch (importError) {
        console.error("Failed to import youtube-transcript:", importError);
        return null;
      }

      // Fetch actual transcript from YouTube
      const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcriptArray || transcriptArray.length === 0) {
        console.log(`No transcript available for video ${videoId}`);
        return null;
      }

      // Convert transcript array to raw text
      const rawTranscript = transcriptArray
        .map((item: any) => item.text)
        .join(' ');

      console.log(`Successfully fetched raw transcript for ${videoId}: ${rawTranscript.length} characters`);
      return rawTranscript;

    } catch (error) {
      console.log(`Failed to fetch transcript for ${videoId}:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Clean transcript for optimal processing
   */
  private cleanTranscript(rawTranscript: string): string {
    return rawTranscript
      .replace(/\[.*?\]/g, '') // Remove [Music], [Applause] etc.
      .replace(/\(.*?\)/g, '') // Remove (inaudible), (crosstalk) etc.
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.{2,}/g, '.') // Normalize multiple periods
      .replace(/[^\w\s.,!?;:\-'"]/g, '') // Remove special characters but keep basic punctuation
      .trim();
  }

  /**
   * Check if content appears to be educational
   */
  private hasEducationalContent(title: string, description: string, transcript: string): boolean {
    const content = (title + " " + description + " " + transcript.substring(0, 1000)).toLowerCase();
    
    // Educational indicators
    const educationalKeywords = [
      'learn', 'tutorial', 'explain', 'how to', 'guide', 'lesson', 'course', 'training',
      'education', 'teach', 'demonstrate', 'understand', 'concept', 'theory', 'method',
      'technique', 'strategy', 'principle', 'fundamental', 'basic', 'advanced',
      'introduction', 'overview', 'deep dive', 'analysis', 'review', 'explained',
      'science', 'technology', 'programming', 'business', 'finance', 'mathematics',
      'history', 'psychology', 'philosophy', 'research', 'study', 'knowledge'
    ];

    // Non-educational indicators (red flags)
    const nonEducationalKeywords = [
      'reaction', 'funny', 'comedy', 'prank', 'challenge', 'vlog', 'haul',
      'unboxing', 'gaming', 'gameplay', 'let\'s play', 'stream', 'live',
      'music video', 'song', 'dance', 'entertainment', 'gossip', 'drama'
    ];

    const hasEducationalIndicators = educationalKeywords.some(keyword => content.includes(keyword));
    const hasNonEducationalIndicators = nonEducationalKeywords.some(keyword => content.includes(keyword));

    // Must have educational indicators and should not have strong non-educational indicators
    return hasEducationalIndicators && !hasNonEducationalIndicators;
  }

  /**
   * Prepare optimized content specifically for Claude
   */
  private prepareOptimizedContentForClaude(videoInfo: YouTubeVideoInfo, cleanTranscript: string): string | null {
    const title = videoInfo.title;
    const description = videoInfo.description || '';
    const channelName = videoInfo.channelTitle;
    const duration = this.parseDuration(videoInfo.duration);

    // Clean description for context
    const cleanDescription = description
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/\n\s*\n/g, '\n') // Normalize line breaks
      .replace(/Follow us on.*$/gim, '') // Remove social media follows
      .replace(/Subscribe.*$/gim, '') // Remove subscribe requests
      .replace(/Like and.*$/gim, '') // Remove like requests
      .replace(/Check out.*$/gim, '') // Remove promotional content
      .replace(/Timestamps:[\s\S]*$/gim, '') // Remove timestamp sections
      .replace(/Chapters:[\s\S]*$/gim, '') // Remove chapter sections
      .trim();

    // Optimize transcript length for Claude (target: 4000-6000 characters for best results)
    const maxTranscriptLength = 6000;
    let optimizedTranscript = cleanTranscript;
    
    if (cleanTranscript.length > maxTranscriptLength) {
      // Intelligent truncation: try to break at sentence boundaries
      const truncated = cleanTranscript.substring(0, maxTranscriptLength);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > maxTranscriptLength * 0.8) {
        optimizedTranscript = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        optimizedTranscript = truncated + '...';
      }
    }

    // Structure content for optimal Claude processing
    const claudeContent = `EDUCATIONAL VIDEO ANALYSIS:

Title: "${title}"
Creator: ${channelName}
Duration: ${Math.floor(duration / 60)} minutes
Category: Educational Content

CORE LEARNING CONTENT:
${optimizedTranscript}

CONTEXTUAL INFORMATION:
${cleanDescription ? cleanDescription.substring(0, 300) + (cleanDescription.length > 300 ? '...' : '') : 'No additional context provided.'}

CONTENT FOCUS:
This video provides educational content that should be analyzed for key concepts, actionable insights, and important learning objectives. Focus on the main ideas and practical knowledge that viewers can apply.`;

    // Final validation
    if (claudeContent.length < 800) {
      console.log(`Claude content too short: ${claudeContent.length} characters`);
      return null;
    }

    console.log(`Prepared optimized content for Claude: ${claudeContent.length} characters`);
    return claudeContent;
  }

  async getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
    if (!this.apiKey) {
      // Fallback mode - return mock data for demonstration
      return {
        id: videoId,
        title: "Sample Educational Video",
        description: "This is a sample video for demonstration purposes. In production, this would contain the actual video description from YouTube.",
        channelTitle: "Educational Channel",
        duration: "PT10M30S", // 10 minutes 30 seconds
        thumbnails: {
          medium: { url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` }
        },
      };
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${this.apiKey}&part=snippet,contentDetails`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found");
    }

    const video = data.items[0];
    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channelTitle: video.snippet.channelTitle,
      duration: video.contentDetails.duration,
      thumbnails: video.snippet.thumbnails,
    };
  }

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async getVideoTranscript(videoId: string): Promise<string> {
    try {
      console.log(`Fetching real transcript for video: ${videoId}`);
      
      // Try to import youtube-transcript dynamically to handle potential ESM issues
      let YoutubeTranscript;
      try {
        const module = await import('youtube-transcript');
        YoutubeTranscript = module.YoutubeTranscript;
      } catch (importError) {
        console.error("Failed to import youtube-transcript:", importError);
        throw new Error("Transcript library not available");
      }

      // Fetch actual transcript from YouTube
      const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcriptArray || transcriptArray.length === 0) {
        throw new Error("No transcript data returned");
      }

      // Convert transcript array to clean text
      const rawTranscript = transcriptArray
        .map((item: any) => item.text)
        .join(' ')
        .replace(/\[.*?\]/g, '') // Remove [Music], [Applause] etc.
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      console.log(`Successfully fetched transcript for ${videoId}: ${rawTranscript.length} characters`);
      
      // Get video info to enhance the transcript with context
      try {
        const videoInfo = await this.getVideoInfo(videoId);
        const enhancedContent = this.prepareContentForClaude(videoInfo, 'transcript', rawTranscript);
        return enhancedContent;
      } catch (contextError) {
        console.log("Failed to get video context, using raw transcript");
        return rawTranscript;
      }

    } catch (error) {
      console.error(`Error fetching transcript for ${videoId}:`, error);
      
      // Fallback to enhanced video description when transcript is not available
      try {
        console.log(`Falling back to video description for ${videoId}`);
        const videoInfo = await this.getVideoInfo(videoId);
        const enhancedContent = this.prepareContentForClaude(videoInfo, 'description');
        
        if (enhancedContent && enhancedContent.length > 200) {
          console.log(`Using enhanced video description: ${enhancedContent.length} characters`);
          return enhancedContent;
        }
      } catch (descError) {
        console.error("Failed to get video description fallback:", descError);
      }

      // If no good content is available, don't return poor quality content
      // This will be handled gracefully by the question generation system
      console.log(`No suitable content available for ${videoId} - will skip question generation`);
      return null;
    }
  }

  private prepareContentForClaude(videoInfo: any, contentType: 'transcript' | 'description', rawContent?: string): string {
    // Clean and enhance content specifically for Claude to generate better questions
    
    const title = videoInfo.title || 'Unknown Title';
    const description = videoInfo.description || '';
    const channelName = videoInfo.channelTitle || 'Unknown Channel';
    const duration = this.parseDuration(videoInfo.duration || 'PT0S');
    
    let content = '';
    
    if (contentType === 'transcript' && rawContent) {
      // For transcripts, provide structured content with context
      content = `
EDUCATIONAL VIDEO CONTENT:

Title: ${title}
Channel: ${channelName}
Duration: ${Math.floor(duration / 60)} minutes

TRANSCRIPT:
${rawContent}

DESCRIPTION CONTEXT:
${description.substring(0, 500)}${description.length > 500 ? '...' : ''}
      `.trim();
      
    } else if (contentType === 'description') {
      // For description-only content, structure it better for educational question generation
      
      // Clean description from URLs and promotional content
      const cleanDescription = description
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\n\s*\n/g, '\n') // Normalize line breaks
        .replace(/Follow us on.*$/gim, '') // Remove social media follows
        .replace(/Subscribe.*$/gim, '') // Remove subscribe requests
        .replace(/Like and.*$/gim, '') // Remove like requests
        .replace(/Check out.*$/gim, '') // Remove promotional content
        .trim();
      
      if (cleanDescription.length < 200) {
        // If description is too short, this video might not be suitable for questions
        return null;
      }
      
      content = `
EDUCATIONAL VIDEO CONTENT:

Title: ${title}
Channel: ${channelName}  
Duration: ${Math.floor(duration / 60)} minutes

CONTENT SUMMARY:
${cleanDescription}

EDUCATIONAL FOCUS:
This video appears to cover educational content related to: ${title}. 
The content should focus on the main concepts, key insights, and practical applications discussed in the video.
      `.trim();
    }
    
    // Final validation - ensure content is substantial enough for quality questions
    if (content.length < 300) {
      console.log(`Content too short (${content.length} chars) for quality question generation`);
      return null;
    }
    
    console.log(`Prepared ${contentType} content: ${content.length} characters`);
    return content;
  }

  parseDuration(duration: string): number {
    // Parse ISO 8601 duration (PT4M13S -> 253 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    return hours * 3600 + minutes * 60 + seconds;
  }

  categorizeContent(title: string, description: string): string {
    const text = (title + " " + description).toLowerCase();
    
    const categories = {
      programming: ["javascript", "python", "code", "programming", "development", "software", "web", "app", "api", "framework", "react", "node"],
      science: ["science", "physics", "chemistry", "biology", "research", "experiment", "quantum", "space", "astronomy"],
      history: ["history", "historical", "ancient", "war", "civilization", "empire", "century", "timeline"],
      business: ["business", "entrepreneur", "marketing", "finance", "investment", "startup", "economy", "money"],
      mathematics: ["math", "calculus", "algebra", "geometry", "statistics", "equation", "formula"],
      languages: ["language", "grammar", "vocabulary", "pronunciation", "conversation", "fluent"],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return "general";
  }

  /**
   * Parse YouTube watch history from HTML format (Google Takeout)
   * @param htmlContent The HTML content from watch-history.html
   * @returns Array of video entries with titles and URLs
   */
  parseWatchHistoryHTML(htmlContent: string): Array<{title: string, url: string, videoId: string, timestamp?: string}> {
    const videos: Array<{title: string, url: string, videoId: string, timestamp?: string}> = [];
    
    // Look for video links in the HTML content
    // Google Takeout HTML typically contains links like: <a href="https://www.youtube.com/watch?v=VIDEO_ID">Video Title</a>
    const videoLinkRegex = /<a[^>]*href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"[^>]*>([^<]+)<\/a>/g;
    
    let match;
    while ((match = videoLinkRegex.exec(htmlContent)) !== null) {
      const videoId = match[1];
      const title = match[2].trim();
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Avoid duplicates
      if (!videos.some(v => v.videoId === videoId)) {
        videos.push({
          title,
          url,
          videoId,
        });
      }
    }
    
    // Alternative pattern for different HTML structures
    if (videos.length === 0) {
      // Try alternative regex patterns
      const altRegex = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      
      let videoMatch;
      while ((videoMatch = altRegex.exec(htmlContent)) !== null) {
        const videoId = videoMatch[1];
        if (!videos.some(v => v.videoId === videoId)) {
          videos.push({
            title: 'Video from Watch History',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            videoId,
          });
        }
      }
    }
    
    return videos;
  }
}
