-- MINIMAL FIX - Only fix the infinite recursion policies causing the error
-- This script only touches the problematic policies that are causing:
-- "infinite recursion detected in policy for relation "classes""
-- "infinite recursion detected in policy for relation "class_enrollments""

-- Drop only the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Teachers can manage their classes" ON classes;
DROP POLICY IF EXISTS "Teachers can view class enrollments for their classes" ON class_enrollments;

-- Replace with simple, non-recursive versions
CREATE POLICY "Teachers can manage their classes"
    ON classes FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can view class enrollments for their classes"
    ON class_enrollments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM classes 
            WHERE classes.id = class_enrollments.class_id 
            AND classes.teacher_id = auth.uid()
        )
    );