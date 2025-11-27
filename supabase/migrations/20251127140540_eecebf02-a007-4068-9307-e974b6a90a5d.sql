-- Add results_revealed field to games table
ALTER TABLE public.games 
ADD COLUMN results_revealed boolean DEFAULT false;