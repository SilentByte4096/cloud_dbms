-- Fix RLS policies for StudyHub application
-- This migration adds missing policies that are causing 403/406 errors

-- 1. Add missing INSERT policy for profiles table
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 2. Create function to handle new user registration
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
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail the auth process
        RAISE WARNING 'Could not create profile for user %: %', new.id, SQLERRM;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Add policy to allow classes to be read by anyone (for discovery)
CREATE POLICY "Anyone can read public classes"
    ON classes FOR SELECT
    TO authenticated
    USING (true);

-- 5. Ensure classes table has is_public column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'classes' 
        AND column_name = 'is_public'
    ) THEN
        ALTER TABLE classes ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 6. Update classes policy to respect is_public flag
DROP POLICY IF EXISTS "Anyone can read public classes" ON classes;
CREATE POLICY "Anyone can read public classes"
    ON classes FOR SELECT
    TO authenticated
    USING (is_public = true);

-- 7. Add better error handling for assignments queries
-- This helps with the complex joins in the dashboard
CREATE OR REPLACE VIEW user_assignments AS
SELECT 
    a.*,
    c.name as class_name,
    COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'submitted_at', s.submitted_at)) 
         FROM submissions s WHERE s.assignment_id = a.id), 
        '[]'::json
    ) as submissions,
    COALESCE(
        (SELECT json_agg(json_build_object('points', g.points, 'feedback', g.feedback, 'graded_at', g.graded_at)) 
         FROM grades g 
         JOIN submissions s ON s.id = g.submission_id 
         WHERE s.assignment_id = a.id), 
        '[]'::json
    ) as grades
FROM assignments a
JOIN classes c ON c.id = a.class_id
WHERE EXISTS (
    SELECT 1 FROM class_enrollments ce 
    WHERE ce.class_id = a.class_id 
    AND ce.student_id = auth.uid()
);

-- Grant access to the view
GRANT SELECT ON user_assignments TO authenticated;

-- 8. Add helpful indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_composite ON class_enrollments(student_id, class_id);

-- 9. Insert some sample data if tables are empty (optional)
-- This helps with testing the application
INSERT INTO subjects (name, description) VALUES 
    ('General Studies', 'General study materials and resources')
ON CONFLICT (name) DO NOTHING;

-- 10. Create a simple test class for new users
DO $$
BEGIN
    -- Only create if no classes exist
    IF NOT EXISTS (SELECT 1 FROM classes LIMIT 1) THEN
        INSERT INTO classes (teacher_id, name, subject, description, class_code, is_public)
        SELECT 
            p.id,
            'Welcome to StudyHub',
            'General Studies',
            'A sample class to get you started with StudyHub',
            'WELCOME123',
            true
        FROM profiles p
        WHERE p.role = 'teacher'
        LIMIT 1;
    END IF;
END $$;

-- 11. Create a function to safely get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_profile(user_id UUID, user_email TEXT, display_name TEXT DEFAULT 'User')
RETURNS profiles AS $$
DECLARE
    profile_record profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO profile_record
    FROM profiles
    WHERE id = user_id;
    
    -- If not found, create it
    IF profile_record IS NULL THEN
        INSERT INTO profiles (id, full_name, email, role)
        VALUES (user_id, display_name, user_email, 'student')
        RETURNING * INTO profile_record;
    END IF;
    
    RETURN profile_record;
EXCEPTION
    WHEN others THEN
        -- Return a fallback record if all else fails
        SELECT user_id as id, display_name as full_name, user_email as email, 'student' as role, 
               NULL as avatar_url, NOW() as created_at, NOW() as updated_at
        INTO profile_record;
        RETURN profile_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_profile(UUID, TEXT, TEXT) TO authenticated;
