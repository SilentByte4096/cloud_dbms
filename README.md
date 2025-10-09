# 📚 Study Hub - Educational Management Platform

A comprehensive web-based educational platform that connects students and teachers through an intuitive learning management system. Built with modern web technologies and a focus on user experience.

## 🌟 Overview

Study Hub is a full-featured educational platform designed to facilitate online learning and classroom management. It provides separate dashboards for students and teachers, enabling efficient resource sharing, assignment management, and interactive learning through features like flashcards and AI assistance.

## ✨ Key Features

### 👩‍🎓 Student Dashboard
- **Class Management**: Join classes using unique class codes, view enrolled classes
- **Resource Library**: Access and upload educational resources (documents, videos, notes)
- **Assignment System**: Submit assignments, view grades and feedback
- **Flashcard Learning**: Create personal flashcard sets, complete flashcard assignments
- **Study Timer**: Pomodoro timer for focused study sessions
- **AI Assistant**: Google Gemini-powered analysis of uploaded documents (PDF/DOCX) and URLs to generate summaries, study plans, and flashcards with intelligent content parsing
- **Grade Tracking**: View grades across all classes with detailed breakdowns
- **Commenting System**: Engage with peers through resource comments

### 👨‍🏫 Teacher Dashboard
- **Class Creation**: Create and manage multiple classes with unique join codes
- **Student Management**: View enrolled students, track attendance and performance
- **Resource Management**: Upload official resources, manage class materials
- **Assignment Creation**: Create various assignment types including flashcard assignments
- **Grading System**: Grade submissions, provide feedback, track student progress
- **Analytics**: View class statistics and student performance metrics

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern component-based UI framework (src/ directory)
- **TypeScript**: Type-safe development with modern JS features
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework for rapid styling
- **HTML5**: Semantic markup structure for standalone pages
- **Vanilla JavaScript**: Interactive functionality for dashboard pages
- **ESLint**: Code quality and consistency

### Backend & Database
- **Supabase**: Backend-as-a-Service providing:
  - PostgreSQL database with advanced features
  - Authentication (email/password with role-based access)
  - Real-time subscriptions
  - Storage for file uploads
  - Row Level Security (RLS) policies
- **Node.js**: Server-side JavaScript runtime (server.js)

### External APIs
- **Google Gemini AI**: AI-powered content analysis and generation
- **PDF.js**: Client-side PDF processing
- **Mammoth.js**: DOCX document parsing

### Database Schema
- 17+ core tables including profiles, classes, resources, assignments, etc.
- Complex relationships with proper foreign key constraints
- Views for aggregated data (grades, statistics)
- Comprehensive indexing for performance

## 📂 Project Structure

```
Study-Hub/
├── index.html                    # Landing page with login/signup
├── class.html                    # Class detail page
├── dashboard-student.html        # Student dashboard
├── dashboard-teacher.html        # Teacher dashboard  
├── ai-test.html                  # AI service testing page
├── server.js                     # Node.js server for AI proxy
├── src/                          # React application source
│   ├── App.tsx                   # Main React component
│   ├── main.tsx                  # React app entry point
│   ├── index.css                 # React app styles
│   └── vite-env.d.ts            # Vite type definitions
├── js/                           # Vanilla JS for interactive features
│   ├── auth.js                   # Authentication logic
│   ├── ai-service.js             # AI integration and content analysis
│   ├── class-page.js             # Class page functionality
│   ├── student-dashboard.js      # Student dashboard functionality
│   ├── student-dashboard-fixed.js # Enhanced student dashboard
│   ├── teacher-dashboard.js      # Teacher dashboard functionality 
│   ├── teacher-dashboard-modern.js # Modern teacher dashboard
│   ├── supabase-config.js        # Supabase client configuration
│   └── utils.js                  # Utility functions and helpers
├── styles/                       # CSS stylesheets
│   ├── main.css                  # Global styles
│   ├── dashboard.css             # Dashboard-specific styles
│   ├── dashboard-modern.css      # Modern dashboard theme
│   └── modern-theme.css          # Modern UI theme
├── supabase/                     # Database migrations (removed for cleanup)
├── study_hub_schema.dbml         # DBML format for ER diagrams
├── package.json                  # Node.js dependencies and scripts
├── vite.config.ts               # Vite build configuration
├── tailwind.config.js           # TailwindCSS configuration
├── tsconfig.json                # TypeScript configuration
├── eslint.config.js             # ESLint code quality rules
└── postcss.config.js            # PostCSS processing configuration
```

## 🚀 Current Implementation Status

### ✅ Completed Features

#### Authentication & User Management
- User registration and login
- Role-based access (Student/Teacher)
- Profile management
- Secure session handling

#### Student Features
- Full dashboard with navigation
- Class enrollment via codes
- Resource viewing and uploading
- Assignment submission system
- Flashcard creation and viewing
- Study timer with Pomodoro technique
- AI resource analysis (simulated)
- Grade viewing
- Comment system

