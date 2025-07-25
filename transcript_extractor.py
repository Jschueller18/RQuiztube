#!/usr/bin/env python3
"""
Python transcript extraction script using youtube-transcript-api and yt-dlp
This script provides reliable transcript extraction as a fallback for the Node.js methods
"""

import sys
import json
import argparse
from typing import Optional, Dict, Any

def extract_transcript_youtube_api(video_id: str) -> Optional[str]:
    """Extract transcript using youtube-transcript-api v1.2.1 (correct modern API)"""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        
        print(f"🔄 Trying youtube-transcript-api v1.2.1 for {video_id}", file=sys.stderr)
        
        # Create API instance (modern API requires instance)
        api = YouTubeTranscriptApi()
        
        # Method 1: Try with language preferences using .fetch()
        try:
            print(f"   Trying .fetch() with language preferences", file=sys.stderr)
            transcript_list = api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
            
            if transcript_list:
                # Extract text from transcript list
                transcript_text = ' '.join([item['text'] for item in transcript_list])
                
                # Clean and validate
                clean_text = transcript_text.strip()
                if len(clean_text) > 100:  # Minimum viable length
                    print(f"✅ youtube-transcript-api success (.fetch with langs): {len(clean_text)} chars", file=sys.stderr)
                    return clean_text
                        
        except Exception as fetch_error:
            error_msg = str(fetch_error)
            print(f"   .fetch() with languages failed: {error_msg}", file=sys.stderr)
            
            # Check if it's an IP blocking issue
            if 'blocking requests from your IP' in error_msg or 'cloud provider' in error_msg:
                print(f"   🚫 Cloud IP blocked by YouTube - trying alternative approach", file=sys.stderr)
        
        # Method 2: Try .fetch() without language specification
        try:
            print(f"   Trying .fetch() without language specification", file=sys.stderr)
            transcript_list = api.fetch(video_id)
            
            if transcript_list:
                transcript_text = ' '.join([item['text'] for item in transcript_list])
                clean_text = transcript_text.strip()
                if len(clean_text) > 100:
                    print(f"✅ youtube-transcript-api success (.fetch auto): {len(clean_text)} chars", file=sys.stderr)
                    return clean_text
                        
        except Exception as auto_error:
            error_msg = str(auto_error)
            print(f"   .fetch() auto failed: {error_msg}", file=sys.stderr)
            
            if 'blocking requests from your IP' in error_msg or 'cloud provider' in error_msg:
                print(f"   🚫 All YouTube API methods blocked - falling back to yt-dlp", file=sys.stderr)
        
        # Method 3: Try using .list() and .find_transcript() approach
        try:
            print(f"   Trying .list() and .find_transcript() approach", file=sys.stderr)
            transcripts = api.list(video_id)
            transcript = transcripts.find_transcript(['en', 'en-US', 'en-GB'])
            transcript_list = transcript.fetch()
            
            if transcript_list:
                transcript_text = ' '.join([item['text'] for item in transcript_list])
                clean_text = transcript_text.strip()
                if len(clean_text) > 100:
                    print(f"✅ youtube-transcript-api success (.list/.find): {len(clean_text)} chars", file=sys.stderr)
                    return clean_text
                    
        except Exception as list_error:
            error_msg = str(list_error)
            print(f"   .list()/.find_transcript() failed: {error_msg}", file=sys.stderr)
            
        raise Exception("All youtube-transcript-api methods failed")
        
    except ImportError:
        raise Exception("youtube-transcript-api not installed")
    except Exception as e:
        error_msg = str(e)
        if 'blocking requests from your IP' in error_msg or 'cloud provider' in error_msg:
            raise Exception(f"YouTube blocked cloud IP - trying alternative methods: {error_msg}")
        raise Exception(f"youtube-transcript-api failed: {error_msg}")

