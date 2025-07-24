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
      if (cleanTranscript.length < 1000) {
        return {
          isValid: false,
          rejectionReason: `Transcript too short: ${cleanTranscript.length} characters (minimum 1000 characters required)`
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
    console.log(`Fetching raw transcript for video: ${videoId}`);
    
    const MIN_TRANSCRIPT_THRESHOLD = 1000; // Minimum viable transcript length for quality quiz generation
    
    // Try multiple transcript sources in order of preference
    // NOTE: Removed getTranscriptFromVideoDescription to prevent fallback to low-quality content
    const methods = [
      () => this.getTranscriptFromPython(videoId), // Try Python methods first (most reliable)
      () => this.getTranscriptFromYouTubeAPI(videoId),
      () => this.getTranscriptFromYoutubeTranscript(videoId),
      () => this.getTranscriptFromYtdlCore(videoId),
      () => this.getTranscriptFromDistube(videoId)
      // getTranscriptFromVideoDescription REMOVED - descriptions are insufficient for quality quiz generation
    ];
    
    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`Trying transcript method ${i + 1}/${methods.length}`);
        const result = await methods[i]();
        
        if (result && result.length >= MIN_TRANSCRIPT_THRESHOLD) {
          console.log(`✅ Successfully fetched transcript using method ${i + 1}: ${result.length} characters`);
          return result;
        } else if (result) {
          console.log(`⚠️  Method ${i + 1} returned content but too short: ${result.length} characters (minimum ${MIN_TRANSCRIPT_THRESHOLD} required)`);
          // Don't accept short transcripts - they won't generate quality quizzes
          continue;
        }
      } catch (error) {
        console.log(`❌ Method ${i + 1} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    console.log(`❌ All transcript methods failed for video ${videoId}`);
    return null;
  }

  private async checkPythonDependencies(): Promise<void> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Check if required Python packages are available
      const checkCommand = 'python3 -c "import youtube_transcript_api, yt_dlp; print(\'OK\')"';
      
      const { stdout, stderr } = await execAsync(checkCommand, {
        timeout: 10000 // 10 second timeout
      });
      
      if (stderr || stdout.trim() !== 'OK') {
        throw new Error(`Python dependencies not available: ${stderr || 'Import failed'}`);
      }
      
      console.log('✅ Python dependencies verified');
      
    } catch (error) {
      throw new Error(`Python dependency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTranscriptFromPython(videoId: string): Promise<string | null> {
    try {
      console.log(`Using Python transcript extraction for ${videoId}`);
      
      // First, verify Python dependencies are available
      await this.checkPythonDependencies();
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Execute the Python script (use system python3 in production)
      const pythonCommand = `python3 transcript_extractor.py ${videoId}`;
      
      const { stdout, stderr } = await execAsync(pythonCommand, {
        cwd: process.cwd(),
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer for large transcripts
      });
      
      if (stderr) {
        console.log(`Python script stderr: ${stderr}`);
      }
      
      if (!stdout.trim()) {
        throw new Error('Python script returned empty output');
      }
      
      // Parse JSON response from Python script
      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (parseError) {
        throw new Error(`Failed to parse Python script output: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }
      
      if (!result.success) {
        throw new Error(`Python extraction failed: ${result.error || 'Unknown error'}`);
      }
      
      const MIN_TRANSCRIPT_THRESHOLD = 1000; // Minimum viable transcript length
      if (!result.transcript || result.transcript.length < MIN_TRANSCRIPT_THRESHOLD) {
        throw new Error(`Python transcript too short: ${result.transcript?.length || 0} characters (minimum ${MIN_TRANSCRIPT_THRESHOLD} required)`);
      }
      
      console.log(`✅ Python extraction success (${result.method}): ${result.length} characters`);
      return result.transcript;
      
    } catch (error) {
      throw new Error(`Python transcript extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTranscriptFromYouTubeAPI(videoId: string): Promise<string | null> {
    if (!this.apiKey) {
      throw new Error('YouTube API key not available for captions');
    }

    try {
      console.log(`Using YouTube Data API v3 captions for ${videoId}`);
      
      // Step 1: List available captions
      const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${this.apiKey}&part=snippet`;
      
      const captionsResponse = await fetch(captionsListUrl);
      if (!captionsResponse.ok) {
        throw new Error(`Captions list API error: ${captionsResponse.status} ${captionsResponse.statusText}`);
      }
      
      const captionsData = await captionsResponse.json() as any;
      
      if (!captionsData.items || captionsData.items.length === 0) {
        throw new Error('No captions available via YouTube API');
      }
      
      console.log(`Found ${captionsData.items.length} caption tracks via API`);
      
      // Step 2: Find the best caption track
      let bestCaption = captionsData.items.find((caption: any) =>
        caption.snippet.language === 'en' && caption.snippet.trackKind === 'standard'
      ) || captionsData.items.find((caption: any) =>
        caption.snippet.language === 'en'
      ) || captionsData.items.find((caption: any) =>
        caption.snippet.language.startsWith('en')
      ) || captionsData.items[0];
      
      console.log(`Using caption: ${bestCaption.snippet.language} - ${bestCaption.snippet.name} (${bestCaption.snippet.trackKind})`);
      
      // Step 3: Download the caption content
      const captionDownloadUrl = `https://www.googleapis.com/youtube/v3/captions/${bestCaption.id}?key=${this.apiKey}&tfmt=srt`;
      
      const captionResponse = await fetch(captionDownloadUrl);
      if (!captionResponse.ok) {
        if (captionResponse.status === 401) {
          throw new Error('Caption download requires OAuth authentication (401 Unauthorized)');
        }
        throw new Error(`Caption download error: ${captionResponse.status} ${captionResponse.statusText}`);
      }
      
      const captionText = await captionResponse.text();
      
      if (!captionText || captionText.length < 50) {
        throw new Error(`Caption content too short or empty: ${captionText.length} chars`);
      }
      
      // Step 4: Parse SRT format and extract text
      const text = this.parseSRTContent(captionText);
      
      if (text.length < 100) {
        throw new Error(`Parsed text too short: ${text.length} chars`);
      }
      
      console.log(`YouTube API success: extracted ${text.length} characters`);
      return text;
      
    } catch (error) {
      throw new Error(`YouTube API captions failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseSRTContent(srtContent: string): string {
    // Parse SRT subtitle format
    // SRT format: sequence number, timecode, text, blank line
    const lines = srtContent.split('\n');
    const textLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip sequence numbers (just numbers)
      if (/^\d+$/.test(line)) {
        continue;
      }
      
      // Skip timecode lines (contain -->)
      if (line.includes('-->')) {
        continue;
      }
      
      // Skip empty lines
      if (line.length === 0) {
        continue;
      }
      
      // This should be subtitle text
      textLines.push(line);
    }
    
    return textLines
      .join(' ')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private async getTranscriptFromYoutubeTranscript(videoId: string): Promise<string | null> {
    try {
      const module = await import('youtube-transcript');
      const YoutubeTranscript = module.YoutubeTranscript;

      // Try multiple language options
      const languageOptions = [
        { lang: 'en' },
        {}, // Default - auto-detect
        { lang: 'en-US' },
        { lang: 'en-GB' }
      ];

      for (const options of languageOptions) {
        try {
          const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId, options);
          
          if (transcriptArray && transcriptArray.length > 0) {
            const rawTranscript = transcriptArray
              .map((item: any) => item.text)
              .filter((text: string) => text && text.trim().length > 0)
              .join(' ');
            
            if (rawTranscript.length > 50) {
              console.log(`youtube-transcript success with options ${JSON.stringify(options)}`);
              return rawTranscript;
            }
          }
        } catch (langError) {
          // Continue to next language option
          continue;
        }
      }
      
      throw new Error('No valid transcript found with any language option');
    } catch (error) {
      throw new Error(`youtube-transcript failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTranscriptFromYtdlCore(videoId: string): Promise<string | null> {
    try {
      const ytdl = await import('ytdl-core');
      const info = await ytdl.default.getInfo(videoId);
      
      const captions = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!captions || captions.length === 0) {
        throw new Error('No caption tracks found');
      }

      // Find the best English caption track
      let bestCaption = captions.find((cap: any) => 
        cap.languageCode === 'en' && cap.kind !== 'asr'
      ) || captions.find((cap: any) => 
        cap.languageCode === 'en'
      ) || captions.find((cap: any) => 
        cap.languageCode.startsWith('en')
      ) || captions[0];

      console.log(`Using caption track: ${bestCaption.languageCode} - ${bestCaption.name?.simpleText || 'Auto-generated'}`);

      // Fetch the caption content
      const response = await fetch(bestCaption.baseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch caption XML: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML to extract text using more robust regex
      const textMatches = xmlText.match(/<text[^>]*>([^<]*(?:<[^\/][^<]*>[^<]*<\/[^>]*>[^<]*)*)<\/text>/g);
      
      if (!textMatches || textMatches.length === 0) {
        throw new Error('No text content found in caption XML');
      }

      const text = textMatches.map(match => {
        // Extract content between text tags
        const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
        
        // Decode HTML entities and clean up
        return content
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num)))
          .replace(/<[^>]*>/g, '') // Remove any remaining tags
          .trim();
      }).filter(t => t.length > 0).join(' ');

      if (text.length < 50) {
        throw new Error(`Extracted text too short: ${text.length} characters`);
      }

      console.log(`ytdl-core success: extracted ${text.length} characters`);
      return text;
      
    } catch (error) {
      throw new Error(`ytdl-core failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTranscriptFromDistube(videoId: string): Promise<string | null> {
    try {
      const ytdlDistube = await import('@distube/ytdl-core');
      const info = await ytdlDistube.default.getInfo(videoId);
      
      const captions = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!captions || captions.length === 0) {
        throw new Error('No caption tracks found');
      }

      // Find the best English caption track
      let bestCaption = captions.find((cap: any) => 
        cap.languageCode === 'en' && cap.kind !== 'asr'
      ) || captions.find((cap: any) => 
        cap.languageCode === 'en'
      ) || captions.find((cap: any) => 
        cap.languageCode.startsWith('en')
      ) || captions[0];

      console.log(`Using @distube caption track: ${bestCaption.languageCode} - ${bestCaption.name?.simpleText || 'Auto-generated'}`);

      // Fetch the caption content
      const response = await fetch(bestCaption.baseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch caption XML: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML to extract text
      const textMatches = xmlText.match(/<text[^>]*>([^<]*(?:<[^\/][^<]*>[^<]*<\/[^>]*>[^<]*)*)<\/text>/g);
      
      if (!textMatches || textMatches.length === 0) {
        throw new Error('No text content found in caption XML');
      }

      const text = textMatches.map(match => {
        const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
        
        return content
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num)))
          .replace(/<[^>]*>/g, '')
          .trim();
      }).filter(t => t.length > 0).join(' ');

      if (text.length < 50) {
        throw new Error(`Extracted text too short: ${text.length} characters`);
      }

      console.log(`@distube/ytdl-core success: extracted ${text.length} characters`);
      return text;
      
    } catch (error) {
      throw new Error(`@distube/ytdl-core failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Prepare optimized content specifically for Claude with proper isolation
   */
  private prepareOptimizedContentForClaude(videoInfo: YouTubeVideoInfo, cleanTranscript: string): string | null {
    const title = videoInfo.title;
    const description = videoInfo.description || '';
    const channelName = videoInfo.channelTitle;
    const duration = this.parseDuration(videoInfo.duration);
    const videoId = videoInfo.id;

    // Generate a unique session ID for this video processing
    const sessionId = `video_${videoId}_${Date.now()}`;

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

    // Structure content for optimal Claude processing with clear isolation
    const claudeContent = `=== EDUCATIONAL VIDEO PROCESSING SESSION ===
SESSION_ID: ${sessionId}
VIDEO_ID: ${videoId}
PROCESSING_TIMESTAMP: ${new Date().toISOString()}

⚠️ CONTEXT ISOLATION: This is a completely independent video analysis. Any previous video content should be ignored.

=== VIDEO METADATA ===
Title: "${title}"
Creator: ${channelName}
Duration: ${Math.floor(duration / 60)} minutes
Category: Educational Content

=== TRANSCRIPT CONTENT START ===
${optimizedTranscript}
=== TRANSCRIPT CONTENT END ===

=== ADDITIONAL CONTEXT ===
${cleanDescription ? cleanDescription.substring(0, 300) + (cleanDescription.length > 300 ? '...' : '') : 'No additional context provided.'}

=== PROCESSING INSTRUCTIONS ===
- Analyze ONLY the transcript content above for this specific video (${videoId})
- Generate questions based solely on the information contained within the transcript boundaries
- Ignore any content from previous videos or sessions
- Focus on key concepts, actionable insights, and learning objectives from this transcript only

=== END SESSION ${sessionId} ===`;

    // Final validation
    if (claudeContent.length < 800) {
      console.log(`Claude content too short: ${claudeContent.length} characters`);
      return null;
    }

    console.log(`Prepared optimized content for Claude (Session: ${sessionId}): ${claudeContent.length} characters`);
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

    const data = await response.json() as any;
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


  private async getTranscriptFromVideoDescription(videoId: string): Promise<string | null> {
    try {
      console.log(`Attempting to extract useful content from video description for ${videoId}`);
      
      // Get video info to access description
      const videoInfo = await this.getVideoInfo(videoId);
      
      if (!videoInfo.description || videoInfo.description.length < 200) {
        throw new Error(`Description too short or empty: ${videoInfo.description?.length || 0} chars`);
      }
      
      // Extract educational content from description
      const description = videoInfo.description;
      
      // Look for structured content in description
      const patterns = [
        // Transcript sections
        /(?:transcript|captions?|subtitles?):\s*(.+?)(?:\n\n|\n(?:[A-Z]|\d+\.)|$)/gis,
        // Summary sections  
        /(?:summary|overview|about):\s*(.+?)(?:\n\n|\n(?:[A-Z]|\d+\.)|$)/gis,
        // Key points/topics
        /(?:topics?|points?|covered|discusses?):\s*(.+?)(?:\n\n|\n(?:[A-Z]|\d+\.)|$)/gis,
        // Learning objectives
        /(?:learn|you.ll|objectives?):\s*(.+?)(?:\n\n|\n(?:[A-Z]|\d+\.)|$)/gis,
        // Outline/agenda
        /(?:outline|agenda|contents?):\s*(.+?)(?:\n\n|\n(?:[A-Z]|\d+\.)|$)/gis,
      ];
      
      let extractedContent = '';
      
      for (const pattern of patterns) {
        const matches = description.matchAll(pattern);
        for (const match of matches) {
          if (match[1]?.trim()) {
            extractedContent += match[1].trim() + '\n\n';
          }
        }
      }
      
      // If no structured content found, try to extract the first meaningful paragraphs
      if (extractedContent.length < 100) {
        const paragraphs = description
          .split('\n\n')
          .filter(p => p.trim().length > 50)
          .filter(p => !p.includes('http'))
          .filter(p => !p.toLowerCase().includes('subscribe'))
          .filter(p => !p.toLowerCase().includes('follow'))
          .filter(p => !p.toLowerCase().includes('like'))
          .slice(0, 3); // Take first 3 meaningful paragraphs
        
        extractedContent = paragraphs.join('\n\n');
      }
      
      // Clean up the extracted content
      const cleanContent = extractedContent
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s.,!?;:\-'"]/g, '') // Remove special characters
        .trim();
      
      if (cleanContent.length < 100) {
        throw new Error(`Extracted content too short: ${cleanContent.length} chars`);
      }
      
      console.log(`Description extraction success: ${cleanContent.length} characters`);
      console.log(`Sample: "${cleanContent.substring(0, 200)}..."`);
      
      return cleanContent;
      
    } catch (error) {
      throw new Error(`Description extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private prepareContentForClaude(videoInfo: any, contentType: 'transcript' | 'description', rawContent?: string): string | null {
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
