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

## 🚨 CRITICAL ISSUES TO RESOLVE - CURRENT DEPLOYMENT PROBLEMS

### Issue 1: System Still Falling Back to Descriptions Despite Validation
**Problem:** Despite having validation system, the logs show:
```
Error fetching transcript for FR22XT07nLk: YoutubeTranscriptDisabledError
Falling back to video description for FR22XT07nLk
Prepared description content: 3421 characters
Using enhanced video description: 3421 characters
```

**Root Cause IDENTIFIED:** Two methods exist in YouTube service:
- `getRawTranscript()` - New validation method (no fallbacks) ✅
- `getVideoTranscript()` - Old method with description fallbacks ❌

**Routes NOT Using Validation (FOUND):**
1. **`/api/import/educational-videos`** (line ~760) - Educational video import
2. **`/api/automation/process-drive-file`** (line ~901) - Google Drive file processing

**Routes CORRECTLY Using Validation:**
1. **`/api/videos/analyze`** (line 117) - Single video analysis ✅
2. **`/api/import-watch-history`** (line 485) - Watch history import ✅ 
3. **`/api/import/html`** (line 600) - HTML watch history import ✅

**Two-Method Problem:**
- Routes call `youtubeService.getVideoTranscript(videoId)` (old method with fallbacks)
- Should call `youtubeService.validateVideoForProcessing(videoId)` (new validation system)

**Video Creation Without Validation:**
- Line 755: `const video = await storage.createVideo(videoData);` (educational import)
- Line 914: `const video = await storage.createVideo(videoData);` (drive processing)
- These bypass validation entirely and create videos with description-based content

### Issue 2: Videos Added to Library Without Questions
**Problem:** Videos are being added to the user library even when question generation fails
**Impact:** Users see videos in their library but cannot quiz themselves on them

**Current Pattern (PROBLEMATIC):**
1. `const video = await storage.createVideo(videoData);` - Video saved FIRST
2. `const generatedQuestions = await anthropicService.generateQuestions(...)` - Questions attempted AFTER
3. If question generation fails, video remains in library without questions

**Found in Routes:**
- `/api/videos/analyze` (line 138) ❌
- `/api/import-watch-history` (line 509) ❌ 
- `/api/import/html` (line 623) ❌
- `/api/import/educational-videos` (line 755) ❌
- `/api/automation/process-drive-file` (line 914) ❌

**Solution Required:**
- Videos should only be saved AFTER successful question generation
- Use database transactions or check question count before saving video

### Issue 3: Question Count Not Consistently 5
**Problem:** Generated quizzes have fewer than 5 questions despite setting count=5
**Possible Causes:**
- Claude returning fewer questions due to content quality
- Validation filtering out questions
- API limits or content length issues
**Action Required:**
- Investigate why Claude returns fewer than requested questions
- Add retry logic if fewer than 5 questions generated
- Consider breaking content into chunks if length is the issue

### Issue 4: Poor Transcript Detection for Videos with Working CC
**Problem:** The youtube-transcript library fails to detect transcripts for videos that clearly have closed captions available
**Evidence:** Videos with "perfectly working CC" show up as no transcript available
**Impact:** Many educational videos with good transcripts are being rejected
**Action Required:**
- Investigate alternative transcript fetching methods
- Test different libraries (youtube-transcript alternatives)
- Consider multiple fallback transcript sources
- Add logging to understand why transcript detection fails

### Issue 5: Integration Problems - Changes Not Reflecting in Deployment
**Problem:** Despite code changes, the deployed site behavior hasn't changed
**Possible Causes:**
- Railway deployment cache issues
- Build process not including changes
- Environment variable configuration
**Action Required:**
- Verify Railway deployment logs
- Check if build process is working correctly
- Ensure environment variables are set properly

---

## 🔧 COMPREHENSIVE SCOPE ANALYSIS

### Files Requiring Critical Updates

**1. `server/services/youtube.ts`**
- **Remove:** `getVideoTranscript()` method entirely (lines 319-380)
- **Keep:** `getRawTranscript()` and `validateVideoForProcessing()` methods
- **Remove:** All description fallback logic in the old method

**2. `server/routes.ts` - Route Updates Required**
- **Line ~760:** `/api/import/educational-videos` - Replace `getVideoTranscript()` with validation
- **Line ~901:** `/api/automation/process-drive-file` - Replace `getVideoTranscript()` with validation
- **All routes:** Change video creation order (questions first, then video)

**3. Video Creation Pattern (ALL ROUTES)**
Current problematic pattern in ALL 5 routes:
```javascript
const video = await storage.createVideo(videoData);        // ❌ Save first
const questions = await anthropicService.generateQuestions(...); // ❌ Questions after
```

Required pattern:
```javascript
const questions = await anthropicService.generateQuestions(...); // ✅ Questions first
if (questions.length < 5) throw new Error("Insufficient questions");  // ✅ Validate count
const video = await storage.createVideo(videoData);        // ✅ Save only if successful
```

### Validation System Status
- **3 routes using validation correctly** ✅
- **2 routes bypassing validation completely** ❌
- **5 routes with wrong video creation order** ❌
- **1 old method with fallbacks still exists** ❌

### Youtube Transcript Library Investigation Needed
- Current library: `youtube-transcript` fails on videos with working CC
- Alternative libraries to test:
  - `youtube-transcript-api`
  - `@distube/ytdl-core` with captions
  - Direct YouTube API captions endpoint
- Need to understand why transcript detection fails

---

## IMMEDIATE ACTION PLAN

### Phase 1: Critical Bug Fixes (Agent Priority)
1. **Fix Description Fallback Bug** - Find and remove all description fallback code
2. **Fix Library Storage Bug** - Only save videos with successful question generation
3. **Investigate Transcript Detection** - Find why CC videos aren't detected

### Phase 2: Quality Improvements (Next Agent)
1. **Improve Transcript Detection** - Test alternative libraries/methods
2. **Fix Question Count Issue** - Ensure consistent 5-question generation
3. **Deployment Verification** - Confirm changes actually deploy

### Phase 3: Content Quality (Future Agent)
1. **Question Quality Enhancement** - Improve Claude prompts
2. **Better Content Preparation** - Optimize transcript processing
3. **Advanced Validation** - More sophisticated educational content detection

---

## Next Priority Tasks

1. **URGENT: Fix Description Fallback Bug** - Videos without transcripts should be rejected, not processed
2. **URGENT: Fix Library Storage Bug** - No videos in library without questions
3. **URGENT: Improve Transcript Detection** - Find why youtube-transcript library fails
4. **ZIP File Support**: Enable direct upload and parsing of Google Takeout ZIP files
5. **Watch History Persistence**: Store complete watch history for batch processing
6. **Spaced Repetition Interface**: Create dedicated study session UI

 