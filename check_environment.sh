#!/bin/bash

echo "=== Environment Check ==="
echo "Python version: $(python3 --version 2>/dev/null || echo 'NOT FOUND')"
echo "Pip version: $(pip3 --version 2>/dev/null || echo 'NOT FOUND')"

echo ""
echo "=== Virtual Environment ==="
if [ -d "transcript_venv" ]; then
    echo "✅ transcript_venv directory exists"
    if [ -f "transcript_venv/bin/python" ]; then
        echo "✅ Virtual environment python exists"
        echo "Venv python version: $(transcript_venv/bin/python --version 2>/dev/null || echo 'ERROR')"
    else
        echo "❌ Virtual environment python not found"
    fi
    
    if [ -f "transcript_venv/bin/pip" ]; then
        echo "✅ Virtual environment pip exists"
        echo "Installed packages in venv:"
        transcript_venv/bin/pip list 2>/dev/null || echo "❌ Could not list packages"
    else
        echo "❌ Virtual environment pip not found"
    fi
else
    echo "❌ transcript_venv directory not found"
fi

echo ""
echo "=== Package Import Test ==="
echo "Testing youtube-transcript-api import:"
transcript_venv/bin/python -c "import youtube_transcript_api; print('✅ youtube-transcript-api OK')" 2>/dev/null || echo "❌ youtube-transcript-api FAILED"

echo "Testing yt-dlp import:"
transcript_venv/bin/python -c "import yt_dlp; print('✅ yt-dlp OK')" 2>/dev/null || echo "❌ yt-dlp FAILED"

echo ""
echo "=== Files Check ==="
echo "transcript_extractor.py exists: $([ -f 'transcript_extractor.py' ] && echo '✅ YES' || echo '❌ NO')"
echo "run_transcript.sh exists: $([ -f 'run_transcript.sh' ] && echo '✅ YES' || echo '❌ NO')"
echo "run_transcript.sh executable: $([ -x 'run_transcript.sh' ] && echo '✅ YES' || echo '❌ NO')"
echo "transcript_extractor.py executable: $([ -x 'transcript_extractor.py' ] && echo '✅ YES' || echo '❌ NO')"

echo ""
echo "=== End Environment Check ==="