-- COMPLETE RLS POLICY RESET FOR STUDYHUB
-- This script removes ALL existing policies and creates clean ones without recursion

-- First, disable RLS temporarily to avoid issues during reset
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on classes table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'classes')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON classes';
    END LOOP;
    
    -- Drop all policies on class_enrollments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'class_enrollments')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON class_enrollments';
    END LOOP;
    
    -- Drop all policies on assignments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'assignments')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON assignments';
    END LOOP;
    
    -- Drop all policies on submissions table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'submissions')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON submissions';
    END LOOP;
    
    -- Drop all policies on grades table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'grades')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON grades';
    END LOOP;
    
    -- Drop all policies on profiles table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
    
    -- Drop all policies on resources table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'resources')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON resources';
    END LOOP;
END
$$;

-- Re-enable RLS on all tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES TABLE POLICIES (FOUNDATION)
-- ========================================

CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ========================================
-- CLASSES TABLE POLICIES (NO RECURSION)
-- ========================================

CREATE POLICY "classes_teachers_insert"
    ON classes FOR INSERT 
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        )
    );

CREATE POLICY "classes_teachers_select_own"
    ON classes FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "classes_students_select_all"
    ON classes FOR SELECT
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'student'
        )
    );

CREATE POLICY "classes_teachers_update_own"
    ON classes FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "classes_teachers_delete_own"
    ON classes FOR DELETE
    TO authenticated
    USING (teacher_id = auth.uid());

-- ========================================
-- CLASS_ENROLLMENTS TABLE POLICIES
-- ========================================

CREATE POLICY "enrollments_students_insert_own"
    ON class_enrollments FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "enrollments_students_select_own"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "enrollments_teachers_select_their_classes"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- ========================================
-- ASSIGNMENTS TABLE POLICIES
-- ========================================

CREATE POLICY "assignments_teachers_insert"
    ON assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "assignments_teachers_select_own_classes"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "assignments_students_select_enrolled"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments
            WHERE class_enrollments.class_id = assignments.class_id
            AND class_enrollments.student_id = auth.uid()
        )
    );

CREATE POLICY "assignments_teachers_update_own_classes"
    ON assignments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "assignments_teachers_delete_own_classes"
    ON assignments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

-- ========================================
-- SUBMISSIONS TABLE POLICIES
-- ========================================

CREATE POLICY "submissions_students_insert_own"
    ON submissions FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "submissions_students_select_own"
    ON submissions FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "submissions_students_update_own"
    ON submissions FOR UPDATE
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "submissions_teachers_select_their_assignments"
    ON submissions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN classes c ON c.id = a.class_id
            WHERE a.id = submissions.assignment_id
            AND c.teacher_id = auth.uid()
        )
    );

-- ========================================
-- GRADES TABLE POLICIES
-- ========================================

CREATE POLICY "grades_teachers_insert"
    ON grades FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN classes c ON c.id = a.class_id
            WHERE s.id = grades.submission_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "grades_teachers_select_their_classes"
    ON grades FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN classes c ON c.id = a.class_id
            WHERE s.id = grades.submission_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "grades_students_select_own"
    ON grades FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.id = grades.submission_id
            AND s.student_id = auth.uid()
        )
    );

CREATE POLICY "grades_teachers_update_their_classes"
    ON grades FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN classes c ON c.id = a.class_id
            WHERE s.id = grades.submission_id
            AND c.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN classes c ON c.id = a.class_id
            WHERE s.id = grades.submission_id
            AND c.teacher_id = auth.uid()
        )
    );

-- ========================================
-- RESOURCES TABLE POLICIES
-- ========================================

CREATE POLICY "resources_users_insert_own"
    ON resources FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "resources_users_select_own"
    ON resources FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "resources_users_select_public"
    ON resources FOR SELECT
    TO authenticated
    USING (is_public = true);

CREATE POLICY "resources_users_update_own"
    ON resources FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "resources_users_delete_own"
    ON resources FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission_id ON grades(submission_id);