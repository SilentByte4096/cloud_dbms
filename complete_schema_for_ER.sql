-- ============================================
-- STUDY HUB COMPLETE DATABASE SCHEMA
-- For ER Diagram Generation
-- ============================================

-- ============================================
-- 1. USER MANAGEMENT TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('student', 'teacher', 'admin')),
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. EDUCATIONAL STRUCTURE TABLES
-- ============================================

-- Subjects table
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chapters table
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, name)
);

-- Classes table
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_students INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class enrollments table
CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(class_id, student_id)
);

-- ============================================
-- 3. RESOURCES TABLES
-- ============================================

-- Resources table
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'video', 'code', 'document', 'other')),
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    is_official BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class-Resource junction table
CREATE TABLE class_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID NOT NULL REFERENCES profiles(id),
    UNIQUE(class_id, resource_id)
);

-- Resource comments table
CREATE TABLE resource_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES resource_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource votes table
CREATE TABLE resource_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_id, user_id)
);

-- ============================================
-- 4. ASSIGNMENTS & SUBMISSIONS TABLES
-- ============================================

-- Assignments table
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('homework', 'quiz', 'project', 'test', 'flashcard')),
    max_points INTEGER NOT NULL DEFAULT 100,
    due_date TIMESTAMPTZ NOT NULL,
    is_published BOOLEAN DEFAULT true,
    allow_late_submission BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_late BOOLEAN DEFAULT false,
    UNIQUE(assignment_id, student_id)
);

-- Grades table
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id),
    points DECIMAL(5,2) NOT NULL,
    max_points DECIMAL(5,2) NOT NULL,
    percentage DECIMAL(5,2) GENERATED ALWAYS AS (points / NULLIF(max_points, 0) * 100) STORED,
    feedback TEXT,
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id)
);

-- ============================================
-- 5. FLASHCARDS TABLES
-- ============================================

-- Flashcard sets table
CREATE TABLE flashcard_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    is_public BOOLEAN DEFAULT false,
    card_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual flashcards table
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    hint TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcard-Assignment junction table
CREATE TABLE flashcard_assignment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    flashcard_set_id UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, flashcard_set_id)
);

-- Flashcard attempts table (for assignments)
CREATE TABLE flashcard_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    flashcard_set_id UUID NOT NULL REFERENCES flashcard_sets(id),
    score DECIMAL(5,2),
    total_cards INTEGER,
    correct_answers INTEGER,
    time_spent_seconds INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(assignment_id, student_id)
);

-- Individual flashcard attempt items
CREATE TABLE flashcard_attempt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES flashcard_attempts(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_answer TEXT,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. STUDY TRACKING TABLES
-- ============================================

-- Study sessions table
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    flashcard_set_id UUID REFERENCES flashcard_sets(id) ON DELETE SET NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('reading', 'flashcards', 'video', 'practice', 'pomodoro')),
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study goals table
CREATE TABLE study_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_hours_per_week INTEGER,
    target_sessions_per_week INTEGER,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TESTING TABLES
-- ============================================

-- Tests table
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    test_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    max_points INTEGER NOT NULL DEFAULT 100,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test submissions table
CREATE TABLE test_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    answers JSONB,
    score DECIMAL(5,2),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    time_taken_minutes INTEGER,
    UNIQUE(test_id, student_id)
);

-- Test grades table
CREATE TABLE test_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_submission_id UUID NOT NULL REFERENCES test_submissions(id) ON DELETE CASCADE,
    graded_by UUID NOT NULL REFERENCES profiles(id),
    points DECIMAL(5,2) NOT NULL,
    feedback TEXT,
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_submission_id)
);

-- ============================================
-- 8. GRADE TRACKING TABLES
-- ============================================

-- Grade items table (for custom grading categories)
CREATE TABLE grade_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('assignment', 'test', 'quiz', 'participation', 'project', 'other')),
    weight DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    max_points DECIMAL(7,2) NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student grade items table
CREATE TABLE student_grade_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_item_id UUID NOT NULL REFERENCES grade_items(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points DECIMAL(7,2) NOT NULL,
    feedback TEXT,
    graded_by UUID REFERENCES profiles(id),
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(grade_item_id, student_id)
);

