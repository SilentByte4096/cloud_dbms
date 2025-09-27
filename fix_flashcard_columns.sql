-- First, let's check what columns actually exist in your flashcards table
-- Run this to see the current structure:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'flashcards'
ORDER BY ordinal_position;

-- Also check flashcard_sets table:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'flashcard_sets'
ORDER BY ordinal_position;

-- If the column doesn't exist, add it:
-- (Only run if needed based on the results above)
-- ALTER TABLE flashcards ADD COLUMN flashcard_set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE CASCADE;

-- If the column is named differently (like set_id), we can rename it:
-- ALTER TABLE flashcards RENAME COLUMN set_id TO flashcard_set_id;