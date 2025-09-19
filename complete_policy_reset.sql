-- COMPLETE POLICY RESET - Remove ALL policies and create clean ones
-- This will completely eliminate infinite recursion

-- First, let's see what policies exist (this is just for reference)
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Drop ALL existing policies on problem tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on classes table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'classes' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON classes';
    END LOOP;
    
    -- Drop all policies on class_enrollments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'class_enrollments' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON class_enrollments';
    END LOOP;
    
    -- Drop all policies on assignments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'assignments' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON assignments';
    END LOOP;
END
$$;

-- Now create completely clean, simple policies

-- CLASSES TABLE POLICIES
-- Teachers can do everything with their classes
CREATE POLICY "classes_teacher_full_access"
    ON classes FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Students can read all classes (needed for joining classes)
CREATE POLICY "classes_student_read_all"
    ON classes FOR SELECT
    TO authenticated
    USING (true);

-- CLASS_ENROLLMENTS TABLE POLICIES  
-- Students can manage their own enrollments
CREATE POLICY "enrollments_student_own"
    ON class_enrollments FOR ALL
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

-- Teachers can read enrollments for their classes (simple direct approach)
CREATE POLICY "enrollments_teacher_read"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- ASSIGNMENTS TABLE POLICIES
-- Teachers can manage their assignments  
CREATE POLICY "assignments_teacher_full_access"
    ON assignments FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Students can read assignments for classes they're enrolled in
CREATE POLICY "assignments_student_read"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments
            WHERE class_enrollments.class_id = assignments.class_id
            AND class_enrollments.student_id = auth.uid()
        )
    );

-- Verify the new policies were created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('classes', 'class_enrollments', 'assignments') 
AND schemaname = 'public'
ORDER BY tablename, policyname;