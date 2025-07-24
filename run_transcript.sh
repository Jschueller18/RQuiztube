#!/bin/bash

# Script to run transcript extraction with proper virtual environment handling
# Usage: ./run_transcript.sh <video_id>
# Usage: ./run_transcript.sh --check (for dependency checking)

if [ "$1" = "--check" ]; then
    # Check if packages are available
    if [ -d "transcript_venv" ] && [ -f "transcript_venv/bin/activate" ]; then
        # Use virtual environment
        source transcript_venv/bin/activate
        python -c "import youtube_transcript_api, yt_dlp; print('OK')" 2>/dev/null || echo "PACKAGES_MISSING"
    else
        # Fallback to system python3
        python3 -c "import youtube_transcript_api, yt_dlp; print('OK')" 2>/dev/null || echo "PACKAGES_MISSING"
    fi
    exit 0
fi

VIDEO_ID="$1"

if [ -z "$VIDEO_ID" ]; then
    echo '{"success": false, "error": "No video ID provided"}' >&2
    exit 1
fi

# Try to use virtual environment first, fallback to system python
if [ -d "transcript_venv" ] && [ -f "transcript_venv/bin/activate" ]; then
    # Use virtual environment
    source transcript_venv/bin/activate
    python transcript_extractor.py "$VIDEO_ID"
else
    # Fallback to system python3
    python3 transcript_extractor.py "$VIDEO_ID"
fi