# replit.md

## Overview

QuizTube is a full-stack web application that transforms passive YouTube video consumption into active learning through AI-generated quizzes and spaced repetition algorithms. The application analyzes users' YouTube watch history, generates educational content using AI, and implements a scientifically-backed spaced repetition system to enhance knowledge retention.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and building

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints
- **Middleware**: Express middleware for logging, JSON parsing, and error handling
- **File Structure**: Monorepo structure with shared types and schemas

### Authentication System
- **Provider**: Replit Authentication (OAuth 2.0)
- **Session Management**: Express sessions with PostgreSQL storage
- **Strategy**: Passport.js with OpenID Connect strategy
- **Security**: HTTP-only cookies, CSRF protection, secure session configuration

## Key Components

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (via Neon serverless connection)
- **Migrations**: Drizzle Kit for schema migrations
- **Schema Location**: `/shared/schema.ts` for type-safe database operations

### AI Integration Services
- **OpenAI Service**: GPT-4 integration for question generation from video transcripts
- **YouTube API**: Video metadata extraction and transcript analysis
- **Content Processing**: Automated educational content detection and categorization

### Spaced Repetition System
- **Algorithm**: SuperMemo 2 (SM-2) algorithm implementation
- **Scheduling**: Adaptive review intervals based on user performance
- **Performance Tracking**: Response quality scoring and retention analytics

### Core Features
1. **Video Analysis**: YouTube video import, transcript extraction, and AI-powered question generation
2. **Bulk Data Import**: Support for structured educational video datasets and Google Takeout files
3. **Quiz System**: Interactive quiz interface with multiple choice questions and immediate feedback
4. **Progress Tracking**: Learning analytics, streak tracking, and performance metrics
5. **User Preferences**: Customizable learning goals, categories, and notification settings
6. **Review Scheduling**: Intelligent spaced repetition with due review management

## Data Flow

1. **Authentication Flow**: User authenticates via Replit OAuth → Session creation → User profile management
2. **Content Ingestion**: YouTube URL input → Video metadata extraction → Transcript analysis → AI question generation
3. **Bulk Import Flow**: Educational video data upload → Quality filtering → Batch processing → Question generation
4. **Quiz Flow**: Quiz session creation → Question presentation → Response recording → Performance evaluation
5. **Spaced Repetition**: Performance analysis → Next review calculation → Schedule updates → Due review notifications
6. **Analytics**: Response aggregation → Performance metrics → Progress visualization

## External Dependencies

### Third-Party Services
- **Replit Authentication**: User identity and session management
- **OpenAI API**: AI-powered question generation (GPT-4/Claude Sonnet)
- **YouTube Data API**: Video metadata, transcripts, and content analysis
- **Neon PostgreSQL**: Serverless database hosting

### Key Libraries
- **UI/UX**: @radix-ui/* components, Tailwind CSS, Lucide React icons
- **Data Fetching**: @tanstack/react-query for server state management
- **Forms**: react-hook-form with @hookform/resolvers for validation
- **Database**: drizzle-orm, @neondatabase/serverless
- **Authentication**: passport, openid-client, express-session
- **Utilities**: zod for schema validation, nanoid for ID generation

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Backend**: tsx for TypeScript execution in development
- **Database**: Direct connection to Neon PostgreSQL
- **Environment**: Replit-specific development tooling and debugging

### Production Build
- **Frontend**: Vite build process generating optimized static assets
- **Backend**: esbuild bundling Node.js application for production
- **Assets**: Static file serving through Express
- **Database**: PostgreSQL connection via environment variables

### Environment Configuration
- **Required Variables**: DATABASE_URL, OPENAI_API_KEY, YOUTUBE_API_KEY, SESSION_SECRET
- **Replit Integration**: REPL_ID, REPLIT_DOMAINS for authentication
- **Optional**: ISSUER_URL for custom OIDC configuration

## Changelog

Changelog:
- July 2, 2025. Converted from in-memory storage to PostgreSQL database for data persistence
- June 30, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.