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
    """Extract transcript using youtube-transcript-api (most reliable method)"""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        
        print(f"🔄 Trying youtube-transcript-api for {video_id}", file=sys.stderr)
        
        # Create instance for new API
        transcript_api = YouTubeTranscriptApi()
        
        # Try multiple language preferences with new API
        language_preferences = ['en', 'en-US', 'en-GB']
        
        try:
            # New API: Use .fetch() with language preferences
            transcript_response = transcript_api.fetch(video_id, languages=language_preferences)
            
            if transcript_response:
                # Get raw data from the response
                transcript_data = transcript_response.to_raw_data()
                
                if transcript_data:
                    # Extract text from transcript data
                    transcript_text = ' '.join([item['text'] for item in transcript_data])
                    
                    # Clean and validate
                    clean_text = transcript_text.strip()
                    if len(clean_text) > 100:  # Minimum viable length
                        used_language = getattr(transcript_response, 'language_code', 'unknown')
                        print(f"✅ youtube-transcript-api success ({used_language}): {len(clean_text)} chars", file=sys.stderr)
                        return clean_text
                        
        except Exception as fetch_error:
            print(f"   Fetch with language preferences failed: {str(fetch_error)}", file=sys.stderr)
        
        # Fallback: Try without language specification (auto-generated)
        try:
            transcript_response = transcript_api.fetch(video_id)
            
            if transcript_response:
                transcript_data = transcript_response.to_raw_data()
                
                if transcript_data:
                    transcript_text = ' '.join([item['text'] for item in transcript_data])
                    clean_text = transcript_text.strip()
                    if len(clean_text) > 100:
                        print(f"✅ youtube-transcript-api success (auto): {len(clean_text)} chars", file=sys.stderr)
                        return clean_text
                        
        except Exception as auto_error:
            print(f"   Auto-generated fetch failed: {str(auto_error)}", file=sys.stderr)
            
        raise Exception("No usable transcript found with youtube-transcript-api")
        
    except ImportError:
        raise Exception("youtube-transcript-api not installed")
    except Exception as e:
        raise Exception(f"youtube-transcript-api failed: {str(e)}")

def extract_transcript_ytdlp(video_id: str) -> Optional[str]:
    """Extract transcript using yt-dlp"""
    try:
        import yt_dlp
        
        print(f"🔄 Trying yt-dlp for {video_id}", file=sys.stderr)
        
        # Configure yt-dlp to extract subtitles without downloading video
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en', 'en-US', 'en-GB'],
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            # Use a temporary directory that gets cleaned up
            'outtmpl': '/tmp/%(id)s.%(ext)s',
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # Extract info and subtitles
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                
                # Look for subtitle content in the info
                subtitles = info.get('subtitles', {}) or info.get('automatic_captions', {})
                
                # Try different language codes
                for lang in ['en', 'en-US', 'en-GB', 'en-CA']:
                    if lang in subtitles:
                        subtitle_entries = subtitles[lang]
                        
                        # Find the best subtitle format (prefer vtt, then srt, then ttml)
                        for entry in subtitle_entries:
                            if entry.get('ext') in ['vtt', 'srt', 'ttml']:
                                subtitle_url = entry.get('url')
                                if subtitle_url:
                                    # Download and parse the subtitle file
                                    import urllib.request
                                    try:
                                        with urllib.request.urlopen(subtitle_url) as response:
                                            subtitle_content = response.read().decode('utf-8')
                                            
                                            # Parse based on format
                                            if entry.get('ext') == 'vtt':
                                                text = parse_vtt_content(subtitle_content)
                                            elif entry.get('ext') == 'srt':
                                                text = parse_srt_content(subtitle_content)
                                            else:
                                                text = parse_ttml_content(subtitle_content)
                                            
                                            if len(text) > 100:
                                                print(f"✅ yt-dlp success ({lang}, {entry.get('ext')}): {len(text)} chars", file=sys.stderr)
                                                return text
                                    except Exception as download_error:
                                        print(f"   Failed to download {lang} subtitle: {str(download_error)}", file=sys.stderr)
                                        continue
                
                raise Exception("No usable subtitles found with yt-dlp")
                
            except Exception as extract_error:
                raise Exception(f"yt-dlp extraction failed: {str(extract_error)}")
        
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