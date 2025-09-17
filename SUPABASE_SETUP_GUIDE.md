# Supabase Database Setup Guide

The application is encountering Row-Level Security (RLS) policy violations. Here are the SQL commands needed to set up proper RLS policies in your Supabase database:

## 1. Enable RLS and Create Policies for Profiles Table

```sql
-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
```

## 2. Enable RLS and Create Policies for User-Owned Tables

```sql
-- Resources table
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resources" ON resources
    FOR ALL USING (auth.uid() = user_id);

-- Flashcard sets table
ALTER TABLE flashcard_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own flashcard sets" ON flashcard_sets
    FOR ALL USING (auth.uid() = user_id);

-- Flashcards table
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage flashcards in own sets" ON flashcards
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM flashcard_sets 
            WHERE flashcard_sets.id = flashcards.set_id 
            AND flashcard_sets.user_id = auth.uid()
        )
    );

-- Study sessions table
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study sessions" ON study_sessions
    FOR ALL USING (auth.uid() = user_id);
```

## 3. Enable RLS and Create Policies for Class-Related Tables

```sql
-- Class enrollments table
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own enrollments" ON class_enrollments
    FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view their class enrollments" ON class_enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- Assignments table
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view assignments for enrolled classes" ON assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM class_enrollments 
            WHERE class_enrollments.class_id = assignments.class_id 
            AND class_enrollments.student_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = assignments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- Submissions table
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can manage own submissions" ON submissions
    FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view submissions for their assignments" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN classes c ON a.class_id = c.id
            WHERE a.id = submissions.assignment_id 
            AND c.teacher_id = auth.uid()
        )
    );

-- Grades table
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own grades" ON grades
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions 
            WHERE submissions.id = grades.submission_id 
            AND submissions.student_id = auth.uid()
        )
    );
CREATE POLICY "Teachers can manage grades for their assignments" ON grades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON s.assignment_id = a.id
            JOIN classes c ON a.class_id = c.id
            WHERE s.id = grades.submission_id 
            AND c.teacher_id = auth.uid()
        )
    );
```

## 4. Create Function to Handle User Registration

```sql
-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
        new.email,
        COALESCE(new.raw_user_meta_data->>'role', 'student')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 5. Additional Utility Policies

```sql
-- Allow public read access to subjects and classes for discovery
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view public classes" ON classes 
    FOR SELECT USING (is_public = true);
CREATE POLICY "Teachers can manage own classes" ON classes
    FOR ALL USING (auth.uid() = teacher_id);

-- Allow public read access to chapters
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view chapters" ON chapters FOR SELECT USING (true);
```

## 6. Run These Commands in Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste each section above
4. Run them one by one to set up the proper RLS policies

After setting up these policies, the application should work correctly without database permission errors.
