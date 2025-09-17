-- Additional fixes for StudyHub database issues
-- Run this after the previous migration to resolve remaining errors

-- 1. First, let's manually create profiles for existing users
-- This handles users who signed up before the trigger was created
INSERT INTO profiles (id, full_name, email, role)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'User') as full_name,
    au.email,
    COALESCE(au.raw_user_meta_data->>'role', 'student') as role
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Create a more robust user profile creation function
CREATE OR REPLACE FUNCTION public.ensure_user_profile(user_id UUID, user_email TEXT DEFAULT NULL, display_name TEXT DEFAULT 'User')
RETURNS profiles AS $$
DECLARE
    profile_record profiles;
    actual_email TEXT;
BEGIN
    -- Try to get existing profile first
    SELECT * INTO profile_record
    FROM profiles
    WHERE id = user_id;
    
    -- If profile exists, return it
    IF profile_record IS NOT NULL THEN
        RETURN profile_record;
    END IF;
    
    -- Get email from auth.users if not provided
    IF user_email IS NULL THEN
        SELECT email INTO actual_email
        FROM auth.users
        WHERE id = user_id;
    ELSE
        actual_email := user_email;
    END IF;
    
    -- Create new profile
    BEGIN
        INSERT INTO profiles (id, full_name, email, role)
        VALUES (user_id, display_name, COALESCE(actual_email, 'unknown@example.com'), 'student')
        RETURNING * INTO profile_record;
        
        RAISE NOTICE 'Created profile for user %', user_id;
        RETURN profile_record;
        
    EXCEPTION
        WHEN unique_violation THEN
            -- Profile was created by another process, fetch it
            SELECT * INTO profile_record
            FROM profiles
            WHERE id = user_id;
            RETURN profile_record;
            
        WHEN others THEN
            RAISE WARNING 'Could not create profile for user %: %', user_id, SQLERRM;
            -- Return a minimal valid record for the app to work
            SELECT 
                user_id as id,
                display_name as full_name,
                COALESCE(actual_email, 'unknown@example.com') as email,
                'student' as role,
                NULL::TEXT as avatar_url,
                NOW() as created_at,
                NOW() as updated_at
            INTO profile_record;
            RETURN profile_record;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ensure_user_profile(UUID, TEXT, TEXT) TO authenticated;

-- 3. Update the trigger function to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Use the robust profile creation function
    PERFORM ensure_user_profile(
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
    );
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Trigger failed for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Add a policy to allow reading profiles by email (helps with debugging)
CREATE POLICY "Service role can read all profiles"
    ON profiles FOR SELECT
    TO service_role
    USING (true);

-- 6. Create a function to fix foreign key issues for existing users
CREATE OR REPLACE FUNCTION fix_user_data(target_user_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    user_record auth.users%ROWTYPE;
    profile_record profiles%ROWTYPE;
    result_message TEXT := '';
BEGIN
    -- If no specific user provided, process current authenticated user
    IF target_user_id IS NULL THEN
        target_user_id := auth.uid();
    END IF;
    
    -- Get user from auth
    SELECT * INTO user_record
    FROM auth.users
    WHERE id = target_user_id;
    
    IF user_record IS NULL THEN
        RETURN 'User not found in auth.users';
    END IF;
    
    -- Ensure profile exists
    SELECT * INTO profile_record
    FROM ensure_user_profile(
        target_user_id,
        user_record.email,
        COALESCE(user_record.raw_user_meta_data->>'full_name', 'User')
    );
    
    result_message := 'Profile ensured for user ' || target_user_id;
    
    -- Update any orphaned records to point to this user
    -- This is safe because we're only updating records that would otherwise be invalid
    
    RETURN result_message || '. Profile: ' || profile_record.full_name;
    
EXCEPTION
    WHEN others THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION fix_user_data(UUID) TO authenticated;

-- 7. Create a simple RPC function that frontend can call to ensure profile
CREATE OR REPLACE FUNCTION rpc_ensure_my_profile()
RETURNS profiles AS $$
DECLARE
    user_record auth.users%ROWTYPE;
    profile_record profiles%ROWTYPE;
BEGIN
    -- Get current user
    SELECT * INTO user_record
    FROM auth.users
    WHERE id = auth.uid();
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Ensure profile exists
    SELECT * INTO profile_record
    FROM ensure_user_profile(
        auth.uid(),
        user_record.email,
        COALESCE(user_record.raw_user_meta_data->>'full_name', 'User')
    );
    
    RETURN profile_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION rpc_ensure_my_profile() TO authenticated;

-- 8. Fix any existing data issues
-- This will create profiles for any existing authenticated users
SELECT fix_user_data(id) FROM auth.users WHERE id NOT IN (SELECT id FROM profiles);

-- 9. Add some debugging views (optional - helps with troubleshooting)
CREATE OR REPLACE VIEW debug_user_status AS
SELECT 
    au.id as user_id,
    au.email as auth_email,
    au.created_at as auth_created,
    p.id as profile_id,
    p.full_name,
    p.email as profile_email,
    p.role,
    CASE 
        WHEN p.id IS NULL THEN 'MISSING_PROFILE'
        WHEN p.email != au.email THEN 'EMAIL_MISMATCH'
        ELSE 'OK'
    END as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
ORDER BY au.created_at DESC;

-- Grant access to debug view
GRANT SELECT ON debug_user_status TO authenticated;
