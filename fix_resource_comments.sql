-- Fix resource_comments table schema
-- This script ensures the table has the correct structure

-- Check if the resource_comments table exists and create/modify as needed
DO $$ 
BEGIN
    -- Create the table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_comments') THEN
        CREATE TABLE public.resource_comments (
            id BIGSERIAL PRIMARY KEY,
            resource_id BIGINT NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;

    -- Add content column if it doesn't exist (in case table exists but column is missing)
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'resource_comments' 
                   AND column_name = 'content') THEN
        ALTER TABLE public.resource_comments ADD COLUMN content TEXT NOT NULL DEFAULT '';
    END IF;

    -- Add other missing columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'resource_comments' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.resource_comments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'resource_comments' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.resource_comments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.resource_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view comments on resources they can access" ON public.resource_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.resource_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.resource_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.resource_comments;

-- Create RLS policies for resource_comments
CREATE POLICY "Users can view comments on resources they can access" ON public.resource_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON public.resource_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.resource_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.resource_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resource_comments_resource_id ON public.resource_comments(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_comments_user_id ON public.resource_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_comments_created_at ON public.resource_comments(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_resource_comments_updated_at ON public.resource_comments;
CREATE TRIGGER update_resource_comments_updated_at
    BEFORE UPDATE ON public.resource_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';