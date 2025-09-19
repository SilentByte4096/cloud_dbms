-- COMPLETE FIX FOR ALL INFINITE RECURSION ERRORS
-- Fix classes, class_enrollments, and assignments tables

-- Drop ALL problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Teachers can manage their classes" ON classes;
DROP POLICY IF EXISTS "Students can read classes they're enrolled in" ON classes;
DROP POLICY IF EXISTS "Teachers can see their class enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "Students can see their own enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "Students can enroll in classes" ON class_enrollments;
DROP POLICY IF EXISTS "Teachers can manage assignments for their classes" ON assignments;
DROP POLICY IF EXISTS "Students can read assignments for enrolled classes" ON assignments;

-- CLASSES table - simple, non-recursive policies
CREATE POLICY "classes_teachers_manage"
    ON classes FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "classes_public_read"
    ON classes FOR SELECT
    TO authenticated
    USING (true); -- Allow all students to see classes for joining

-- CLASS_ENROLLMENTS table - simple, non-recursive policies  
CREATE POLICY "enrollments_students_manage_own"
    ON class_enrollments FOR ALL
    TO authenticated
    USING (student_id = auth.uid())
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "enrollments_teachers_read"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );

-- ASSIGNMENTS table - simple, non-recursive policies
CREATE POLICY "assignments_teachers_manage"
    ON assignments FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "assignments_students_read_enrolled"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments
            WHERE class_enrollments.class_id = assignments.class_id
            AND class_enrollments.student_id = auth.uid()
        )
    );