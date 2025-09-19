-- Fix infinite recursion in RLS policies for StudyHub
-- This script removes problematic policies and creates new ones without circular dependencies

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Teachers can manage their classes" ON classes;
DROP POLICY IF EXISTS "Anyone can read public classes" ON classes; 
DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
DROP POLICY IF EXISTS "Users can view class enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "Students can enroll themselves" ON class_enrollments;
DROP POLICY IF EXISTS "Teachers can view class enrollments for their classes" ON class_enrollments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Students can view assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can view assignments" ON assignments;

-- CLASSES table policies (no circular references)
CREATE POLICY "Teachers can create classes"
    ON classes FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        )
        AND teacher_id = auth.uid()
    );

CREATE POLICY "Teachers can read their own classes"
    ON classes FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Students can read classes to join"
    ON classes FOR SELECT
    TO authenticated 
    USING (true); -- Students can see all classes to join them

CREATE POLICY "Teachers can update their own classes"
    ON classes FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
    ON classes FOR DELETE
    TO authenticated
    USING (teacher_id = auth.uid());

-- CLASS_ENROLLMENTS table policies (no circular references) 
CREATE POLICY "Students can enroll themselves"
    ON class_enrollments FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own enrollments"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view enrollments in their classes"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- ASSIGNMENTS table policies (simplified to avoid recursion)
CREATE POLICY "Teachers can create assignments"
    ON assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can read their class assignments"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can read assignments from enrolled classes"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments
            WHERE class_enrollments.class_id = assignments.class_id
            AND class_enrollments.student_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their class assignments"
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

CREATE POLICY "Teachers can delete their class assignments"
    ON assignments FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes
            WHERE classes.id = assignments.class_id
            AND classes.teacher_id = auth.uid()
        )
    );

-- SUBMISSIONS table policies
CREATE POLICY "Students can create their own submissions"
    ON submissions FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own submissions"
    ON submissions FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions for their assignments"
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

-- GRADES table policies
CREATE POLICY "Teachers can create grades"
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

CREATE POLICY "Teachers can view grades for their classes"
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

CREATE POLICY "Students can view their own grades"
    ON grades FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.id = grades.submission_id
            AND s.student_id = auth.uid()
        )
    );

-- PROFILES policies (already working, but ensure they exist)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"  
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- RESOURCES policies (keep existing simple ones)
CREATE POLICY "Users can view all public resources" ON resources FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Users can manage own resources" ON resources FOR ALL TO authenticated USING (user_id = auth.uid());