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

## ✅ CRITICAL FIXES COMPLETED - STRICT TRANSCRIPT-ONLY VALIDATION

### Fixed: Description Fallback Bug ✅
**COMPLETED:** Removed old `getVideoTranscript()` method from `server/services/youtube.ts` (lines 319-380)
**COMPLETED:** Updated 2 routes that were bypassing validation:
- `/api/import/educational-videos` (line 760) - Now uses `validateVideoForProcessing()`
- `/api/automation/process-drive-file` (line 901) - Now uses `validateVideoForProcessing()`

### Fixed: Video Creation Order Bug ✅
**COMPLETED:** Changed ALL 5 routes from "Save Video → Generate Questions" to "Generate Questions → Save Video":
- Single video processing route (~line 138) ✅
- Bulk history import route (~line 509) ✅
- YouTube history import route (~line 623) ✅
- Educational videos route (~line 755) ✅
- Drive file processing route (~line 914) ✅

### Enhanced: Question Generation Consistency ✅
**COMPLETED:** Improved prompting strategy to consistently generate exactly 5 questions:
- Added explicit count requirements in prompt
- Multiple reinforcement reminders throughout prompt
- Updated system message to emphasize exact count
- Lowered temperature to 0.4 for more consistent results
- Enhanced logging to track question count mismatches

### Result: Strict Transcript-Only System Now Active ✅
- Videos without transcripts are completely rejected (no description fallbacks)
- Only videos with successfully generated questions appear in user libraries
- Clear error messages when videos are rejected
- Consistent validation across all routes

---

## 🚨 CURRENT CRITICAL ISSUE: TRANSCRIPT DETECTION FAILURE

### Issue: youtube-transcript Library Not Working
**Problem:** Current transcript fetching method fails on nearly all videos, even those with working closed captions

**Error Pattern:**
```
Failed to fetch transcript for KdWNS42sf9k: [YoutubeTranscript] 🚨 Transcript is disabled on this video (KdWNS42sf9k)
Insufficient content for: How to Charm Anyone Using This CIA Hack - skipping video entirely. Reason: No transcript available
```

**Current Library:** `youtube-transcript` package
**Status:** Failing on videos that visibly have closed captions working in YouTube interface

**Impact:** 
- Strict validation system now working correctly ✅
- But nearly all videos are being properly rejected due to transcript detection failure ❌
- System correctly rejects videos without transcripts, but fails to detect existing transcripts

### Root Cause Analysis Needed
1. **Library Compatibility**: `youtube-transcript` package may be outdated or incompatible
2. **YouTube API Changes**: YouTube may have changed transcript access methods
3. **Region/Language Issues**: Transcript detection might fail for certain regions/languages
4. **Rate Limiting**: Too many requests might trigger YouTube blocking

### Alternative Solutions to Investigate
1. **Different Libraries**:
   - `youtube-transcript-api`
   - `@distube/ytdl-core` with captions support
   - `node-ytdl-core` with subtitle extraction
   - Direct YouTube API v3 captions endpoint

2. **API Approaches**:
   - YouTube Data API v3 captions.list endpoint
   - YouTube Player API transcript access
   - Alternative transcript scraping methods

3. **Fallback Strategies**:
   - Multiple library attempts in sequence
   - Different language code attempts (en, en-US, auto-generated, etc.)
   - Retry with different video URL formats

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

1. ✅ **COMPLETED: Fix Description Fallback Bug** - Removed old getVideoTranscript method with fallbacks
2. ✅ **COMPLETED: Fix Library Storage Bug** - Videos only saved after successful question generation  
3. ✅ **COMPLETED: Fix Question Generation Consistency** - Enhanced prompting for reliable 5-question output
4. 🚨 **URGENT: Fix Transcript Detection Library** - Current youtube-transcript library fails on most videos
5. **ZIP File Support**: Enable direct upload and parsing of Google Takeout ZIP files
6. **Watch History Persistence**: Store complete watch history for batch processing
7. **Spaced Repetition Interface**: Create dedicated study session UI

---

## 🎯 NEXT AGENT CONTEXT & INSTRUCTIONS

### What Was Just Completed
- ✅ Removed all description fallback mechanisms from the system
- ✅ Fixed video creation order in all 5 routes (questions first, then video save)
- ✅ Enhanced Claude prompting for consistent 5-question generation
- ✅ Strict transcript-only validation system is now properly enforced

### Current System Status
- **Validation System**: Working perfectly - properly rejects videos without transcripts
- **Question Generation**: Enhanced prompting for better consistency  
- **Video Storage**: Only saves videos after successful question generation
- **Problem**: Nearly all videos being rejected due to transcript detection failure

### Critical Issue for Next Agent
The `youtube-transcript` npm package is failing to detect transcripts even on videos with visible closed captions. Error pattern:
```
Failed to fetch transcript for [VIDEO_ID]: [YoutubeTranscript] 🚨 Transcript is disabled on this video
```

**File to Focus On**: `server/services/youtube.ts` - specifically the `getRawTranscript()` method around line 220-320

 