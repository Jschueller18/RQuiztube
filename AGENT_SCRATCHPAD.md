# RQuiztube Development Scratchpad

## Current Codebase Analysis

**Technology Stack:**
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- Backend: Express.js + TypeScript + Drizzle ORM + PostgreSQL
- AI Services: OpenAI GPT-4o for question generation
- Authentication: Currently disabled (mock auth for Railway deployment)
- Storage: PostgreSQL with Drizzle ORM
- Deployment: Railway platform

**Current Features Working:**
- Single YouTube video analysis and quiz generation
- Bulk import from Google Takeout watch history files
- Structured educational video data import (JSON format)
- Basic spaced repetition algorithm implementation
- Quiz session management with scoring
- Video library management with search/filtering
- Progress tracking and analytics

---

## Task Analysis & Requirements

### Task 1: Improve Question Quality & Focus on Important Learnings

**Current State:**
- OpenAI service uses GPT-4o to generate questions from video transcripts
- Current prompt focuses on general comprehension but doesn't explicitly avoid trivial details
- Questions may include minor details like guest names, book authors, specific dates

**What Needs to Change:**
- Questions should target the most important/interesting learnings from videos
- Avoid small details like who wrote a certain book or guest appearances
- Focus on core concepts, actionable insights, and main learning objectives
- Better content analysis to identify what matters most

**Key Files Involved:**
- `server/services/openai.ts` - Question generation logic
- Need enhanced prompting strategy
- Possibly new content analysis service

---

### Task 2: Raw History File Upload & Parsing System

**Current State:**
- Basic watch history import exists for structured formats (JSON/HTML)
- Limited to specific Google Takeout formats
- No direct handling of raw/ZIP files

**What Needs to Change:**
- Users should be able to input their raw history files directly
- System must parse files for educational content above 3 minutes in length
- Process first 50 videos automatically as it does now
- Support various export formats and raw ZIP files

**Key Requirements:**
- Multi-format file support (ZIP, JSON, HTML, etc.)
- Duration filtering (3+ minutes for educational content)
- Educational content detection and filtering
- Robust parsing for different YouTube export formats

**Key Files Involved:**
- `client/src/components/watch-history-import.tsx` - UI enhancement needed
- `server/routes.ts` - New file processing endpoints
- New file parsing service needed

---

### Task 3: Next 50 Videos System & Persistent Storage

**Current State:**
- Only processes first 50 videos from uploaded files
- Users must re-upload files to get more videos processed (does not work if the same 50 videos still come first)
- Watch history data is not persistently stored

**What Needs to Change:**
- System should download/store user's complete watch history document
- Allow users to request processing of next 50 videos without re-upload
- Persistent storage of original watch history for future processing
- Pagination system for large watch histories

**Key Requirements:**
- Database storage for complete watch history
- Pagination/batch processing interface
- Progress tracking for video processing
- "Load next 50" functionality

**Key Files Involved:**
- `shared/schema.ts` - New database tables needed
- `server/storage.ts` - Watch history storage methods
- New watch history management components
- Enhanced UI for batch processing

---

### Task 4: Enhanced Spaced Repetition System

**Current State:**
- Basic SM-2 algorithm implemented in `SpacedRepetitionService`
- Questions scheduled for review but no dedicated study interface
- Only brings back individual questions, not all questions for a video
- Limited integration with main app flow

**What Needs to Change:**
- When a video comes up for spaced repetition review, bring ALL questions generated for that video
- Dedicated study section for reviewing due content
- Better scheduling that considers video-level learning
- Integration with main navigation and user flow

**Key Requirements:**
- Video-based review sessions (not just individual questions)
- Dedicated study/review interface
- Enhanced scheduling algorithm
- Study progress tracking

**Key Files Involved:**
- `server/services/spaced-repetition.ts` - Enhanced algorithm
- `client/src/pages/study.tsx` - New study page needed
- `client/src/components/navigation.tsx` - Add study section
- New review session components

---

### Task 5: Authentication System Restoration

**Current State:**
- Replit Auth system disabled for Railway deployment
- Mock authentication with single test user (`railway-test-user`)
- All users share the same data
- No user registration or login flow

**What Needs to Change:**
- Restore proper user authentication system
- User registration and login functionality
- Proper user data isolation
- Session management and security

**Key Requirements:**
- Choose authentication strategy (custom auth, OAuth, etc.)
- User registration/login pages
- Replace mock authentication throughout codebase
- Secure user data separation

**Key Files Involved:**
- `server/routes.ts` - Remove mock auth, implement real auth
- `client/src/hooks/useAuth.ts` - Real authentication logic
- `client/src/App.tsx` - Protected routes
- New authentication pages and components needed

---

### Task 6: Paywall System & User Tiers

**Current State:**
- No user tiers or limits
- All users have unlimited access to video processing
- No payment or subscription system

**What Needs to Change:**
- Free users limited to most recent 20 videos only
- Full/premium users have no limit
- Payment system for upgrading to premium
- Usage tracking and enforcement

**Key Requirements:**
- User subscription tiers (free vs premium)
- Payment processing integration
- Usage limits and tracking
- Upgrade flow and billing management

**Key Database Changes Needed:**
- User subscription status and limits
- Usage tracking per user
- Payment/billing history

**Key Files Involved:**
- `shared/schema.ts` - User subscription fields
- `server/routes.ts` - Usage limit checks
- New subscription management pages
- Payment integration service

---

## Priority Assessment

### High Priority (Core Functionality)
1. **Task 1: Question Quality** - Directly impacts learning effectiveness
2. **Task 5: Authentication** - Required for proper user separation
3. **Task 6: Basic Paywall** - Business model and resource management

### Medium Priority (User Experience)
4. **Task 2: Raw File Processing** - Improves onboarding experience
5. **Task 3: Next 50 Videos** - Completes the file processing workflow

### Lower Priority (Advanced Features)
6. **Task 4: Enhanced Spaced Repetition** - Learning optimization feature

---

## Technical Challenges to Consider

### File Processing
- Large file handling and processing
- Multiple format support
- Error handling for corrupted or invalid files

### Scalability
- AI API rate limits and costs
- Database performance with large datasets
- File storage and management

### User Experience
- Progress indication for long-running processes
- Graceful error handling and user feedback
- Mobile responsiveness for all new features

### Security
- File upload security
- User data privacy
- Payment processing security

---

## Current Architecture Assessment

**Strengths:**
- Well-structured React + TypeScript frontend
- Clean separation of concerns with services
- Good database schema foundation
- Existing AI integration working well

**Areas for Improvement:**
- Authentication system needs complete overhaul
- File processing capabilities are limited
- Spaced repetition features underutilized
- No user management or billing system

**Key Dependencies Missing:**
- Payment processing service (Stripe, etc.)
- File processing libraries
- Authentication libraries
- Email services for user management

This analysis provides the foundation for implementing each task while maintaining the current architecture and user experience standards. 