-- ============================================
-- 9. NOTIFICATION TABLES
-- ============================================

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'assignment', 'grade', 'comment')),
    related_id UUID,
    related_type TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. AI ASSISTANT TABLES
-- ============================================

-- AI generations table
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('summary', 'flashcards', 'study_plan', 'quiz')),
    input_text TEXT,
    output_content JSONB NOT NULL,
    model_used TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. VIEWS FOR REPORTING
-- ============================================

-- Student grades view
CREATE OR REPLACE VIEW student_grades AS
SELECT 
    ce.student_id,
    ce.class_id,
    c.name as class_name,
    COUNT(DISTINCT a.id) as total_assignments,
    COUNT(DISTINCT s.id) as submitted_assignments,
    AVG(g.percentage) as assignment_avg,
    COUNT(DISTINCT t.id) as total_tests,
    COUNT(DISTINCT ts.id) as submitted_tests,
    AVG(tg.points / t.max_points * 100) as test_avg,
    COUNT(DISTINCT fa.id) as flashcard_attempts,
    AVG(fa.score) as flashcard_avg
FROM class_enrollments ce
JOIN classes c ON ce.class_id = c.id
LEFT JOIN assignments a ON a.class_id = c.id
LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ce.student_id
LEFT JOIN grades g ON g.submission_id = s.id
LEFT JOIN tests t ON t.class_id = c.id
LEFT JOIN test_submissions ts ON ts.test_id = t.id AND ts.student_id = ce.student_id
LEFT JOIN test_grades tg ON tg.test_submission_id = ts.id
LEFT JOIN flashcard_attempts fa ON fa.student_id = ce.student_id
WHERE ce.is_active = true
GROUP BY ce.student_id, ce.class_id, c.name;

-- Student overall GPA view
CREATE OR REPLACE VIEW student_gpa AS
SELECT 
    student_id,
    COUNT(DISTINCT class_id) as total_classes,
    AVG((assignment_avg * 0.4 + COALESCE(test_avg, 0) * 0.4 + COALESCE(flashcard_avg, 0) * 0.2)) as overall_gpa
FROM student_grades
GROUP BY student_id;

-- Teacher dashboard stats view
CREATE OR REPLACE VIEW teacher_stats AS
SELECT 
    c.teacher_id,
    COUNT(DISTINCT c.id) as total_classes,
    COUNT(DISTINCT ce.student_id) as total_students,
    COUNT(DISTINCT a.id) as total_assignments,
    COUNT(DISTINCT r.id) as total_resources,
    COUNT(DISTINCT t.id) as total_tests
FROM classes c
LEFT JOIN class_enrollments ce ON ce.class_id = c.id AND ce.is_active = true
LEFT JOIN assignments a ON a.class_id = c.id
LEFT JOIN class_resources cr ON cr.class_id = c.id
LEFT JOIN resources r ON r.id = cr.resource_id
LEFT JOIN tests t ON t.class_id = c.id
GROUP BY c.teacher_id;

-- ============================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================

-- User-related indexes
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Class-related indexes
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_class_code ON classes(class_code);
CREATE INDEX idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX idx_class_enrollments_class_id ON class_enrollments(class_id);

-- Resource-related indexes
CREATE INDEX idx_resources_user_id ON resources(user_id);
CREATE INDEX idx_resources_subject_id ON resources(subject_id);
CREATE INDEX idx_class_resources_class_id ON class_resources(class_id);
CREATE INDEX idx_class_resources_resource_id ON class_resources(resource_id);
CREATE INDEX idx_resource_comments_resource_id ON resource_comments(resource_id);

-- Assignment-related indexes
CREATE INDEX idx_assignments_class_id ON assignments(class_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON submissions(student_id);
CREATE INDEX idx_grades_submission_id ON grades(submission_id);

-- Flashcard-related indexes
CREATE INDEX idx_flashcard_sets_user_id ON flashcard_sets(user_id);
CREATE INDEX idx_flashcards_set_id ON flashcards(set_id);
CREATE INDEX idx_flashcard_attempts_student_id ON flashcard_attempts(student_id);
CREATE INDEX idx_flashcard_attempts_assignment_id ON flashcard_attempts(assignment_id);

-- Study session indexes
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_started_at ON study_sessions(started_at);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- END OF SCHEMA
-- ============================================