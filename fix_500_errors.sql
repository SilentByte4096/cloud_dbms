-- TARGETED FIX FOR 500 ERRORS
-- Only fix the exact policies causing infinite recursion in assignments table

-- The 500 errors are coming from assignments queries with teacher_id filter
-- This means the assignments table has a recursive policy

-- Drop the exact problematic assignments policies from the schema
DROP POLICY IF EXISTS "Teachers can manage assignments for their classes" ON assignments;
DROP POLICY IF EXISTS "Students can read assignments for enrolled classes" ON assignments;

-- Create simple, non-recursive policies for assignments
CREATE POLICY "assignments_teachers_all"
    ON assignments FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "assignments_students_read"
    ON assignments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM class_enrollments
            WHERE class_enrollments.class_id = assignments.class_id
            AND class_enrollments.student_id = auth.uid()
        )
    );