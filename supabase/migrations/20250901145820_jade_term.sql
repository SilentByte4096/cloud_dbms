/*
# StudyHub Database Schema

## Overview
Complete database schema for the StudyHub application supporting students and teachers.

## New Tables
1. **profiles** - User profiles with roles
2. **classes** - Teacher-created classes
3. **class_enrollments** - Student enrollment in classes
4. **subjects** - Study subjects
5. **chapters** - Chapters within subjects
6. **resources** - Study materials uploaded by users
7. **resource_versions** - Version history for resources
8. **resource_ratings** - Peer ratings for resources
9. **resource_comments** - Comments on resources
10. **assignments** - Teacher-created assignments
11. **submissions** - Student assignment submissions
12. **grades** - Assignment grades and feedback
13. **flashcard_sets** - Flashcard collections
14. **flashcards** - Individual flashcards
15. **study_sessions** - Pomodoro timer sessions
16. **ai_summaries** - AI-generated document summaries

## Security
- Enable RLS on all tables
- Create appropriate policies for students and teachers
- Ensure data isolation between different user roles
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    class_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their classes"
    ON classes FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Students can read classes they're enrolled in"
    ON classes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments 
            WHERE class_id = id AND student_id = auth.uid()
        )
    );

-- Class enrollments
CREATE TABLE IF NOT EXISTS class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can see their class enrollments"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE id = class_id AND teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can see their own enrollments"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Students can enroll in classes"
    ON class_enrollments FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subjects"
    ON subjects FOR SELECT
    TO authenticated
    USING (true);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, name)
);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapters"
    ON chapters FOR SELECT
    TO authenticated
    USING (true);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES subjects(id),
    chapter_id UUID REFERENCES chapters(id),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'code', 'video', 'other')),
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT true,
    rating_avg DECIMAL(2,1) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their resources"
    ON resources FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Anyone can read public resources"
    ON resources FOR SELECT
    TO authenticated
    USING (is_public = true OR user_id = auth.uid());

-- Resource versions table
CREATE TABLE IF NOT EXISTS resource_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID REFERENCES profiles(id),
    upload_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_id, version)
);

ALTER TABLE resource_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read resource versions for accessible resources"
    ON resource_versions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM resources 
            WHERE id = resource_id 
            AND (is_public = true OR user_id = auth.uid())
        )
    );

CREATE POLICY "Resource owners can manage versions"
    ON resource_versions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM resources 
            WHERE id = resource_id AND user_id = auth.uid()
        )
    );

-- Resource ratings table
CREATE TABLE IF NOT EXISTS resource_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_id, user_id)
);

ALTER TABLE resource_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ratings"
    ON resource_ratings FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Anyone can read ratings for public resources"
    ON resource_ratings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM resources 
            WHERE id = resource_id AND is_public = true
        )
    );

-- Resource comments table
CREATE TABLE IF NOT EXISTS resource_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resource_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own comments"
    ON resource_comments FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Anyone can read comments for public resources"
    ON resource_comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM resources 
            WHERE id = resource_id AND is_public = true
        )
    );

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    max_points INTEGER NOT NULL DEFAULT 100,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage assignments for their classes"
    ON assignments FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Students can read assignments for enrolled classes"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments 
            WHERE class_id = assignments.class_id AND student_id = auth.uid()
        )
    );

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their submissions"
    ON submissions FOR ALL
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can read submissions for their assignments"
    ON submissions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM assignments 
            WHERE id = assignment_id AND teacher_id = auth.uid()
        )
    );

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    points DECIMAL(5,2) NOT NULL,
    feedback TEXT,
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage grades for their assignments"
    ON grades FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Students can read their grades"
    ON grades FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM submissions 
            WHERE id = submission_id AND student_id = auth.uid()
        )
    );

-- Flashcard sets table
CREATE TABLE IF NOT EXISTS flashcard_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT,
    description TEXT,
    card_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flashcard_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their flashcard sets"
    ON flashcard_sets FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage flashcards for their sets"
    ON flashcards FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM flashcard_sets 
            WHERE id = set_id AND user_id = auth.uid()
        )
    );

-- Study sessions table (for Pomodoro timer)
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL CHECK (session_type IN ('work', 'break')),
    duration_minutes INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their study sessions"
    ON study_sessions FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- AI summaries table
CREATE TABLE IF NOT EXISTS ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    summary TEXT,
    study_plan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their AI summaries"
    ON ai_summaries FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_chapter ON resources(chapter_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_ratings_resource ON resource_ratings(resource_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user ON flashcard_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(set_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);

-- Insert default subjects and chapters
INSERT INTO subjects (name, description) VALUES 
    ('Mathematics', 'Mathematical concepts and problem solving'),
    ('Computer Science', 'Programming, algorithms, and software development'),
    ('Physics', 'Physical sciences and natural phenomena'),
    ('Chemistry', 'Chemical reactions and molecular science'),
    ('Biology', 'Life sciences and biological systems'),
    ('History', 'Historical events and civilizations'),
    ('Literature', 'Literary works and analysis'),
    ('Business', 'Business principles and management')
ON CONFLICT (name) DO NOTHING;

-- Insert sample chapters for Computer Science
INSERT INTO chapters (subject_id, name, description, order_index) 
SELECT s.id, chapter_name, chapter_desc, chapter_order
FROM subjects s,
(VALUES 
    ('Introduction to Programming', 'Basic programming concepts', 1),
    ('Data Structures', 'Arrays, lists, trees, and graphs', 2),
    ('Algorithms', 'Sorting, searching, and optimization', 3),
    ('Object-Oriented Programming', 'Classes, inheritance, and polymorphism', 4),
    ('Database Systems', 'SQL and database design', 5),
    ('Web Development', 'HTML, CSS, JavaScript, and frameworks', 6),
    ('Software Engineering', 'Development methodologies and best practices', 7),
    ('Computer Networks', 'Network protocols and architecture', 8)
) AS chapters(chapter_name, chapter_desc, chapter_order)
WHERE s.name = 'Computer Science'
ON CONFLICT (subject_id, name) DO NOTHING;

-- Insert sample chapters for Mathematics
INSERT INTO chapters (subject_id, name, description, order_index) 
SELECT s.id, chapter_name, chapter_desc, chapter_order
FROM subjects s,
(VALUES 
    ('Algebra', 'Linear and quadratic equations', 1),
    ('Calculus', 'Derivatives and integrals', 2),
    ('Statistics', 'Data analysis and probability', 3),
    ('Geometry', 'Shapes, angles, and spatial relationships', 4),
    ('Discrete Mathematics', 'Logic, sets, and combinatorics', 5)
) AS chapters(chapter_name, chapter_desc, chapter_order)
WHERE s.name = 'Mathematics'
ON CONFLICT (subject_id, name) DO NOTHING;

-- Functions to update rating averages
CREATE OR REPLACE FUNCTION update_resource_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE resources 
    SET rating_avg = (
        SELECT COALESCE(AVG(rating), 0)::DECIMAL(2,1)
        FROM resource_ratings 
        WHERE resource_id = COALESCE(NEW.resource_id, OLD.resource_id)
    ),
    rating_count = (
        SELECT COUNT(*)
        FROM resource_ratings 
        WHERE resource_id = COALESCE(NEW.resource_id, OLD.resource_id)
    )
    WHERE id = COALESCE(NEW.resource_id, OLD.resource_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update rating averages
DROP TRIGGER IF EXISTS trigger_update_resource_rating ON resource_ratings;
CREATE TRIGGER trigger_update_resource_rating
    AFTER INSERT OR UPDATE OR DELETE ON resource_ratings
    FOR EACH ROW EXECUTE FUNCTION update_resource_rating();

-- Function to update flashcard set counts
CREATE OR REPLACE FUNCTION update_flashcard_set_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE flashcard_sets 
    SET card_count = (
        SELECT COUNT(*)
        FROM flashcards 
        WHERE set_id = COALESCE(NEW.set_id, OLD.set_id)
    )
    WHERE id = COALESCE(NEW.set_id, OLD.set_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update flashcard set counts
DROP TRIGGER IF EXISTS trigger_update_flashcard_set_count ON flashcards;
CREATE TRIGGER trigger_update_flashcard_set_count
    AFTER INSERT OR UPDATE OR DELETE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_flashcard_set_count();