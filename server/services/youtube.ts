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

export class YouTubeService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (!this.apiKey) {
      console.warn("YouTube API key not provided - using fallback mode");
    }
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
      if (!this.apiKey) {
        // Fallback mode - return sample educational content
        return `Sample educational content for demonstration. In this video, we explore the fundamentals of web development, covering HTML, CSS, and JavaScript. We start by understanding the structure of a webpage with HTML elements, then move on to styling with CSS properties and selectors. Finally, we dive into JavaScript programming concepts including variables, functions, and event handling. This comprehensive tutorial provides practical examples and best practices for modern web development.`;
      }

      // For this implementation, we'll use a simplified approach
      // In production, you'd use youtube-transcript library or similar
      const videoInfo = await this.getVideoInfo(videoId);
      
      // Fallback to description if transcript isn't available
      // In a real implementation, you'd fetch actual captions/transcripts
      return videoInfo.description || "No transcript available for this video.";
    } catch (error) {
      console.error("Error fetching transcript:", error);
      return "Transcript not available.";
    }
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
