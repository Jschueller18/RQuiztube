# RQuiztube Development Scratchpad

## Current Codebase Analysis

**Technology Stack:**
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- Backend: Express.js + TypeScript + Drizzle ORM + PostgreSQL
- AI Services: Claude 3.5 Sonnet for question generation (switched from OpenAI)
- Authentication: Currently disabled (mock auth for Railway deployment)
- Storage: PostgreSQL with Drizzle ORM
- Deployment: Railway platform

**Current Features Working:**
- Single YouTube video analysis and quiz generation
- Bulk import from Google Takeout watch history files
- Structured educational video data import (JSON format)
- **NEW: Comprehensive video validation system**
- **NEW: Claude-optimized content preparation**
- Basic spaced repetition algorithm implementation
- Quiz session management with scoring
- Video library management with search/filtering
- Progress tracking and analytics

---

## COMPLETED: Enhanced Video Validation & Claude Optimization System

### What Was Implemented

**1. Comprehensive Video Validation (`YouTubeService.validateVideoForProcessing`)**
- **Transcript Requirement**: Videos MUST have actual transcripts - no fallback to descriptions
- **Duration Check**: Minimum 3 minutes required for educational content
- **Educational Content Detection**: Keyword analysis to filter non-educational content
- **Quality Validation**: Minimum 500 character transcript after cleaning
- **Early Rejection**: Videos are rejected BEFORE being sent to Claude or added to library

**2. Claude-Optimized Content Preparation**
- **Intelligent Transcript Cleaning**: Removes noise like [Music], (inaudible), special characters
- **Optimal Length Targeting**: 4000-6000 characters for best Claude performance
- **Smart Truncation**: Breaks at sentence boundaries when truncating
- **Structured Context**: Provides Claude with title, creator, duration, and clean transcript
- **Enhanced Descriptions**: Removes promotional content, URLs, timestamps

**3. Updated Processing Flow**
- **Validation First**: All videos go through validation before any processing
- **Detailed Reporting**: Tracks processed, skipped, and failed videos with reasons
- **Better Error Handling**: Specific rejection reasons for each validation failure
- **Claude Receives Only Quality Content**: No more poor quality or irrelevant content

**4. Enhanced User Feedback**
- **Detailed Import Results**: Shows counts of processed, skipped, and failed videos
- **Skip Reason Reporting**: Explains why videos were skipped
- **Clear Expectations**: UI explains transcript and duration requirements

### Key Files Modified
- `server/services/youtube.ts` - Added comprehensive validation system
- `server/services/anthropic.ts` - Updated to use Claude-optimized content
- `server/routes.ts` - Updated all import endpoints to use validation
- `client/src/components/watch-history-import.tsx` - Enhanced user feedback

### Benefits Achieved
1. **Higher Quality Questions**: Claude receives only well-prepared, educational content
2. **No Wasted API Calls**: Videos without transcripts are rejected early
3. **Better User Experience**: Clear feedback on why videos are skipped
4. **Consistent Processing**: All video sources use the same validation pipeline
5. **Educational Focus**: Non-educational content is automatically filtered out

---

## Task Analysis & Requirements

### ✅ Task 1: Improve Question Quality & Focus on Important Learnings - COMPLETED

**What Was Done:**
- Enhanced Claude prompting to focus on core concepts and actionable insights
- Explicit instructions to avoid trivial details (guest names, dates, anecdotes)
- Claude-optimized content preparation ensures clean, structured input
- Validation ensures only educational content reaches Claude

### Task 2: Raw History File Upload & Parsing System

**Current State:**
- Basic watch history import exists for structured formats (JSON/HTML)
- **NEW: Enhanced validation system filters out unsuitable content**
- Support for various export formats

**What Still Needs to Change:**
- Support for ZIP file uploads and extraction
- Better handling of different YouTube export formats
- Direct drag-and-drop file interface

### Task 3: Next 50 Videos System & Persistent Storage

**Current State:**
- **IMPROVED: Now processes up to 50 videos with proper validation**
- **NEW: Detailed reporting of skipped/failed videos**
- Users still must re-upload files to get more videos processed

**What Still Needs to Change:**
- Persistent storage of complete watch history
- "Load next 50" functionality without re-upload
- Progress tracking for large watch histories

### Task 4: Enhanced Spaced Repetition System

**Current State:**
- Basic SM-2 algorithm implemented in `SpacedRepetitionService`
- Questions scheduled for review but limited integration
- **IMPROVED: Higher quality questions due to better validation**

**What Still Needs to Change:**
- Dedicated study interface for spaced repetition
- Video-level review sessions
- Better integration with main app flow

---

## Next Priority Tasks

1. **ZIP File Support**: Enable direct upload and parsing of Google Takeout ZIP files
2. **Watch History Persistence**: Store complete watch history for batch processing
3. **Spaced Repetition Interface**: Create dedicated study session UI
4. **Advanced Analytics**: Track validation metrics and quality improvements 