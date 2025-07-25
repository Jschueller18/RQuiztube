#!/usr/bin/env python3
"""
Verification script to ensure all deprecated get_transcript calls are removed
and new API is working correctly
"""

import os
import sys
import re

def check_for_deprecated_calls():
    """Check all Python files for deprecated get_transcript usage"""
    deprecated_found = False
    
    # Files to check (excluding test files that aren't used in production)
    production_files = [
        'transcript_extractor.py'
    ]
    
    print("🔍 Checking for deprecated get_transcript calls...")
    
    for file_path in production_files:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
                
            # Look for deprecated patterns
            deprecated_patterns = [
                r'YouTubeTranscriptApi\.get_transcript',
                r'\.get_transcript\(',
            ]
            
            for pattern in deprecated_patterns:
                matches = re.findall(pattern, content)
                if matches:
                    print(f"❌ DEPRECATED API FOUND in {file_path}: {matches}")
                    deprecated_found = True
                    
            print(f"✅ {file_path} - No deprecated calls found")
        else:
            print(f"⚠️  {file_path} not found")
    
    return deprecated_found

def test_new_api():
    """Test the new API to ensure it works"""
    print("\n🧪 Testing new youtube-transcript-api...")
    
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        
        # Test instance creation
        transcript_api = YouTubeTranscriptApi()
        print("✅ YouTubeTranscriptApi instance created successfully")
        
        # Test a simple video (Rick Roll - known to have transcripts)
        test_video_id = "dQw4w9WgXcQ"
        print(f"🔄 Testing fetch with video: {test_video_id}")
        
        try:
            # Test new API
            transcript_response = transcript_api.fetch(test_video_id, languages=['en', 'en-US', 'en-GB'])
            
            if transcript_response:
                transcript_data = transcript_response.to_raw_data()
                if transcript_data and len(transcript_data) > 0:
                    sample_text = ' '.join([item['text'] for item in transcript_data[:3]])
                    print(f"✅ New API working! Sample: \"{sample_text}...\"")
                    print(f"✅ Total transcript items: {len(transcript_data)}")
                    return True
                else:
                    print("❌ No transcript data returned")
                    return False
            else:
                print("❌ No transcript response")
                return False
                
        except Exception as api_error:
            print(f"❌ New API test failed: {api_error}")
            return False
            
    except ImportError as import_error:
        print(f"❌ Import failed: {import_error}")
        return False
    except Exception as e:
        print(f"❌ API test failed: {e}")
        return False

def main():
    print("=== YouTube Transcript API Migration Verification ===\n")
    
    # Check for deprecated calls
    deprecated_found = check_for_deprecated_calls()
    
    if deprecated_found:
        print("\n❌ MIGRATION FAILED: Deprecated get_transcript calls found!")
        print("Please replace all get_transcript calls with the new .fetch() API")
        sys.exit(1)
    
    # Test new API
    api_working = test_new_api()
    
    if not api_working:
        print("\n❌ MIGRATION FAILED: New API not working correctly!")
        sys.exit(1)
    
    print("\n✅ MIGRATION SUCCESSFUL!")
    print("✅ All deprecated calls removed")  
    print("✅ New API is working correctly")
    print("✅ Ready for production deployment")

if __name__ == '__main__':
    main()