def extract_transcript_ytdlp(video_id: str) -> Optional[str]:
    """Extract transcript using yt-dlp with cloud-friendly configuration"""
    try:
        import yt_dlp
        
        print(f"🔄 Trying yt-dlp for {video_id}", file=sys.stderr)
        
        # Configure multiple yt-dlp strategies to avoid bot detection
        strategies = [
            # Strategy 1: Minimal approach with delays
            {
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en', 'en-US', 'en-GB'],
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
                'sleep_interval': 5,
                'max_sleep_interval': 15,
                'retries': 2,
                'outtmpl': '/tmp/%(id)s.%(ext)s',
            },
            # Strategy 2: Browser-like headers with longer delays
            {
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': ['en', 'en-US', 'en-GB'],
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'max-age=0',
                },
                'sleep_interval': 10,
                'max_sleep_interval': 30,
                'retries': 1,
                'outtmpl': '/tmp/%(id)s.%(ext)s',
            }
        ]
        
        for i, ydl_opts in enumerate(strategies, 1):
            print(f"   Trying yt-dlp strategy {i}/{len(strategies)}", file=sys.stderr)
            
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Extract info and subtitles
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                    
                    # Look for subtitle content in the info
                    subtitles = info.get('subtitles', {}) or info.get('automatic_captions', {})
                    
                    if not subtitles:
                        print(f"   Strategy {i}: No subtitles found in video info", file=sys.stderr)
                        continue
                    
                    # Try different language codes
                    for lang in ['en', 'en-US', 'en-GB', 'en-CA']:
                        if lang in subtitles:
                            subtitle_entries = subtitles[lang]
                            print(f"   Strategy {i}: Found {len(subtitle_entries)} subtitle entries for {lang}", file=sys.stderr)
                            
                            # Find the best subtitle format (prefer vtt, then srt, then ttml)
                            for entry in subtitle_entries:
                                if entry.get('ext') in ['vtt', 'srt', 'ttml']:
                                    subtitle_url = entry.get('url')
                                    if subtitle_url:
                                        # Download and parse the subtitle file
                                        import urllib.request
                                        try:
                                            # Use custom headers for subtitle download too
                                            req = urllib.request.Request(subtitle_url)
                                            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
                                            
                                            with urllib.request.urlopen(req) as response:
                                                subtitle_content = response.read().decode('utf-8')
                                                
                                                # Parse based on format
                                                if entry.get('ext') == 'vtt':
                                                    text = parse_vtt_content(subtitle_content)
                                                elif entry.get('ext') == 'srt':
                                                    text = parse_srt_content(subtitle_content)
                                                else:
                                                    text = parse_ttml_content(subtitle_content)
                                                
                                                if len(text) > 100:
                                                    print(f"✅ yt-dlp success (strategy {i}, {lang}, {entry.get('ext')}): {len(text)} chars", file=sys.stderr)
                                                    return text
                                        except Exception as download_error:
                                            print(f"   Strategy {i}: Failed to download {lang} subtitle: {str(download_error)}", file=sys.stderr)
                                            continue
                    
                    print(f"   Strategy {i}: No usable subtitles found", file=sys.stderr)
                    
            except Exception as strategy_error:
                error_msg = str(strategy_error)
                print(f"   Strategy {i} failed: {error_msg}", file=sys.stderr)
                
                if 'Sign in to confirm you\'re not a bot' in error_msg:
                    print(f"   Strategy {i}: Bot detection triggered", file=sys.stderr)
                elif 'Private video' in error_msg or 'Video unavailable' in error_msg:
                    print(f"   Strategy {i}: Video access restricted", file=sys.stderr)
                    break  # Don't try other strategies for restricted videos
                
                continue
        
        raise Exception("All yt-dlp strategies failed")
        
    except ImportError:
        raise Exception("yt-dlp not installed")
    except Exception as e:
        raise Exception(f"yt-dlp failed: {str(e)}")

def parse_vtt_content(vtt_content: str) -> str:
    """Parse WebVTT subtitle content"""
    lines = vtt_content.split('\n')
    text_lines = []
    
    for line in lines:
        line = line.strip()
        # Skip WEBVTT header, timestamps, and empty lines
        if (line.startswith('WEBVTT') or 
            '-->' in line or 
            line == '' or 
            line.startswith('NOTE') or
            line.startswith('STYLE')):
            continue
        
        # Remove WebVTT formatting tags
        clean_line = line
        clean_line = clean_line.replace('<c>', '').replace('</c>', '')
        clean_line = clean_line.replace('<v>', '').replace('</v>', '')
        
        if clean_line.strip():
            text_lines.append(clean_line.strip())
    
    return ' '.join(text_lines)

def parse_srt_content(srt_content: str) -> str:
    """Parse SRT subtitle content"""
    lines = srt_content.split('\n')
    text_lines = []
    
    for line in lines:
        line = line.strip()
        # Skip sequence numbers and timestamps
        if line.isdigit() or '-->' in line or line == '':
            continue
        text_lines.append(line)
    
    return ' '.join(text_lines)

def parse_ttml_content(ttml_content: str) -> str:
    """Parse TTML subtitle content"""
    import re
    # Extract text content from TTML XML
    text_matches = re.findall(r'<p[^>]*>(.*?)</p>', ttml_content, re.DOTALL)
    
    text_lines = []
    for match in text_matches:
        # Remove XML tags and clean up
        clean_text = re.sub(r'<[^>]+>', '', match)
        clean_text = clean_text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        if clean_text.strip():
            text_lines.append(clean_text.strip())
    
    return ' '.join(text_lines)

def extract_transcript(video_id: str) -> Dict[str, Any]:
    """
    Main function to extract transcript using multiple methods in fallback order
    Returns a dictionary with success status, transcript text, and method used
    """
    result = {
        'success': False,
        'transcript': None,
        'method': None,
        'error': None,
        'length': 0
    }
    
    # Method 1: youtube-transcript-api (most reliable)
    try:
        transcript = extract_transcript_youtube_api(video_id)
        if transcript and len(transcript) > 100:
            result.update({
                'success': True,
                'transcript': transcript,
                'method': 'youtube-transcript-api',
                'length': len(transcript)
            })
            return result
    except Exception as e:
        print(f"❌ youtube-transcript-api failed: {str(e)}", file=sys.stderr)
    
    # Method 2: yt-dlp
    try:
        transcript = extract_transcript_ytdlp(video_id)
        if transcript and len(transcript) > 100:
            result.update({
                'success': True,
                'transcript': transcript,
                'method': 'yt-dlp',
                'length': len(transcript)
            })
            return result
    except Exception as e:
        print(f"❌ yt-dlp failed: {str(e)}", file=sys.stderr)
    
    # All methods failed
    result['error'] = 'All transcript extraction methods failed'
    return result

def main():
    parser = argparse.ArgumentParser(description='Extract YouTube video transcripts')
    parser.add_argument('video_id', help='YouTube video ID (11 characters)')
    parser.add_argument('--format', choices=['json', 'text'], default='json',
                       help='Output format (default: json)')
    
    args = parser.parse_args()
    
    # Validate video ID
    if len(args.video_id) != 11:
        print(json.dumps({'success': False, 'error': 'Invalid video ID format'}))
        sys.exit(1)
    
    # Extract transcript
    result = extract_transcript(args.video_id)
    
    if args.format == 'json':
        print(json.dumps(result, indent=2))
    else:
        if result['success']:
            print(result['transcript'])
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    main()