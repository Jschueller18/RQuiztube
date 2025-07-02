# QuizTube: AI-Powered YouTube Learning Platform - Cursor Specifications

## Project Overview

QuizTube is a full-stack web application that transforms passive YouTube video consumption into active learning through AI-generated quizzes and spaced repetition algorithms. The platform analyzes YouTube videos, generates educational content using AI, and implements scientifically-backed spaced repetition to enhance knowledge retention.

### Vision
Convert any YouTube educational content into an interactive learning experience with personalized quiz generation, progress tracking, and intelligent review scheduling.

## Technical Architecture

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with Hot Module Replacement (HMR)
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) v5 for server state
- **UI Framework**: 
  - Tailwind CSS for styling
  - shadcn/ui component library (Radix UI primitives)
  - Lucide React for icons
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: CSS variables for theming, responsive design

### Backend Stack
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth with Passport.js (OpenID Connect)
- **Session Management**: Express sessions with PostgreSQL storage
- **Build**: esbuild for production bundling

### AI & External Services
- **OpenAI API**: GPT-4 for question generation from video transcripts
- **YouTube Data API**: Video metadata extraction and transcript analysis
- **Google Drive API**: Watch history import functionality
- **Neon PostgreSQL**: Serverless database hosting

## Core Features & Functionality

### 1. Authentication System
- **Provider**: Replit OAuth 2.0 authentication
- **Session Management**: HTTP-only cookies with CSRF protection
- **User Profiles**: Preference management and learning goals

### 2. Video Content Processing
- **YouTube Integration**: 
  - URL parsing and video ID extraction
  - Metadata retrieval (title, description, duration, thumbnails)
  - Transcript extraction and analysis
- **Content Categorization**: AI-powered subject classification
- **Bulk Import**: Google Takeout watch history processing

### 3. AI-Powered Quiz Generation
- **Question Generation**: OpenAI GPT-4 integration for creating educational questions
- **Question Types**: Multiple choice questions with varying difficulty levels
- **Content Analysis**: Transcript processing for relevant quiz material
- **Quality Control**: Intelligent filtering and validation

### 4. Spaced Repetition Learning System
- **Algorithm**: SuperMemo 2 (SM-2) implementation
- **Adaptive Scheduling**: Performance-based review intervals
- **Quality Scoring**: Response time and accuracy analysis
- **Review Management**: Due date tracking and notification system

### 5. Progress Analytics
- **Performance Metrics**: 
  - Total videos processed
  - Quiz completion rates
  - Average scores and retention rates
  - Learning streaks
- **Visualization**: Charts and graphs for progress tracking
- **Category Performance**: Subject-specific analytics

### 6. User Interface Pages
- **Landing Page**: Unauthenticated entry point with feature overview
- **Dashboard**: Main hub showing recent activity and due reviews
- **Quiz Interface**: Interactive question-answer sessions
- **Analytics**: Comprehensive progress visualization
- **Settings**: User preferences and learning configuration
- **Video Input**: URL submission and bulk import interface

## Database Schema

### Core Tables
- **users**: User profiles, preferences, and authentication data
- **videos**: YouTube video metadata and processing status
- **questions**: AI-generated quiz questions with difficulty levels
- **quiz_sessions**: Individual quiz attempt records
- **question_responses**: User answers and performance data
- **review_schedule**: Spaced repetition scheduling data
- **sessions**: Express session storage

### Data Relationships
- Users have many videos, quiz sessions, and review schedules
- Videos have many questions and quiz sessions
- Quiz sessions contain multiple question responses
- Questions are linked to review schedules for spaced repetition

## API Structure

### Authentication Endpoints
- `GET /api/auth/user` - Get current user session
- `POST /api/auth/login` - Initiate OAuth login
- `POST /api/auth/logout` - Terminate user session

### Video Management
- `POST /api/videos` - Process new YouTube video
- `GET /api/videos` - List user's processed videos
- `GET /api/videos/:id` - Get specific video details