#### Teacher Features
- Class creation and management
- Student enrollment tracking
- Resource upload and management
- Assignment creation
- Submission grading
- Class statistics

#### Database & Backend
- Complete schema implementation
- Row Level Security policies
- Storage bucket configuration
- Foreign key relationships
- Performance indexes

### 🔧 Recent Fixes Applied
- **User Role Registration**: Fixed issue where all users defaulted to 'student' role regardless of selection
- **AI Service Integration**: Implemented Google Gemini API with proxy server for secure key management
- **Document Processing**: Added PDF.js and Mammoth.js for client-side document parsing
- **Enhanced Dashboards**: Created modern dashboard variants with improved UI/UX
- **Class Management**: Added dedicated class detail pages with tabbed navigation
- **Build System**: Integrated Vite, TypeScript, and TailwindCSS for modern development
- **Code Quality**: Added ESLint configuration and consistent code formatting
- **Project Cleanup**: Removed redundant SQL files and organized database migrations

## 🎯 Key Functionalities

### Resource Management
- **Upload**: Students and teachers can upload files (PDF, DOC, images, etc.)
- **Categorization**: By subject, chapter, and type
- **Sharing**: Class-specific or personal resources
- **Comments**: Reddit-style comment threads on resources

### Assignment Workflow
1. Teacher creates assignment with due date and points
2. Students view pending assignments
3. Students submit text/file responses
4. Teachers grade and provide feedback
5. Students view grades and feedback

### Flashcard System
- Personal flashcard sets for self-study
- Teacher-assigned flashcard assignments
- Flip animation for interactive learning
- Progress tracking for attempts

### Study Tools
- **Pomodoro Timer**: 25-min work, 5-min break cycles with audio notifications
- **Session Tracking**: Monitor study time with detailed logs
- **AI-Powered Content Analysis**: 
  - Upload PDF/DOCX files for automatic content extraction
  - Analyze web URLs for content summarization
  - Generate comprehensive study plans from educational materials
  - Create personalized flashcard sets from document content
  - Smart content parsing with context-aware summaries

## 🔐 Security Features

- Row Level Security (RLS) policies ensure data isolation
- User authentication via Supabase Auth
- Secure file storage with access controls
- Input validation and sanitization
- Role-based permissions

## 📊 Database Design

The platform uses a PostgreSQL database with:
- **17 main tables** for core functionality
- **3 views** for aggregated reporting
- **30+ indexes** for query optimization
- **Comprehensive foreign key relationships**

Key tables include:
- `profiles` - User information
- `classes` - Course management
- `resources` - Educational materials
- `assignments` - Student work
- `flashcard_sets` - Study materials
- `grades` - Performance tracking

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop and tablet devices
- **Modern Interface**: Clean, intuitive design with consistent styling
- **Interactive Elements**: Smooth transitions and animations
- **Accessibility**: Semantic HTML and ARIA attributes
- **Visual Feedback**: Loading states, success/error notifications

## 🚚 Getting Started

### Prerequisites
- Node.js (v16+) for development and AI server
- Supabase account for backend services
- Google AI Studio API key for Gemini integration

### Setup Instructions
1. **Database Setup**: 
   - Create a new Supabase project
   - Import the schema from `study_hub_schema.dbml` or create tables manually
   - Set up Row Level Security (RLS) policies

2. **Configure Environment**:
   - Update `js/supabase-config.js` with your Supabase project URL and anon key
   - Set up Google AI API key in `server.js` for AI features

3. **Storage Setup**: 
   - Create a storage bucket named "study-hub" in Supabase Storage
   - Configure public access policies for file uploads

4. **Install Dependencies**:
   ```bash
   npm install
   ```

5. **Development Server**:
   ```bash
   # For React app development
   npm run dev
   
   # For AI proxy server
   node server.js
   ```

6. **Production Deploy**: 
   - Build React app: `npm run build`
   - Host static files on any web server
   - Deploy Node.js server for AI functionality

7. **Test**: Create teacher and student accounts to explore all features

## 📈 Future Enhancements

While the platform is fully functional, potential future additions could include:
- Real-time chat and messaging
- Video conferencing integration
- Advanced analytics and reporting
- Mobile app versions
- Quiz and test modules
- Calendar integration
- Notification system
- Dark mode theme

## 🤝 Contributing

This is an educational project demonstrating full-stack web development capabilities. The codebase serves as a reference implementation for building educational platforms.

## 📝 License

This project is for educational and demonstration purposes.

## 🏆 Achievements

This project successfully demonstrates:
- Full-stack web development without frameworks
- Complex database design and implementation
- User authentication and authorization
- File upload and storage handling
- Real-time data synchronization
- Responsive UI/UX design
- Role-based access control
- Interactive learning tools

---

**Note**: This is a demonstration project showcasing web development skills and educational platform architecture. All features have been implemented and tested for functionality.