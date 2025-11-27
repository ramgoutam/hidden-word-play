-- Add used_words column to games table to track words already used in each game
ALTER TABLE public.games 
ADD COLUMN used_words TEXT[] DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN public.games.used_words IS 'Array of words already used in this game to prevent repetition';