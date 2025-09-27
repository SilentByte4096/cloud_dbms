-- ========================================
-- COMPREHENSIVE DATABASE FIX
-- Fixes RLS policies, storage, and missing tables
-- ========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fix profiles table if user_type column is missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'user_type') THEN
        ALTER TABLE profiles ADD COLUMN user_type TEXT DEFAULT 'student';
    END IF;
END $$;

-- Create subjects table if it doesn't exist
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create chapters table if it doesn't exist
CREATE TABLE IF NOT EXISTS chapters (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(subject_id, name)
);

-- Create resources table if it doesn't exist (fix for 406 error)
CREATE TABLE IF NOT EXISTS resources (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subject_id BIGINT REFERENCES subjects(id) ON DELETE SET NULL,
    chapter_id BIGINT REFERENCES chapters(id) ON DELETE SET NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('notes', 'code', 'video', 'other')),
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    is_official BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create class_resources junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS class_resources (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT REFERENCES classes(id) ON DELETE CASCADE,
    resource_id BIGINT REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(class_id, resource_id)
);

-- Create resource_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS resource_comments (
    id BIGSERIAL PRIMARY KEY,
    resource_id BIGINT REFERENCES resources(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Fix flashcard_sets table structure
CREATE TABLE IF NOT EXISTS flashcard_sets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Fix flashcards table structure
CREATE TABLE IF NOT EXISTS flashcards (
    id BIGSERIAL PRIMARY KEY,
    flashcard_set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ========================================
-- RLS POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Everyone can view subjects" ON subjects;
DROP POLICY IF EXISTS "Users can create subjects" ON subjects;
DROP POLICY IF EXISTS "Everyone can view chapters" ON chapters;
DROP POLICY IF EXISTS "Users can create chapters" ON chapters;
DROP POLICY IF EXISTS "Users can view resources" ON resources;
DROP POLICY IF EXISTS "Users can create resources" ON resources;
DROP POLICY IF EXISTS "Users can update own resources" ON resources;
DROP POLICY IF EXISTS "Users can delete own resources" ON resources;
DROP POLICY IF EXISTS "Users can manage class resources" ON class_resources;
DROP POLICY IF EXISTS "Users can view resource comments" ON resource_comments;
DROP POLICY IF EXISTS "Users can create comments" ON resource_comments;
DROP POLICY IF EXISTS "Users can view flashcard sets" ON flashcard_sets;
DROP POLICY IF EXISTS "Users can manage own flashcard sets" ON flashcard_sets;
DROP POLICY IF EXISTS "Users can view flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can manage flashcards in own sets" ON flashcards;

-- Simple, working RLS policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Everyone can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create subjects" ON subjects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Everyone can view chapters" ON chapters FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create chapters" ON chapters FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view all resources" ON resources FOR SELECT USING (true);
CREATE POLICY "Users can create resources" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resources" ON resources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own resources" ON resources FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view class resources" ON class_resources FOR SELECT USING (true);
CREATE POLICY "Users can manage class resources" ON class_resources FOR ALL USING (
    EXISTS (
        SELECT 1 FROM classes c 
        WHERE c.id = class_resources.class_id 
        AND (c.teacher_id = auth.uid() OR EXISTS (
            SELECT 1 FROM class_enrollments ce 
            WHERE ce.class_id = c.id AND ce.student_id = auth.uid() AND ce.is_active = true
        ))
    )
);

CREATE POLICY "Users can view resource comments" ON resource_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON resource_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view public flashcard sets" ON flashcard_sets FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Teachers can manage flashcard sets" ON flashcard_sets FOR ALL USING (
    auth.uid() = user_id AND EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'teacher'
    )
);

CREATE POLICY "Users can view flashcards from accessible sets" ON flashcards FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM flashcard_sets fs 
        WHERE fs.id = flashcards.flashcard_set_id 
        AND (fs.is_public = true OR fs.user_id = auth.uid())
    )
);
CREATE POLICY "Teachers can manage flashcards" ON flashcards FOR ALL USING (
    EXISTS (
        SELECT 1 FROM flashcard_sets fs 
        JOIN profiles p ON p.id = fs.user_id
        WHERE fs.id = flashcards.flashcard_set_id 
        AND fs.user_id = auth.uid()
        AND p.user_type = 'teacher'
    )
);

-- Classes policies
CREATE POLICY "Users can view all classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Teachers can manage own classes" ON classes FOR ALL USING (auth.uid() = teacher_id);

-- Class enrollments policies
CREATE POLICY "Users can view enrollments" ON class_enrollments FOR SELECT USING (
    auth.uid() = student_id OR EXISTS (
        SELECT 1 FROM classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid()
    )
);
CREATE POLICY "Students can enroll" ON class_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Assignments policies
CREATE POLICY "Users can view assignments" ON assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM classes c WHERE c.id = assignments.class_id 
        AND (c.teacher_id = auth.uid() OR EXISTS (
            SELECT 1 FROM class_enrollments ce 
            WHERE ce.class_id = c.id AND ce.student_id = auth.uid() AND ce.is_active = true
        ))
    )
);
CREATE POLICY "Teachers can manage assignments" ON assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM classes c WHERE c.id = assignments.class_id AND c.teacher_id = auth.uid())
);

-- Submissions policies
CREATE POLICY "Students can view own submissions" ON submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can create submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Teachers can view submissions for their assignments" ON submissions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM assignments a 
        JOIN classes c ON c.id = a.class_id
        WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid()
    )
);

-- ========================================
-- STORAGE BUCKET POLICIES
-- ========================================

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-hub', 'study-hub', true)
ON CONFLICT (id) DO NOTHING;

-- Clear existing storage policies
DELETE FROM storage.policies WHERE bucket_id = 'study-hub';

-- Create simple storage policies
INSERT INTO storage.policies (id, bucket_id, name, definition, check_value, command_type)
VALUES 
('study-hub-read', 'study-hub', 'Authenticated users can read files', 
'(auth.role() = ''authenticated'')', 
'(auth.role() = ''authenticated'')', 
'SELECT'),
('study-hub-upload', 'study-hub', 'Authenticated users can upload files', 
'(auth.role() = ''authenticated'')', 
'(auth.role() = ''authenticated'')', 
'INSERT'),
('study-hub-update', 'study-hub', 'Users can update own files', 
'(auth.uid()::text = (storage.foldername(name))[1])', 
'(auth.uid()::text = (storage.foldername(name))[1])', 
'UPDATE'),
('study-hub-delete', 'study-hub', 'Users can delete own files', 
'(auth.uid()::text = (storage.foldername(name))[1])', 
'(auth.uid()::text = (storage.foldername(name))[1])', 
'DELETE');

-- ========================================
-- HELPER FUNCTIONS AND TRIGGERS
-- ========================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;
CREATE TRIGGER update_resources_updated_at 
    BEFORE UPDATE ON resources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_flashcard_sets_updated_at ON flashcard_sets;
CREATE TRIGGER update_flashcard_sets_updated_at 
    BEFORE UPDATE ON flashcard_sets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profile creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'student')
    );
    RETURN NEW;
END;
$$ language plpgsql security definer;

-- Create trigger for profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();