### Quiz System
- `POST /api/quiz/sessions` - Create new quiz session
- `GET /api/quiz/sessions/:id` - Get quiz session details
- `POST /api/quiz/responses` - Submit quiz answers
- `GET /api/questions/:videoId` - Get questions for a video

### Analytics & Progress
- `GET /api/analytics/stats` - Get user performance statistics
- `GET /api/analytics/reviews` - Get due reviews for spaced repetition
- `PATCH /api/users/preferences` - Update user learning preferences

### Import & Automation
- `POST /api/import/watch-history` - Process Google Takeout data
- `POST /api/automation/setup` - Configure automatic processing

## Development Guidelines

### Code Organization
```
├── client/src/                 # Frontend React application
│   ├── components/            # Reusable UI components
│   ├── pages/                # Route-based page components
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Utilities and configurations
├── server/                   # Backend Express application
│   ├── services/             # External API integrations
│   └── routes.ts            # API endpoint definitions
├── shared/                   # Shared types and schemas
└── database migrations via Drizzle Kit
```

### Styling Standards
- Use Tailwind CSS utility classes
- Implement dark/light mode with CSS variables
- Follow shadcn/ui component patterns
- Responsive design with mobile-first approach

### State Management Patterns
- TanStack Query for server state with cache invalidation
- React Hook Form for form state management
- Local component state for UI interactions
- Zod schemas for type-safe validation

### Error Handling
- Comprehensive error boundaries
- API error responses with proper HTTP status codes
- User-friendly error messages
- Loading states and skeleton components

## Environment Configuration

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API access token
- `YOUTUBE_API_KEY`: YouTube Data API credentials
- `SESSION_SECRET`: Express session encryption key

### Replit-Specific Variables
- `REPL_ID`: Replit environment identifier
- `REPLIT_DOMAINS`: Domain configuration for authentication
- `ISSUER_URL`: Optional custom OIDC configuration

## Deployment & Infrastructure

### Development Environment
- Replit workspace with hot reload
- PostgreSQL database via Neon serverless
- Vite development server with proxy configuration
- TypeScript compilation with tsx

### Production Build
- Vite optimized frontend bundle
- esbuild Node.js backend compilation
- Static asset serving through Express
- Database migrations via Drizzle Kit

### Performance Considerations
- Code splitting and lazy loading
- Database query optimization
- API response caching
- Image optimization for video thumbnails

## Security Measures

### Authentication Security
- OAuth 2.0 with secure token handling
- HTTP-only session cookies
- CSRF protection middleware
- Secure session configuration

### Data Protection
- Input validation with Zod schemas
- SQL injection prevention through ORM
- Rate limiting on API endpoints
- Environment variable protection

## Testing Strategy

### Frontend Testing
- Component unit tests with React Testing Library
- Integration tests for user workflows
- Form validation testing
- Accessibility compliance testing

### Backend Testing
- API endpoint testing
- Database operation testing
- Authentication flow testing
- External service integration mocking

## Documentation Requirements

### Code Documentation
- TypeScript interfaces and type definitions
- Component prop documentation
- API endpoint documentation
- Database schema documentation

### User Documentation
- Feature usage guides
- Setup and configuration instructions
- Troubleshooting common issues
- API usage examples

## Future Enhancements

### Planned Features
- Mobile application development
- Advanced analytics and reporting
- Social learning features and sharing
- Integration with other educational platforms
- Offline quiz capability
- Advanced question types (fill-in-blank, short answer)

### Scalability Considerations
- Database performance optimization
- Caching layer implementation
- Microservices architecture evaluation
- CDN integration for static assets

## Development Workflow

### Git Workflow
- Feature branch development
- Pull request reviews
- Automated testing pipeline
- Continuous integration/deployment

### Code Quality
- ESLint and Prettier configuration
- TypeScript strict mode enforcement
- Pre-commit hooks for code formatting
- Regular dependency updates

---

*This specification document serves as a comprehensive guide for development work on the QuizTube platform. It should be updated as the project evolves and new features are implemented.*