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
- **AI Assistant**: Analyze resources to generate summaries, study plans, and flashcards
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
- **HTML5**: Semantic markup structure
- **CSS3**: Modern styling with custom properties and responsive design
- **JavaScript (ES6+)**: Interactive functionality and state management
- **No Framework**: Pure vanilla JavaScript for optimal performance

### Backend & Database
- **Supabase**: Backend-as-a-Service providing:
  - PostgreSQL database
  - Authentication (email/password)
  - Real-time subscriptions
  - Storage for file uploads
  - Row Level Security (RLS)

### Database Schema
- 17+ core tables including profiles, classes, resources, assignments, etc.
- Complex relationships with proper foreign key constraints
- Views for aggregated data (grades, statistics)
- Comprehensive indexing for performance

## 📂 Project Structure

```
Study-Hub/
├── index.html                 # Landing page with login/signup
├── dashboard-student.html     # Student dashboard
├── dashboard-teacher.html     # Teacher dashboard
├── js/
│   ├── auth.js               # Authentication logic
│   ├── student-dashboard.js  # Student dashboard functionality
│   ├── teacher-dashboard.js  # Teacher dashboard functionality
│   ├── supabase-config.js    # Supabase client configuration
│   └── utils.js              # Utility functions
├── styles/
│   ├── main.css              # Global styles
│   └── dashboard.css         # Dashboard-specific styles
├── complete_schema_for_ER.sql # Complete database schema
└── study_hub_schema.dbml      # DBML format for ER diagrams
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
- Fixed resource loading without class_id column dependency
- Implemented class_resources junction table
- Fixed assignment submission modal
- Enhanced flashcard visibility with better contrast
- Added class homepage modal functionality
- Fixed sidebar navigation contrast
- Implemented comment posting system
- Added AI assistant resource selection

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
- **Pomodoro Timer**: 25-min work, 5-min break cycles
- **Session Tracking**: Monitor study time
- **AI Assistant**: Generate study materials from resources

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

## 🚦 Getting Started

1. **Database Setup**: Import `complete_schema_for_ER.sql` into your Supabase project
2. **Configure Supabase**: Update `js/supabase-config.js` with your project URL and anon key
3. **Storage Setup**: Create a bucket named "study-hub" in Supabase Storage
4. **Deploy**: Host the files on any static web server
5. **Test**: Create teacher and student accounts to explore features

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