# How to Fix Database Permission Errors

You're currently experiencing several database-related errors in the StudyHub application:

1. HTTP 406 error when fetching user profile data
2. HTTP 403 error when trying to create a user profile
3. HTTP 500 error when querying class enrollments by student_id
4. HTTP 409 conflict errors with foreign key constraints for flashcard sets

These issues are caused by Row-Level Security (RLS) policy problems and missing database triggers.

## Option 1: Run the Fix Migration Script

I've created a migration script that adds all the necessary permissions and triggers. Follow these steps to apply it:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor section
3. Copy the contents of this file: `supabase/migrations/20250902_fix_rls_policies.sql`
4. Run the SQL query

This script will:
- Add missing INSERT policies for profiles
- Create a trigger to automatically create user profiles on signup
- Fix various RLS policies for tables
- Create a view to simplify assignment queries
- Add performance improvements
- Create helpful functions to handle errors gracefully

## Option 2: Run Individual Fixes

If you prefer to fix issues one by one, here are the critical fixes needed:

### 1. Fix Profile Creation Permissions

```sql
-- Add missing INSERT policy for profiles table
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
```

### 2. Create User Profile Trigger

```sql
-- Create function to handle new user registration
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
        RAISE WARNING 'Could not create profile for user %: %', new.id, SQLERRM;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### 3. Fix Class Enrollment Permissions

```sql
-- Add more permissive policy for class discovery
CREATE POLICY "Anyone can read public classes"
    ON classes FOR SELECT
    TO authenticated
    USING (true);
```

## Testing the Fixes

After applying the fixes, perform these tests in the app:

1. Sign out and sign back in
2. Check if the dashboard loads without errors
3. Create a new flashcard set
4. Navigate to assignments section

If you still encounter issues, check the browser console for specific error messages.

## Troubleshooting

If you continue to face problems after applying these fixes:

1. Check if the RLS policies were properly applied in Supabase dashboard
2. Verify that your tables have the expected structure (check if any columns are missing)
3. Try creating a new user to test if the profile creation trigger works
4. Ensure that your Supabase connection in the app is correctly configured

You can also temporarily disable RLS for testing by running:

```sql
-- CAUTION: Only use this for testing
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments DISABLE ROW LEVEL SECURITY;
```

Remember to re-enable RLS after testing with:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
```
